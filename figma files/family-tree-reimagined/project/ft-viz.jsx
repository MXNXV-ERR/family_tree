/* ft-viz.jsx — the visualizer surface: pan/zoom canvas, tree/radial/timeline
   rendering, node cards, focus bar. Exports window.Visualizer + window.NodeCard. */
const { useState: vUseState, useRef: vUseRef, useEffect: vUseEffect, useMemo: vUseMemo, useCallback: vUseCallback } = React;

function ZoomPan({ children, contentW, contentH, fitKey, onTapEmpty, controlsRef, padTop = 0 }) {
  const wrapRef = vUseRef(null);
  const [tf, setTf] = vUseState({ s: 1, x: 0, y: 0 });
  const drag = vUseRef(null);
  const pinch = vUseRef(null);

  const fit = vUseCallback(() => {
    const el = wrapRef.current; if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const s = Math.max(0.18, Math.min(1.1, (W - 40) / contentW, (H - padTop - 40) / contentH));
    setTf({ s, x: (W - contentW * s) / 2, y: padTop + (H - padTop - contentH * s) / 2 });
  }, [contentW, contentH, padTop]);

  vUseEffect(() => { fit(); }, [fitKey]);

  vUseEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = {
      zoomBy: (f) => setTf((t) => {
        const el = wrapRef.current; const cx = el.clientWidth / 2, cy = el.clientHeight / 2;
        const ns = Math.max(0.12, Math.min(3, t.s * f));
        return { s: ns, x: cx - (cx - t.x) * (ns / t.s), y: cy - (cy - t.y) * (ns / t.s) };
      }),
      fit, panTo: (wx, wy) => setTf((t) => {
        const el = wrapRef.current;
        return { ...t, x: el.clientWidth / 2 - wx * t.s, y: el.clientHeight / 2 - wy * t.s };
      }),
    };
  }, [fit]);

  const onDown = (e) => {
    if (e.target.closest('[data-node]')) return;
    const p = e.touches ? e.touches[0] : e;
    drag.current = { px: p.clientX, py: p.clientY, ox: tf.x, oy: tf.y, moved: false };
  };
  const onMove = (e) => {
    if (e.touches && e.touches.length === 2) {
      const [a, b] = e.touches; const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const mid = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
      const rect = wrapRef.current.getBoundingClientRect();
      const mx = mid.x - rect.left, my = mid.y - rect.top;
      if (!pinch.current) { pinch.current = { dist, s: tf.s, x: tf.x, y: tf.y, mx, my }; return; }
      const ns = Math.max(0.12, Math.min(3, pinch.current.s * (dist / pinch.current.dist)));
      setTf({ s: ns, x: mx - (mx - pinch.current.x) * (ns / pinch.current.s), y: my - (my - pinch.current.y) * (ns / pinch.current.s) });
      e.preventDefault(); return;
    }
    if (!drag.current) return;
    const p = e.touches ? e.touches[0] : e;
    const nx = drag.current.ox + (p.clientX - drag.current.px), ny = drag.current.oy + (p.clientY - drag.current.py);
    if (Math.abs(p.clientX - drag.current.px) + Math.abs(p.clientY - drag.current.py) > 4) drag.current.moved = true;
    setTf((t) => ({ ...t, x: nx, y: ny }));
  };
  const onUp = (e) => {
    if (drag.current && !drag.current.moved && onTapEmpty && !(e.target.closest && e.target.closest('[data-node]'))) onTapEmpty();
    drag.current = null; pinch.current = null;
  };
  const onWheel = (e) => {
    e.preventDefault();
    const rect = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setTf((t) => { const f = e.deltaY < 0 ? 1.12 : 0.89; const ns = Math.max(0.12, Math.min(3, t.s * f)); return { s: ns, x: mx - (mx - t.x) * (ns / t.s), y: my - (my - t.y) * (ns / t.s) }; });
  };

  return (
    <div ref={wrapRef} className="dotgrid" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} onWheel={onWheel}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: drag.current ? 'grabbing' : 'grab', touchAction: 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: contentW, height: contentH, transformOrigin: '0 0', transform: `translate(${tf.x}px,${tf.y}px) scale(${tf.s})` }}>
        {children}
      </div>
    </div>
  );
}

function NodeCard({ m, x, y, focus, me, dim, hl, compact, onClick }) {
  const t = window.genderTint(m.gender);
  const border = focus ? 'var(--accent)' : hl ? 'var(--teal)' : t.brd;
  return (
    <div data-node onClick={onClick} className="press node-enter"
      style={{
        position: 'absolute', left: x, top: y, width: window.FTCore.NODE_W, height: window.FTCore.NODE_H,
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', cursor: 'pointer',
        borderRadius: 16, background: 'var(--paper)', border: `${focus ? 2 : 1.25}px solid ${border}`,
        boxShadow: focus ? '0 10px 30px var(--accent-soft), var(--shadow-2)' : 'var(--shadow-1)',
        opacity: dim ? 0.32 : 1, transition: 'opacity .3s, border-color .3s, box-shadow .3s, transform .2s',
        zIndex: focus ? 3 : hl ? 2 : 1,
      }}>
      <Avatar m={m} size={40} ring={focus ? 'var(--accent)' : undefined} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
          {me && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.08em', color: 'var(--accent-ink)', background: 'var(--accent)', padding: '2px 5px', borderRadius: 5 }}>YOU</span>}
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--mute)', marginTop: 2 }}>{window.FTCore.lifespan(m)}</div>
      </div>
    </div>
  );
}

function ZoomButtons({ ctrl }) {
  return (
    <div style={{ position: 'absolute', right: 14, bottom: 96, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 6 }}>
      <IconBtn name="zoomIn" tone="glass" onClick={() => ctrl.current?.zoomBy(1.25)} />
      <IconBtn name="zoomOut" tone="glass" onClick={() => ctrl.current?.zoomBy(0.8)} />
      <IconBtn name="target" tone="glass" onClick={() => ctrl.current?.fit()} title="Fit" />
    </div>
  );
}

function Visualizer({ members, adj, view, treeLayout, focusId, setFocusId, meId, onOpenProfile, compact }) {
  const ctrl = vUseRef(null);
  const [sel, setSel] = vUseState(null);

  const res = vUseMemo(() => {
    try {
      if (treeLayout === 'ancestors') return window.FTCore.layoutAncestors(focusId, adj);
      if (treeLayout === 'hourglass') return window.FTCore.layoutHourglass(focusId, members, adj);
      return window.FTCore.layoutDescendants(members, adj);
    } catch (e) { console.warn('layout error', e); return { nodes: [], couples: [], links: [], width: 400, height: 400 }; }
  }, [view, treeLayout, focusId, members, adj]);

  const fitKey = `${view}-${treeLayout}-${view === 'radial' || treeLayout !== 'pyramid' ? focusId : 'all'}-${Math.round(res.width)}`;

  const highlight = vUseMemo(() => {
    if (!sel) return null;
    const s = new Set([sel, ...adj.parents(sel), ...adj.children(sel), ...adj.spouses(sel), ...adj.siblings(sel)]);
    return s;
  }, [sel, adj]);

  const selM = sel ? adj.get(sel) : null;
  const COUPLE_W = window.FTCore.COUPLE_W, NODE_H = window.FTCore.NODE_H;

  // radial + timeline are full, self-contained views with their own controls
  if (view === 'radial') {
    const RV = window.RadialView;
    return <RV adj={adj} focusId={focusId} meId={meId} setFocusId={setFocusId} onOpenProfile={onOpenProfile} compact={compact} />;
  }
  if (view === 'timeline') {
    const TV = window.TimelineView;
    return <TV members={members} adj={adj} focusId={focusId} meId={meId} setFocusId={setFocusId} onOpenProfile={onOpenProfile} compact={compact} />;
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ZoomPan contentW={res.width} contentH={res.height} fitKey={fitKey} controlsRef={ctrl} padTop={compact ? 20 : 8} onTapEmpty={() => setSel(null)}>
        <svg width={res.width} height={res.height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {/* radial rings */}
          {res.rings && res.rings.map((r, i) => (
            <circle key={'r' + i} cx={r.cx} cy={r.cy} r={r.r} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 6" opacity="0.7" />
          ))}
          {/* timeline decades */}
          {res.decades && res.decades.map((d, i) => (
            <g key={'d' + i}>
              <line x1={d.x} y1={40} x2={d.x} y2={res.height - 30} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 7" opacity="0.6" />
              <text x={d.x} y={32} fill="var(--mute)" fontSize="13" fontFamily="var(--font-mono)" textAnchor="middle">{d.year}s</text>
            </g>
          ))}
          {res.links.map((l, i) => (
            <path key={i} className="link-draw" style={{ '--len': 600, animationDelay: `${Math.min(i * 14, 400)}ms` }}
              d={l.d} fill="none" stroke={view === 'radial' ? 'var(--line)' : 'var(--accent)'} strokeWidth={view === 'radial' ? 1.2 : 1.5}
              strokeOpacity={highlight ? 0.18 : view === 'radial' ? 0.5 : 0.45} strokeLinecap="round" />
          ))}
        </svg>

        {res.couples && res.couples.map((c, i) => (
          <div key={'c' + i} style={{
            position: 'absolute', left: c.x, top: c.y, width: c.w, height: NODE_H + 12, borderRadius: 20,
            border: `1.5px ${c.status === 'divorced' ? 'dashed' : 'solid'} ${c.status === 'divorced' ? 'var(--amber)' : 'var(--rose)'}`,
            opacity: highlight ? 0.25 : 0.5, pointerEvents: 'none',
          }} />
        ))}

        {res.nodes.map((n, i) => {
          const m = adj.get(n.id); if (!m) return null;
          const isFocus = n.id === focusId && (view === 'radial' || treeLayout !== 'pyramid');
          return (
            <div key={n.id} style={{ '--i': Math.min(i, 18), animationDelay: `${Math.min(i * 22, 500)}ms`, position: 'absolute', left: 0, top: 0 }}>
              <NodeCard m={m} x={n.x} y={n.y} focus={isFocus || n.id === sel} me={n.id === meId}
                dim={!!highlight && !highlight.has(n.id)} hl={!!highlight && highlight.has(n.id) && n.id !== sel}
                onClick={() => { setSel(n.id); setFocusId(n.id); }} />
            </div>
          );
        })}
      </ZoomPan>

      <ZoomButtons ctrl={ctrl} />

      {/* focus bar */}
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 18, zIndex: 7, pointerEvents: 'none', transition: 'transform .35s var(--ease-out), opacity .3s', transform: selM ? 'none' : 'translateY(120%)', opacity: selM ? 1 : 0 }}>
        {selM && (
          <div className="glass" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, boxShadow: 'var(--shadow-2)' }}>
            <Avatar m={selM} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selM.name}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--mute)' }}>{window.FTCore.lifespan(selM)}{selM.occupation ? ` · ${selM.occupation}` : ''}</div>
            </div>
            <button className="btn press" onClick={() => onOpenProfile(selM)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 12, background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700, fontSize: 13 }}>
              Profile <Icon name="chevR" size={15} stroke={2} />
            </button>
            <IconBtn name="close" size={36} icon={17} onClick={() => setSel(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Visualizer, NodeCard, ZoomPan, ZoomButtons });
