'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Member, Relationship } from '@/types/tree';
import type { Adjacency } from '../lib/adjacency';
import { MemberCard, Icons } from './common';

const SECTORS: Record<string, { center: number; span: number }> = {
  parent:       { center: -Math.PI / 2, span: Math.PI * 0.55 },
  partner:      { center: 0,             span: Math.PI / 3 },
  'ex-partner': { center: 0,             span: Math.PI / 3 },
  child:        { center: Math.PI / 2,   span: Math.PI * 0.55 },
  sibling:      { center: Math.PI,       span: Math.PI / 3 },
  focus:        { center: 0,             span: 0 },
};

function arc(center: number, span: number, count: number): number[] {
  if (count <= 1) return [center];
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, i) => center - span / 2 + i * step);
}

type Pos = { x: number; y: number; depth: number; angle: number };

function layoutRadial(adjacency: Adjacency, focusId: string, maxDepth: number) {
  const RING1 = 240;
  const STEP = 160;
  const nodes = adjacency.neighborhood(focusId, maxDepth);

  const ring1: Record<string, string[]> = {};
  for (const [id, n] of nodes) {
    if (n.depth !== 1) continue;
    (ring1[n.label] = ring1[n.label] || []).push(id);
  }

  const pos = new Map<string, Pos>();
  pos.set(focusId, { x: 0, y: 0, depth: 0, angle: 0 });

  for (const key in ring1) {
    const sec = SECTORS[key] || { center: Math.PI / 2, span: Math.PI / 3 };
    const span = Math.min(sec.span * Math.max(1, Math.sqrt(ring1[key].length / 3)), Math.PI * 0.9);
    const angles = arc(sec.center, span, ring1[key].length);
    ring1[key].forEach((id, i) => {
      pos.set(id, {
        x: Math.cos(angles[i]) * RING1,
        y: Math.sin(angles[i]) * RING1,
        depth: 1, angle: angles[i],
      });
    });
  }

  for (let d = 2; d <= maxDepth; d++) {
    const byVia: Record<string, string[]> = {};
    for (const [id, n] of nodes) {
      if (n.depth !== d || !n.viaId) continue;
      (byVia[n.viaId] = byVia[n.viaId] || []).push(id);
    }
    for (const viaId in byVia) {
      const via = pos.get(viaId);
      if (!via) continue;
      const r = RING1 + (d - 1) * STEP;
      const localSpan = Math.PI / 4 + (byVia[viaId].length - 1) * 0.18;
      const angles = arc(via.angle, Math.min(localSpan, Math.PI / 2), byVia[viaId].length);
      byVia[viaId].forEach((id, i) => {
        pos.set(id, {
          x: Math.cos(angles[i]) * r,
          y: Math.sin(angles[i]) * r,
          depth: d, angle: angles[i],
        });
      });
    }
  }

  return { positions: pos, nodes };
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

  const { positions, nodes } = useMemo(
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
    const maxR = 240 + (depth - 1) * 160 + 100;
    const fitZoom = Math.min(1, (canvasSize.w - padding * 2) / (maxR * 2), (canvasSize.h - padding * 2) / (maxR * 2));
    setZoom(Math.max(0.45, fitZoom));
    setPan({ x: 0, y: 0 });
  }, [focusId, depth, canvasSize.w, canvasSize.h]);

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
    if ((e.target as HTMLElement).closest('.fe-mc')) return;
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
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((z) => Math.max(0.5, Math.min(2.5, z * (1 + delta))));
  };

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

      <div className="fe-rv-canvas" ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onWheel={onWheel}>
        <div className="fe-rv-stage" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {[...Array(depth)].map((_, i) => (
            <div
              key={`ring${i}`}
              className="fe-rv-ring"
              style={{ width: `${2 * (240 + i * 160)}px`, height: `${2 * (240 + i * 160)}px` }}
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
