/* ft-radial.jsx — kinship rings around a focused person. Visible rings, a depth
   slider, lines that fan out FROM the focus through each relative, relationship
   labels on every card, and a colour legend. Exports window.RadialView. */
const { useState: rvUseState, useMemo: rvUseMemo, useRef: rvUseRef, useEffect: rvUseEffect } = React;

const REL_COLOR = (rel) => {
  if (rel === 'parent' || rel === 'grandparent' || rel === 'great-grandparent') return 'var(--rel-parent)';
  if (rel === 'child' || rel === 'grandchild' || rel === 'great-grandchild') return 'var(--rel-child)';
  if (rel === 'partner') return 'var(--rel-partner)';
  if (rel === 'ex-partner') return 'var(--rel-ex)';
  if (rel === 'sibling') return 'var(--rel-sibling)';
  return 'var(--rel-other)';
};

function RadialNode({ m, rel, isFocus, isMe, dim, hl, depth, onClick, onEnter, onLeave }) {
  const t = window.genderTint(m.gender);
  const size = isFocus ? 'lg' : depth === 1 ? 'md' : 'sm';
  const W = size === 'lg' ? 176 : size === 'md' ? 158 : 132;
  const av = size === 'lg' ? 46 : size === 'md' ? 38 : 30;
  const border = isFocus ? 'var(--accent)' : hl ? 'var(--teal)' : t.brd;
  return (
    <div data-node onClick={() => onClick(m)} onPointerEnter={onEnter} onPointerLeave={onLeave} className="press"
      style={{ width: W, padding: size === 'sm' ? '7px 9px' : '9px 11px', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
        borderRadius: 15, background: 'var(--paper)', border: `${isFocus ? 2 : 1.25}px solid ${border}`,
        boxShadow: isFocus ? '0 10px 30px var(--accent-soft), var(--shadow-2)' : 'var(--shadow-1)',
        opacity: dim ? 0.3 : 1, transition: 'opacity .25s, border-color .25s, box-shadow .25s, transform .15s' }}>
      <Avatar m={m} size={av} ring={isFocus ? 'var(--accent)' : undefined} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontWeight: 700, fontSize: size === 'sm' ? 12.5 : 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
          {isMe && <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--accent-ink)', background: 'var(--accent)', padding: '1px 4px', borderRadius: 4 }}>YOU</span>}
        </div>
        {isFocus
          ? <div className="mono" style={{ fontSize: 10, color: 'var(--mute)', marginTop: 2 }}>{window.FTCore.lifespan(m)}</div>
          : <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: REL_COLOR(rel), flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rel}</span>
            </div>}
      </div>
    </div>
  );
}

function RadialView({ adj, focusId, meId, setFocusId, onOpenProfile, compact }) {
  const [depth, setDepth] = rvUseState(compact ? 1 : 2);
  const [recenter, setRecenter] = rvUseState(true);
  const [hoverId, setHoverId] = rvUseState(null);
  const [zoom, setZoom] = rvUseState(1);
  const [pan, setPan] = rvUseState({ x: 0, y: 0 });
  const [size, setSize] = rvUseState({ w: 800, h: 600 });
  const dragRef = rvUseRef(null);
  const canvasRef = rvUseRef(null);

  const { positions, nodes, ringRadii, lines } = rvUseMemo(() => window.FTCore.layoutRadial2(focusId, adj, depth), [adj, focusId, depth]);

  rvUseEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver((entries) => { const r = entries[0].contentRect; if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height }); });
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  rvUseEffect(() => {
    const maxR = (ringRadii[ringRadii.length - 1] ?? 250) + 120;
    const fit = Math.min(1, (size.w - 80) / (maxR * 2), (size.h - 80) / (maxR * 2));
    setZoom(Math.max(0.32, fit)); setPan({ x: 0, y: 0 });
  }, [focusId, depth, size.w, size.h, ringRadii.length]);

  rvUseEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const onWheel = (e) => { e.preventDefault(); setZoom((z) => Math.max(0.3, Math.min(2.6, z * (1 - e.deltaY * 0.0015)))); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onDown = (e) => {
    if (e.target.closest('[data-node]') || e.target.closest('button') || e.target.closest('input') || e.target.closest('.rv-overlay')) return;
    dragRef.current = { x: e.clientX, y: e.clientY, pan: { ...pan } };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => { if (!dragRef.current) return; setPan({ x: dragRef.current.pan.x + (e.clientX - dragRef.current.x), y: dragRef.current.pan.y + (e.clientY - dragRef.current.y) }); };
  const onUp = () => { dragRef.current = null; };

  const highlight = rvUseMemo(() => {
    if (!hoverId) return null;
    return new Set([hoverId, ...adj.parents(hoverId), ...adj.children(hoverId), ...adj.spouses(hoverId), ...adj.siblings(hoverId)]);
  }, [hoverId, adj]);

  const handleClick = (m) => { if (recenter && m.id !== focusId) setFocusId(m.id); else onOpenProfile(m); };
  const focusM = adj.get(focusId);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '8px 12px' : '10px 18px', borderBottom: '1px solid var(--line-soft)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 38, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 11 }}>
          <Icon name="tune" size={14} style={{ color: 'var(--mute)' }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--mute)' }}>Depth</span>
          <input className="ft-range" type="range" min={1} max={3} step={1} value={depth} onChange={(e) => setDepth(Number(e.target.value))} style={{ width: compact ? 64 : 92 }} />
          <span className="mono tnum" style={{ fontSize: 12, color: 'var(--ink-soft)', width: 12 }}>{depth}</span>
        </div>
        <button className="btn press" onClick={() => setRecenter((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 38, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 11, color: 'var(--ink-soft)', fontSize: 12.5, fontWeight: 600 }}>
          <Toggle on={recenter} onClick={() => setRecenter((v) => !v)} />
          {!compact && <span>Re-centre on click</span>}
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn name="zoomIn" size={38} onClick={() => setZoom((z) => Math.min(2.6, z * 1.2))} />
          <IconBtn name="zoomOut" size={38} onClick={() => setZoom((z) => Math.max(0.3, z / 1.2))} />
          <IconBtn name="target" size={38} onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }} title="Reset" />
        </div>
      </div>

      {/* canvas */}
      <div ref={canvasRef} className="dotgrid" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center' }}>
          {/* rings */}
          {ringRadii.map((r, i) => (
            <div key={'ring' + i} style={{ position: 'absolute', left: -r, top: -r, width: 2 * r, height: 2 * r, borderRadius: '50%', border: '1.5px solid var(--line)', boxShadow: 'inset 0 0 60px color-mix(in srgb, var(--accent) 6%, transparent)' }} />
          ))}
          {/* lines */}
          <svg width="1" height="1" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
            {lines.map((l) => {
              const isHl = highlight && highlight.has(l.id);
              return (
                <line key={l.id} x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y}
                  stroke={REL_COLOR(l.viaRel || l.label)} strokeWidth={2}
                  strokeDasharray={l.viaRel === 'ex-partner' ? '6 5' : 'none'}
                  opacity={highlight ? (isHl ? 1 : 0.14) : 0.6} strokeLinecap="round" style={{ transition: 'opacity .2s' }} />
              );
            })}
          </svg>
          {/* nodes */}
          {[...positions.entries()].map(([id, p]) => {
            const m = adj.get(id); if (!m) return null;
            const n = nodes.get(id);
            const isFocus = id === focusId;
            return (
              <div key={id} style={{ position: 'absolute', left: 0, top: 0, transform: `translate(calc(${p.x}px - 50%), calc(${p.y}px - 50%))`, zIndex: isFocus ? 3 : 1 }}>
                <RadialNode m={m} rel={n?.label} isFocus={isFocus} isMe={!!meId && id === meId} depth={p.depth}
                  dim={!!highlight && !highlight.has(id)} hl={!!highlight && highlight.has(id) && !isFocus}
                  onClick={handleClick} onEnter={() => setHoverId(id)} onLeave={() => setHoverId(null)} />
              </div>
            );
          })}
        </div>

        {/* legend */}
        <div className="rv-overlay glass" style={{ position: 'absolute', left: 14, bottom: 14, padding: '11px 13px', borderRadius: 14, boxShadow: 'var(--shadow-2)', maxWidth: 200 }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 8 }}>Relationship</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['Parent / grandparent', 'var(--rel-parent)'], ['Partner', 'var(--rel-partner)'], ['Former partner', 'var(--rel-ex)', true], ['Child / grandchild', 'var(--rel-child)'], ['Sibling / cousin', 'var(--rel-sibling)']].map(([lb, c, dash]) => (
              <div key={lb} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 16, height: 0, borderTop: `2px ${dash ? 'dashed' : 'solid'} ${c}`, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{lb}</span>
              </div>
            ))}
          </div>
        </div>

        {/* focus status */}
        {focusM && (
          <div className="rv-overlay glass" style={{ position: 'absolute', right: 14, bottom: 14, padding: '12px 14px', borderRadius: 14, boxShadow: 'var(--shadow-2)', minWidth: 180 }}>
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--mute)' }}>Focused on</div>
            <div className="serif" style={{ fontSize: 18, fontWeight: 600, margin: '3px 0 8px' }}>{focusM.name}</div>
            <button className="btn press" onClick={() => onOpenProfile(focusM)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontWeight: 700, fontSize: 12.5 }}>View profile <Icon name="chevR" size={14} stroke={2} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { RadialView, RadialNode });
