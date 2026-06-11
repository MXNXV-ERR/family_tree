'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Member, Relationship } from '@/types/tree';
import type { Adjacency } from '@/lib/familyExplorer/adjacency';
import { MemberCard, Icons } from './common';

const SECTORS: Record<string, { center: number; max: number }> = {
  parent:  { center: -Math.PI / 2, max: Math.PI * 0.6 },
  partner: { center: 0,            max: Math.PI * 0.4 },
  child:   { center: Math.PI / 2,  max: Math.PI * 0.6 },
  sibling: { center: Math.PI,      max: Math.PI * 0.5 },
};

function arc(center: number, span: number, count: number): number[] {
  if (count <= 1) return [center];
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, i) => center - span / 2 + i * step);
}

/** Sort by angle and push apart until adjacent nodes are at least minGap
 *  apart (circular), preserving the overall centre of each cluster. */
function relaxRing(items: Array<{ id: string; angle: number }>, minGap: number) {
  if (items.length < 2) return;
  const TAU = Math.PI * 2;
  items.sort((a, b) => a.angle - b.angle);
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 1; i < items.length; i++) {
      const gap = items[i].angle - items[i - 1].angle;
      if (gap < minGap) {
        const push = (minGap - gap) / 2;
        items[i - 1].angle -= push;
        items[i].angle += push;
        moved = true;
      }
    }
    // wrap-around pair (last vs first + 2π)
    const wrapGap = items[0].angle + TAU - items[items.length - 1].angle;
    if (wrapGap < minGap && items.length * minGap < TAU) {
      const push = (minGap - wrapGap) / 2;
      items[0].angle += push;
      items[items.length - 1].angle -= push;
      moved = true;
    }
    if (!moved) break;
    items.sort((a, b) => a.angle - b.angle);
  }
}

type Pos = { x: number; y: number; depth: number; angle: number };

function layoutRadial(adjacency: Adjacency, focusId: string, maxDepth: number) {
  const nodes = adjacency.neighborhood(focusId, maxDepth);

  // Ring-1 groups (current + former partners share one sector)
  const ring1: Record<string, string[]> = {};
  let ring1Count = 0;
  for (const [id, n] of nodes) {
    if (n.depth !== 1) continue;
    const key = n.label === 'ex-partner' ? 'partner' : n.label;
    (ring1[key] = ring1[key] || []).push(id);
    ring1Count++;
  }

  // Ring radii adapt to crowding: cards are ~160px wide on ring 1.
  const CARD_ARC_1 = 160 + 40;
  const CARD_ARC_N = 110 + 30;
  let ring1Radius = 250;
  for (const key in ring1) {
    const sec = SECTORS[key] || { center: Math.PI / 2, max: Math.PI / 2 };
    const need = (CARD_ARC_1 * (ring1[key].length - 1)) / Math.max(sec.max, 0.1);
    ring1Radius = Math.max(ring1Radius, Math.min(560, need));
  }
  ring1Radius += Math.max(0, ring1Count - 7) * 10;
  const STEP = 180;
  const radiusOf = (d: number) => (d <= 0 ? 0 : ring1Radius + (d - 1) * STEP);

  const pos = new Map<string, Pos>();
  pos.set(focusId, { x: 0, y: 0, depth: 0, angle: 0 });

  // ── Ring 1: sector-centred, spacing driven by card width ──
  const ring1Items: Array<{ id: string; angle: number }> = [];
  const perNode1 = CARD_ARC_1 / ring1Radius;
  for (const key in ring1) {
    const sec = SECTORS[key] || { center: Math.PI / 2, max: Math.PI / 2 };
    const ids = ring1[key];
    const span = Math.min(perNode1 * (ids.length - 1), sec.max);
    const angles = arc(sec.center, span, ids.length);
    ids.forEach((id, i) => ring1Items.push({ id, angle: angles[i] }));
  }
  relaxRing(ring1Items, perNode1 * 0.9);
  ring1Items.forEach(({ id, angle }) => {
    pos.set(id, { x: Math.cos(angle) * ring1Radius, y: Math.sin(angle) * ring1Radius, depth: 1, angle });
  });

  // ── Rings 2+: fan out from the node we came through, then relax ──
  for (let d = 2; d <= maxDepth; d++) {
    const r = radiusOf(d);
    const minGap = CARD_ARC_N / r;
    const byVia: Record<string, string[]> = {};
    for (const [id, n] of nodes) {
      if (n.depth !== d || !n.viaId) continue;
      (byVia[n.viaId] = byVia[n.viaId] || []).push(id);
    }
    const items: Array<{ id: string; angle: number }> = [];
    for (const viaId in byVia) {
      const via = pos.get(viaId);
      if (!via) continue;
      const ids = byVia[viaId];
      const angles = arc(via.angle, minGap * (ids.length - 1), ids.length);
      ids.forEach((id, i) => items.push({ id, angle: angles[i] }));
    }
    relaxRing(items, minGap);
    items.forEach(({ id, angle }) => {
      pos.set(id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r, depth: d, angle });
    });
  }

  const ringRadii = Array.from({ length: maxDepth }, (_, i) => radiusOf(i + 1));
  return { positions: pos, nodes, ringRadii };
}

export interface RadialViewProps {
  members: Member[];
  relationships: Relationship[];
  adjacency: Adjacency;
  focusId: string;
  meId?: string;
  setFocusId: (id: string) => void;
  onOpenProfile: (m: Member) => void;
}

export function RadialView({ adjacency, focusId, meId, setFocusId, onOpenProfile }: RadialViewProps) {
  const [depth, setDepth] = useState(1);
  const [recentreOnClick, setRecentreOnClick] = useState(true);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const dragRef = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const { positions, nodes, ringRadii } = useMemo(
    () => layoutRadial(adjacency, focusId, depth),
    [adjacency, focusId, depth],
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      if (r.width > 0 && r.height > 0) setCanvasSize({ w: r.width, h: r.height });
    });
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const padding = 40;
    const maxR = (ringRadii[ringRadii.length - 1] ?? 250) + 110;
    const fitZoom = Math.min(1, (canvasSize.w - padding * 2) / (maxR * 2), (canvasSize.h - padding * 2) / (maxR * 2));
    setZoom(Math.max(0.4, fitZoom));
    setPan({ x: 0, y: 0 });
  }, [focusId, depth, canvasSize.w, canvasSize.h, ringRadii]);

  const handleClick = (m: Member) => {
    if (recentreOnClick) setFocusId(m.id);
    else onOpenProfile(m);
  };

  const highlightSet = useMemo(() => {
    if (!hoverId) return null;
    const set = new Set<string>([hoverId]);
    const ns = adjacency.neighborhood(hoverId, 1);
    for (const id of ns.keys()) set.add(id);
    return set;
  }, [hoverId, adjacency]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    // Don't start a drag (and capture the pointer) on interactive overlays —
    // capturing would swallow their click events.
    if ((e.target as HTMLElement).closest('button, .fe-rv-status, .fe-rv-legend')) return;
    dragRef.current = { x: e.clientX, y: e.clientY, pan: { ...pan } };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.pan.x + (e.clientX - dragRef.current.x),
      y: dragRef.current.pan.y + (e.clientY - dragRef.current.y),
    });
  };
  const onPointerUp = () => { dragRef.current = null; };

  // Native wheel listener: React's synthetic wheel handlers are passive, so
  // preventDefault() there can't stop the page from scrolling while zooming.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      setZoom((z) => Math.max(0.5, Math.min(2.5, z * (1 + delta))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const focusMember = adjacency.get(focusId);

  const lines: Array<{ id: string; from: Pos; to: Pos; label: string; viaRel?: string }> = [];
  for (const [id, n] of nodes) {
    if (n.depth === 0) continue;
    const from = n.viaId ? positions.get(n.viaId) : positions.get(focusId);
    const to = positions.get(id);
    if (!from || !to) continue;
    lines.push({ id, from, to, label: n.label, viaRel: n.viaRel });
  }

  const lineColor = (rel?: string) => {
    if (rel === 'parent') return 'var(--fe-rel-parent)';
    if (rel === 'child') return 'var(--fe-rel-child)';
    if (rel === 'partner') return 'var(--fe-rel-partner)';
    if (rel === 'ex-partner') return 'var(--fe-rel-ex)';
    if (rel === 'sibling') return 'var(--fe-rel-sibling)';
    return 'var(--fe-rel-other)';
  };

  return (
    <div className="fe-view">
      <div className="fe-toolbar">
        <div className="fe-toolbar-group">
          <label className="fe-label">
            <Icons.Sliders size={14} />
            <span>Depth</span>
            <input type="range" min={1} max={3} step={1} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
            <span className="fe-num">{depth}</span>
          </label>
        </div>
        <div className="fe-toolbar-group">
          <label className="fe-toggle">
            <input type="checkbox" checked={recentreOnClick} onChange={(e) => setRecentreOnClick(e.target.checked)} />
            <span>Re-centre on click</span>
          </label>
        </div>
        <div className="fe-toolbar-spacer" />
        <div className="fe-toolbar-group">
          <button className="fe-icon-btn" onClick={() => setZoom((z) => Math.min(2.5, z * 1.2))} aria-label="Zoom in"><Icons.Plus size={16} /></button>
          <button className="fe-icon-btn" onClick={() => setZoom((z) => Math.max(0.5, z / 1.2))} aria-label="Zoom out"><Icons.Minus size={16} /></button>
          <button className="fe-icon-btn" onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }} aria-label="Reset"><Icons.Target size={16} /></button>
        </div>
      </div>

      <div className="fe-rv-canvas" ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <div className="fe-rv-stage" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {ringRadii.map((r, i) => (
            <div
              key={`ring${i}`}
              className="fe-rv-ring"
              style={{ width: `${2 * r}px`, height: `${2 * r}px` }}
            />
          ))}
          <svg className="fe-rv-svg" width={1} height={1} style={{ overflow: 'visible' }}>
            {lines.map((l) => {
              const isHover = highlightSet && (highlightSet.has(l.id));
              return (
                <line
                  key={l.id}
                  x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y}
                  stroke={lineColor(l.viaRel || l.label)}
                  strokeWidth={1.6}
                  strokeDasharray={(l.viaRel === 'ex-partner' || l.label === 'ex-partner') ? '5 4' : 'none'}
                  opacity={highlightSet ? (isHover ? 1 : 0.18) : 0.55}
                  style={{ transition: 'opacity .2s, stroke .3s' }}
                />
              );
            })}
          </svg>
          {[...positions.entries()].map(([id, p]) => {
            const m = adjacency.get(id);
            if (!m) return null;
            const node = nodes.get(id);
            const isFocus = id === focusId;
            const isMe = !!meId && m.id === meId;
            const dim = !!highlightSet && !highlightSet.has(id);
            const hl = !!highlightSet && highlightSet.has(id) && !isFocus;
            return (
              <div
                key={id}
                className="fe-rv-node"
                style={{ transform: `translate(calc(${p.x}px - 50%), calc(${p.y}px - 50%))` }}
                onPointerEnter={() => setHoverId(id)}
                onPointerLeave={() => setHoverId(null)}
              >
                <MemberCard
                  member={m}
                  isFocus={isFocus}
                  isHighlight={hl}
                  isDim={dim}
                  isMe={isMe}
                  size={isFocus ? 'lg' : p.depth === 1 ? 'md' : 'sm'}
                  relationship={!isFocus ? node?.label : null}
                  onClick={handleClick}
                />
              </div>
            );
          })}
        </div>

        <div className="fe-rv-legend">
          <div className="fe-rv-legend-title">Relationship</div>
          {([
            ['Parent / grandparent', 'var(--fe-rel-parent)'],
            ['Partner', 'var(--fe-rel-partner)'],
            ['Former partner', 'var(--fe-rel-ex)', 'dashed'],
            ['Child / grandchild', 'var(--fe-rel-child)'],
            ['Sibling / cousin', 'var(--fe-rel-sibling)'],
          ] as Array<[string, string, 'dashed'?]>).map(([label, c, style]) => (
            <div key={label} className="fe-rv-legend-row">
              <span className="fe-rv-legend-swatch" style={{ background: c, borderTopStyle: style === 'dashed' ? 'dashed' : 'solid' }} />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {focusMember && (
          <div className="fe-rv-status">
            <div className="fe-rv-status-label">Focused on</div>
            <div className="fe-rv-status-name">{focusMember.name}</div>
            <button className="fe-rv-status-action" onClick={() => onOpenProfile(focusMember)}>View profile →</button>
          </div>
        )}
      </div>
    </div>
  );
}
