'use client';

import { useEffect, useMemo, useRef, useState, useCallback, Fragment } from 'react';
import type { Member, Relationship } from '@/types/tree';
import type { Adjacency } from '@/lib/familyExplorer/adjacency';
import { Avatar, Icons } from './common';
import { yearOf, computeGenerations } from '@/lib/familyExplorer/adjacency';

type Mode = 'dot' | 'bar' | 'events';

const tickStep = (pxPerYear: number): number => {
  if (pxPerYear < 6) return 50;
  if (pxPerYear < 12) return 25;
  if (pxPerYear < 25) return 10;
  if (pxPerYear < 50) return 5;
  return 1;
};
const minorStep = (pxPerYear: number): number => {
  if (pxPerYear < 6) return 10;
  if (pxPerYear < 12) return 5;
  return 1;
};

export interface TimelineViewProps {
  members: Member[];
  relationships: Relationship[];
  adjacency: Adjacency;
  focusId: string;
  meId?: string;
  setFocusId: (id: string) => void;
  onOpenProfile: (m: Member) => void;
}

export function TimelineView({
  members, relationships, adjacency, focusId, meId, setFocusId, onOpenProfile,
}: TimelineViewProps) {
  const [mode, setMode] = useState<Mode>('dot');
  const [pxPerYear, setPxPerYear] = useState(8);
  const [scroll, setScroll] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; scroll: number } | null>(null);

  const generations = useMemo(() => computeGenerations(members, relationships), [members, relationships]);

  const rows = useMemo(() => {
    const list = members.slice().map((m) => ({ m, gen: generations.get(m.id) ?? 0 }));
    list.sort((a, b) => {
      if (a.gen !== b.gen) return a.gen - b.gen;
      const ya = yearOf(a.m.birthDate) ?? 9999;
      const yb = yearOf(b.m.birthDate) ?? 9999;
      return ya - yb;
    });
    return list;
  }, [members, generations]);

  const { minY, maxY } = useMemo(() => {
    const years: number[] = [];
    members.forEach((m) => {
      const b = yearOf(m.birthDate);
      const d = yearOf(m.deathDate);
      if (b) years.push(b);
      if (d) years.push(d);
    });
    const currentYear = new Date().getFullYear();
    const min = Math.min(...years, currentYear) - 5;
    const max = Math.max(...years, currentYear) + 5;
    return { minY: Math.floor(min / 10) * 10, maxY: Math.ceil(max / 10) * 10 };
  }, [members]);

  const contentWidth = (maxY - minY) * pxPerYear;
  const currentYear = new Date().getFullYear();

  const highlightSet = useMemo(() => {
    if (!hoverId) return null;
    const set = new Set<string>([hoverId]);
    const ns = adjacency.neighborhood(hoverId, 1);
    for (const id of ns.keys()) set.add(id);
    return set;
  }, [hoverId, adjacency]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.fe-tl-row-content') && !target.closest('.fe-tl-axis')) return;
    if (target.closest('.fe-tl-marker')) return;
    dragRef.current = { x: e.clientX, scroll };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    setScroll(Math.max(0, Math.min(contentWidth - (scrollRef.current?.clientWidth ?? 600) + 220, dragRef.current.scroll - dx)));
  };
  const onPointerUp = () => { dragRef.current = null; };

  // Wheel: Ctrl/Cmd+wheel zooms around the cursor, horizontal delta pans the
  // years, plain vertical wheel falls through to the row list's native scroll.
  // Attached natively (passive: false) because React wheel handlers are
  // passive and preventDefault() would be ignored. Re-attached when the values
  // the handler closes over change, so it always sees fresh state.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left - 220;
        const yearAtCursor = minY + (scroll + localX) / pxPerYear;
        const next = Math.max(2, Math.min(100, pxPerYear * (1 - e.deltaY * 0.0018)));
        const newContentW = (maxY - minY) * next;
        const newScroll = (yearAtCursor - minY) * next - localX;
        setPxPerYear(next);
        setScroll(Math.max(0, Math.min(newContentW - (rect.width - 220), newScroll)));
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        setScroll((s) => Math.max(0, Math.min(contentWidth - (el.clientWidth - 220), s + e.deltaX)));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [minY, maxY, scroll, pxPerYear, contentWidth]);

  const ticks = useMemo(() => {
    const step = tickStep(pxPerYear);
    const minor = minorStep(pxPerYear);
    const arr: Array<{ y: number; isMajor: boolean }> = [];
    for (let y = Math.ceil(minY / minor) * minor; y <= maxY; y += minor) {
      arr.push({ y, isMajor: y % step === 0 });
    }
    return arr;
  }, [pxPerYear, minY, maxY]);

  const lifeEvents = useCallback(
    (id: string): Array<{ year: number; type: string; label: string }> => {
      if (mode !== 'events') return [];
      const events: Array<{ year: number; type: string; label: string }> = [];
      adjacency.children(id).forEach((cId) => {
        const c = adjacency.get(cId);
        const y = yearOf(c?.birthDate);
        if (y && c) events.push({ year: y, type: 'child', label: 'birth of ' + c.name });
      });
      return events;
    },
    [adjacency, mode],
  );

  return (
    <div className="fe-view">
      <div className="fe-toolbar">
        <div className="fe-toolbar-group fe-seg">
          {(['dot', 'bar', 'events'] as Mode[]).map((m) => (
            <button key={m} className={'fe-seg-btn' + (mode === m ? ' is-active' : '')} onClick={() => setMode(m)}>
              {m === 'dot' ? 'Birth event' : m === 'bar' ? 'Lifespan' : 'Lifespan + events'}
            </button>
          ))}
        </div>
        <div className="fe-toolbar-spacer" />
        <div className="fe-toolbar-group">
          <label className="fe-label">
            <Icons.Calendar size={14} />
            <span>Zoom</span>
            <input type="range" min={2} max={100} step={1} value={pxPerYear} onChange={(e) => setPxPerYear(Number(e.target.value))} />
            <span className="fe-num">{pxPerYear.toFixed(0)}px/yr</span>
          </label>
          <button className="fe-icon-btn" onClick={() => setPxPerYear((p) => Math.min(100, p * 1.25))} aria-label="Zoom in"><Icons.Plus size={16} /></button>
          <button className="fe-icon-btn" onClick={() => setPxPerYear((p) => Math.max(2, p / 1.25))} aria-label="Zoom out"><Icons.Minus size={16} /></button>
          <button className="fe-icon-btn" onClick={() => { setPxPerYear(8); setScroll(0); }} aria-label="Reset"><Icons.Target size={16} /></button>
        </div>
      </div>

      <div className="fe-tl-canvas" ref={scrollRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <div className="fe-tl-axis">
          <div className="fe-tl-axis-spacer" />
          <div className="fe-tl-axis-track" style={{ width: contentWidth, transform: `translateX(${-scroll}px)` }}>
            {ticks.map((t) => (
              <div key={t.y} className={'fe-tl-tick' + (t.isMajor ? ' is-major' : '')} style={{ left: `${(t.y - minY) * pxPerYear}px` }}>
                {t.isMajor && <span className="fe-tl-tick-label">{t.y}</span>}
              </div>
            ))}
            <div className="fe-tl-today" style={{ left: `${(currentYear - minY) * pxPerYear}px` }}>
              <span>today</span>
            </div>
          </div>
        </div>

        <div className="fe-tl-rows">
          {rows.map((row, idx) => {
            const m = row.m;
            const prevGen = idx > 0 ? rows[idx - 1].gen : null;
            const newGen = prevGen !== row.gen;
            const b = yearOf(m.birthDate);
            const dY = yearOf(m.deathDate);
            const d = dY ?? currentYear;
            const events = lifeEvents(m.id);
            const isMe = !!meId && m.id === meId;
            const isFocus = m.id === focusId;
            const dim = !!highlightSet && !highlightSet.has(m.id);
            const hl = !!highlightSet && highlightSet.has(m.id) && !isFocus;
            const cls = ['fe-tl-row'];
            if (isFocus) cls.push('is-focus');
            if (hl) cls.push('is-hl');
            if (dim) cls.push('is-dim');

            return (
              <Fragment key={m.id}>
                {newGen && (
                  <div className="fe-tl-gen-divider">
                    <span>Generation {row.gen + 1}</span>
                  </div>
                )}
                <div className={cls.join(' ')} onPointerEnter={() => setHoverId(m.id)} onPointerLeave={() => setHoverId(null)}>
                  <button
                    className="fe-tl-row-label"
                    onClick={() => { setFocusId(m.id); onOpenProfile(m); }}
                  >
                    <Avatar member={m} size={26} />
                    <div className="fe-tl-row-meta">
                      <div className="fe-tl-row-name">
                        {m.name}
                        {isMe && <span className="fe-me-tag">You</span>}
                      </div>
                      <div className="fe-tl-row-sub">{b ? (dY ? `${b} – ${dY}` : `b. ${b}`) : '—'}</div>
                    </div>
                  </button>
                  <div className="fe-tl-row-content">
                    <div className="fe-tl-row-track" style={{ width: contentWidth, transform: `translateX(${-scroll}px)` }}>
                      {b && mode === 'dot' && (
                        <div
                          className={'fe-tl-marker dot' + (isMe ? ' is-me' : '')}
                          style={{ left: `${(b - minY) * pxPerYear}px` }}
                          onClick={() => { setFocusId(m.id); onOpenProfile(m); }}
                          title={`${m.name} · born ${b}`}
                        />
                      )}
                      {b && mode !== 'dot' && (
                        <div
                          className={'fe-tl-marker bar' + (isMe ? ' is-me' : '') + (dY ? '' : ' is-alive')}
                          style={{ left: `${(b - minY) * pxPerYear}px`, width: `${Math.max((d - b) * pxPerYear, 6)}px` }}
                          onClick={() => { setFocusId(m.id); onOpenProfile(m); }}
                          title={`${m.name} · ${b}–${dY ?? 'present'}`}
                        />
                      )}
                      {mode === 'events' && events.map((ev, i) => (
                        <div
                          key={i}
                          className="fe-tl-event"
                          style={{ left: `${(ev.year - minY) * pxPerYear}px` }}
                          title={`${ev.label} · ${ev.year}`}
                        >
                          <Icons.Heart size={11} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
