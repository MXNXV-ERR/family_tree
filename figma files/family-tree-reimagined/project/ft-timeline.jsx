/* ft-timeline.jsx — horizontally-scalable Gantt timeline. A fixed left column of
   people (grouped by generation) and a year track you zoom with a slider. Three
   modes: birth dot, lifespan bar, lifespan + life events. Exports window.TimelineView. */
const { useState: tlUseState, useMemo: tlUseMemo, useRef: tlUseRef, useEffect: tlUseEffect, useCallback: tlUseCallback, Fragment: TLFragment } = React;

const tlTickStep = (px) => (px < 6 ? 50 : px < 12 ? 25 : px < 25 ? 10 : px < 50 ? 5 : 1);
const tlMinorStep = (px) => (px < 6 ? 10 : px < 12 ? 5 : 1);

function TimelineView({ members, adj, focusId, meId, setFocusId, onOpenProfile, compact }) {
  const [mode, setMode] = tlUseState('bar');
  const [pxPerYear, setPxPerYear] = tlUseState(compact ? 6 : 12);
  const [scroll, setScroll] = tlUseState(0);
  const [hoverId, setHoverId] = tlUseState(null);
  const scrollRef = tlUseRef(null);
  const dragRef = tlUseRef(null);
  const yearOf = window.FTCore.yearOf;
  const LABEL_W = compact ? 132 : 210;

  const generations = tlUseMemo(() => {
    const memo = new Map();
    const gen = (id) => {
      if (memo.has(id)) return memo.get(id);
      memo.set(id, 0);
      const ps = adj.parents(id).filter((p) => adj.get(p));
      const g = ps.length === 0 ? null : Math.max(...ps.map((p) => gen(p) ?? 0)) + 1;
      memo.set(id, g); return g;
    };
    members.forEach((m) => gen(m.id));
    let changed = true, safety = 5;
    while (changed && safety-- > 0) {
      changed = false;
      members.forEach((m) => {
        if (memo.get(m.id) !== null) return;
        const sp = adj.spouses(m.id).map((s) => memo.get(s)).filter((g) => g != null);
        if (sp.length) { memo.set(m.id, Math.max(...sp)); changed = true; }
      });
    }
    members.forEach((m) => { if (memo.get(m.id) == null) memo.set(m.id, 0); });
    const vals = [...memo.values()]; const min = Math.min(...vals);
    if (min !== 0) memo.forEach((v, k) => memo.set(k, v - min));
    return memo;
  }, [members, adj]);

  const rows = tlUseMemo(() => {
    const list = members.map((m) => ({ m, gen: generations.get(m.id) ?? 0 }));
    list.sort((a, b) => (a.gen !== b.gen ? a.gen - b.gen : (yearOf(a.m.birthDate) ?? 9999) - (yearOf(b.m.birthDate) ?? 9999)));
    return list;
  }, [members, generations]);

  const { minY, maxY } = tlUseMemo(() => {
    const years = [];
    members.forEach((m) => { const b = yearOf(m.birthDate), d = yearOf(m.deathDate); if (b) years.push(b); if (d) years.push(d); });
    const cur = new Date().getFullYear();
    const min = Math.min(...years, cur) - 5, max = Math.max(...years, cur) + 5;
    return { minY: Math.floor(min / 10) * 10, maxY: Math.ceil(max / 10) * 10 };
  }, [members]);

  const contentW = (maxY - minY) * pxPerYear;
  const curYear = new Date().getFullYear();

  const highlight = tlUseMemo(() => {
    if (!hoverId) return null;
    const s = new Set([hoverId, ...adj.parents(hoverId), ...adj.children(hoverId), ...adj.spouses(hoverId), ...adj.siblings(hoverId)]);
    return s;
  }, [hoverId, adj]);

  const clampScroll = (s) => Math.max(0, Math.min(contentW - ((scrollRef.current?.clientWidth ?? 600) - LABEL_W) + 40, s));

  const onDown = (e) => {
    const t = e.target;
    if (t.closest('.tl-marker') || t.closest('button') || t.closest('input')) return;
    if (!t.closest('.tl-track-area') && !t.closest('.tl-axis')) return;
    dragRef.current = { x: e.clientX, scroll };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => { if (!dragRef.current) return; setScroll(clampScroll(dragRef.current.scroll - (e.clientX - dragRef.current.x))); };
  const onUp = () => { dragRef.current = null; };

  tlUseEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left - LABEL_W;
        const yearAt = minY + (scroll + localX) / pxPerYear;
        const next = Math.max(2, Math.min(100, pxPerYear * (1 - e.deltaY * 0.0018)));
        const newW = (maxY - minY) * next;
        setPxPerYear(next);
        setScroll(Math.max(0, Math.min(newW - (rect.width - LABEL_W), (yearAt - minY) * next - localX)));
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        setScroll((s) => Math.max(0, Math.min(contentW - (el.clientWidth - LABEL_W), s + e.deltaX)));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [minY, maxY, scroll, pxPerYear, contentW]);

  const ticks = tlUseMemo(() => {
    const step = tlTickStep(pxPerYear), minor = tlMinorStep(pxPerYear);
    const arr = [];
    for (let y = Math.ceil(minY / minor) * minor; y <= maxY; y += minor) arr.push({ y, major: y % step === 0 });
    return arr;
  }, [pxPerYear, minY, maxY]);

  const lifeEvents = tlUseCallback((id) => {
    if (mode !== 'events') return [];
    const out = [];
    adj.children(id).forEach((cid) => { const c = adj.get(cid); const y = yearOf(c?.birthDate); if (y && c) out.push({ year: y, label: 'birth of ' + c.name }); });
    adj.spouses(id).forEach((sid) => { const s = adj.get(sid); if (s) { const y = yearOf(s.birthDate); /* marriage approx — skip if unknown */ } });
    return out;
  }, [adj, mode]);

  const seg = (k, label) => (
    <button key={k} className="btn press" onClick={() => setMode(k)} style={{
      padding: compact ? '6px 9px' : '7px 13px', borderRadius: 999, fontSize: compact ? 11.5 : 13, fontWeight: 600,
      color: mode === k ? 'var(--accent-ink)' : 'var(--ink-soft)', background: mode === k ? 'var(--accent)' : 'transparent',
      boxShadow: mode === k ? '0 4px 14px var(--accent-soft)' : 'none', whiteSpace: 'nowrap', transition: 'all .2s',
    }}>{label}</button>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '8px 12px' : '10px 18px', borderBottom: '1px solid var(--line-soft)', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: 2, padding: 4, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 999 }}>
          {seg('dot', 'Birth event')}{seg('bar', 'Lifespan')}{seg('events', compact ? 'Events' : 'Lifespan + events')}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 38, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 11 }}>
            <Icon name="calendar" size={14} style={{ color: 'var(--mute)' }} />
            {!compact && <span className="mono" style={{ fontSize: 11, color: 'var(--mute)' }}>Zoom</span>}
            <input className="ft-range" type="range" min={2} max={100} step={1} value={pxPerYear} onChange={(e) => setPxPerYear(Number(e.target.value))} style={{ width: compact ? 70 : 110 }} />
            <span className="mono tnum" style={{ fontSize: 11, color: 'var(--ink-soft)', minWidth: 52 }}>{pxPerYear.toFixed(0)}px/yr</span>
          </div>
          <IconBtn name="plus" size={38} onClick={() => setPxPerYear((p) => Math.min(100, p * 1.25))} />
          <IconBtn name="minus" size={38} onClick={() => setPxPerYear((p) => Math.max(2, p / 1.25))} />
          <IconBtn name="target" size={38} onClick={() => { setPxPerYear(compact ? 6 : 12); setScroll(0); }} title="Reset" />
        </div>
      </div>

      {/* canvas */}
      <div ref={scrollRef} className="dotgrid" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', touchAction: 'pan-y' }}>
        {/* axis */}
        <div className="tl-axis" style={{ position: 'sticky', top: 0, zIndex: 6, display: 'flex', height: 34, background: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line-soft)', cursor: 'ew-resize' }}>
          <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid var(--line-soft)' }} />
          <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, width: contentW, transform: `translateX(${-scroll}px)` }}>
              {ticks.map((t) => (
                <div key={t.y} style={{ position: 'absolute', top: 0, bottom: 0, left: (t.y - minY) * pxPerYear, width: 1, background: t.major ? 'var(--line)' : 'var(--line-soft)' }}>
                  {t.major && <span className="mono" style={{ position: 'absolute', left: 5, top: 8, fontSize: 11, color: 'var(--mute)', whiteSpace: 'nowrap' }}>{t.y}</span>}
                </div>
              ))}
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: (curYear - minY) * pxPerYear, width: 2, background: 'var(--teal)' }}>
                <span className="mono" style={{ position: 'absolute', left: 5, top: 8, fontSize: 10, color: 'var(--teal)' }}>today</span>
              </div>
            </div>
          </div>
        </div>

        {/* rows */}
        <div>
          {rows.map((row, idx) => {
            const m = row.m;
            const newGen = (idx === 0 ? null : rows[idx - 1].gen) !== row.gen;
            const b = yearOf(m.birthDate), dY = yearOf(m.deathDate), d = dY ?? curYear;
            const events = lifeEvents(m.id);
            const isMe = !!meId && m.id === meId;
            const isFocus = m.id === focusId;
            const dim = !!highlight && !highlight.has(m.id);
            const hl = !!highlight && highlight.has(m.id) && !isFocus;
            const t = window.genderTint(m.gender);
            const barColor = isMe ? 'var(--accent)' : t.ink;
            return (
              <TLFragment key={m.id}>
                {newGen && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px 6px', position: 'sticky', left: 0 }}>
                    <span className="mono" style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--mute)' }}>Generation {row.gen + 1}</span>
                    <span style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
                  </div>
                )}
                <div onPointerEnter={() => setHoverId(m.id)} onPointerLeave={() => setHoverId(null)}
                  style={{ display: 'flex', alignItems: 'stretch', minHeight: 52, opacity: dim ? 0.34 : 1, background: isFocus ? 'var(--accent-soft)' : hl ? 'color-mix(in srgb, var(--teal) 8%, transparent)' : 'transparent', transition: 'opacity .25s, background .25s' }}>
                  {/* label */}
                  <button className="btn press" onClick={() => { setFocusId(m.id); onOpenProfile(m); }}
                    style={{ width: LABEL_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '6px 12px', textAlign: 'left', borderRight: '1px solid var(--line-soft)', position: 'sticky', left: 0, background: 'color-mix(in srgb, var(--bg) 80%, transparent)', backdropFilter: 'blur(6px)', zIndex: 2 }}>
                    <Avatar m={m} size={compact ? 24 : 30} ring={isFocus ? 'var(--accent)' : undefined} />
                    {!compact && (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                          {isMe && <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--accent-ink)', background: 'var(--accent)', padding: '1px 4px', borderRadius: 4 }}>YOU</span>}
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--mute)', marginTop: 1 }}>{b ? (dY ? `${b} – ${dY}` : `b. ${b}`) : '—'}</div>
                      </div>
                    )}
                  </button>
                  {/* track */}
                  <div className="tl-track-area" style={{ position: 'relative', flex: 1, overflow: 'hidden', cursor: 'ew-resize' }}>
                    <div style={{ position: 'absolute', inset: 0, width: contentW, transform: `translateX(${-scroll}px)` }}>
                      {b && mode === 'dot' && (
                        <div className="tl-marker" onClick={() => { setFocusId(m.id); onOpenProfile(m); }} title={`${m.name} · born ${b}`}
                          style={{ position: 'absolute', top: '50%', left: (b - minY) * pxPerYear, width: 13, height: 13, marginTop: -6.5, marginLeft: -6.5, borderRadius: 99, background: barColor, border: '2px solid var(--bg)', boxShadow: '0 1px 4px rgba(0,0,0,.4)', cursor: 'pointer' }} />
                      )}
                      {b && mode !== 'dot' && (
                        <div className="tl-marker" onClick={() => { setFocusId(m.id); onOpenProfile(m); }} title={`${m.name} · ${b}–${dY ?? 'present'}`}
                          style={{ position: 'absolute', top: '50%', left: (b - minY) * pxPerYear, width: Math.max((d - b) * pxPerYear, 8), height: 14, marginTop: -7, borderRadius: 99, cursor: 'pointer',
                            background: dY ? `color-mix(in srgb, ${barColor} 50%, transparent)` : `linear-gradient(90deg, color-mix(in srgb, ${barColor} 55%, transparent), color-mix(in srgb, ${barColor} 14%, transparent))`,
                            border: `1px ${dY ? 'solid' : 'dashed'} color-mix(in srgb, ${barColor} 65%, transparent)` }}>
                          <span style={{ position: 'absolute', left: 0, top: -1, bottom: -1, width: 4, borderRadius: 99, background: barColor }} />
                        </div>
                      )}
                      {mode === 'events' && events.map((ev, i) => (
                        <div key={i} className="tl-marker" title={`${ev.label} · ${ev.year}`}
                          style={{ position: 'absolute', top: '50%', left: (ev.year - minY) * pxPerYear, marginTop: -9, marginLeft: -9, width: 18, height: 18, borderRadius: 99, display: 'grid', placeItems: 'center', background: 'var(--rose-soft)', color: 'var(--rose)', border: '1.5px solid var(--rose)', cursor: 'pointer' }}>
                          <Icon name="heart" size={10} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TLFragment>
            );
          })}
          <div style={{ height: 24 }} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TimelineView });
