/* ft-desktop.jsx — desktop workspace (the screenshot, reimagined). A tree-first
   canvas with a top toolbar, layout sub-bar and a right-side detail drawer.
   Exports window.DesktopApp. */
const { useState: dUseState, useMemo: dUseMemo, useEffect: dUseEffect, useRef: dUseRef } = React;

function FamilySwitcher({ ctx }) {
  const [open, setOpen] = dUseState(false);
  const ref = dUseRef(null);
  dUseEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', h); return () => document.removeEventListener('pointerdown', h);
  }, []);
  const fam = ctx.family;
  const Mono = ({ f, size }) => (
    <div style={{ width: size, height: size, borderRadius: size * 0.31, flexShrink: 0, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${f.color} 22%, var(--paper))`, border: `1.5px solid ${f.color}`, color: f.color, fontWeight: 800, fontSize: size * 0.44, fontFamily: 'var(--font-display)' }}>{f.mono}</div>
  );
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 230 }}>
      <button className="btn press glass-hover" onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '6px 10px 6px 6px', borderRadius: 13, border: '1px solid transparent' }}>
        <Mono f={fam} size={38} />
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 20, fontWeight: 600, fontStyle: 'italic', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 6 }}>{fam.name} <Icon name="chevD" size={15} style={{ color: 'var(--mute)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} /></div>
          <div className="mono" style={{ color: 'var(--mute)', fontSize: 10.5, marginTop: 2 }}>{fam.role} · {ctx.treeMeta.owner}</div>
        </div>
      </button>
      {open && (
        <div className="glass anim-scaleIn" style={{ position: 'absolute', top: 52, left: 0, width: 320, borderRadius: 16, padding: 8, boxShadow: 'var(--shadow-3)', zIndex: 60 }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--mute)', padding: '6px 8px 8px' }}>Your families</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ctx.families.map((f) => {
              const on = f.id === ctx.familyId;
              return (
                <button key={f.id} className="btn press" onClick={() => { ctx.setFamilyId(f.id); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 9, borderRadius: 12, textAlign: 'left', background: on ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${on ? 'var(--accent)' : 'transparent'}` }}>
                  <Mono f={f} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{f.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--mute)', marginTop: 1 }}>{f.kind} · {f.members.length} people</div>
                  </div>
                  {on && <Icon name="check" size={17} style={{ color: 'var(--accent)' }} />}
                </button>
              );
            })}
          </div>
          <div style={{ height: 1, background: 'var(--line-soft)', margin: '8px 4px' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn press" onClick={() => { ctx.openSheet('family'); setOpen(false); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 8px', borderRadius: 11, background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 600, fontSize: 13 }}><Icon name="info" size={16} /> Family info</button>
            <button className="btn press" onClick={() => setOpen(false)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 8px', borderRadius: 11, background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 600, fontSize: 13 }}><Icon name="plus" size={16} stroke={2.1} /> New family</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DesktopApp({ mode, toggleTheme }) {
  const families = window.FT.families;
  const [familyId, setFamilyId] = dUseState(families[0].id);
  const family = families.find((f) => f.id === familyId) || families[0];
  const [membersByFam, setMembersByFam] = dUseState(() => Object.fromEntries(families.map((f) => [f.id, f.members])));
  const members = membersByFam[familyId];
  const rels = family.relationships;
  const [view, setView] = dUseState('tree');
  const [treeLayout, setTreeLayout] = dUseState('pyramid');
  const [panel, setPanel] = dUseState(null); // { type, id }
  const [q, setQ] = dUseState('');
  const adj = dUseMemo(() => window.FTCore.buildAdj(members, rels), [members, rels]);
  const meId = dUseMemo(() => members.find((m) => m.me)?.id, [members]);
  const gens = dUseMemo(() => { const g = window.FTCore.computeGenerations(members, rels); return Math.max(...[...g.values()]) + 1; }, [members, rels]);
  const [focusId, setFocusId] = dUseState(meId || members[0].id);

  dUseEffect(() => {
    const mid = members.find((m) => m.me)?.id || members[0].id;
    setFocusId(mid); setPanel(null);
  }, [familyId]);

  const setMembers = (updater) => setMembersByFam((prev) => ({ ...prev, [familyId]: typeof updater === 'function' ? updater(prev[familyId]) : updater }));
  const updateMember = (id, data) => setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...data } : m)));
  const addMember = (data) => setMembers((ms) => [...ms, { ...data, id: 'm' + Date.now() }]);
  const deleteMember = (id) => setMembers((ms) => ms.filter((m) => m.id !== id));

  const ctx = {
    members, rels, adj, meId, treeMeta: window.FT.treeMetaFor(family), collaborators: family.collaborators,
    families, family, familyId, setFamilyId,
    focusId, setFocusId, mode, toggleTheme, updateMember, addMember, deleteMember,
    go: (name, params = {}) => { if (name === 'profile' || name === 'member') setPanel({ type: name, id: params.id }); else setPanel(null); },
    back: () => setPanel(null),
    openSheet: (s) => setPanel({ type: s }),
  };

  const matches = q.trim() ? members.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase())) : [];

  return (
    <ChromeWindow width={1200} height={760} url="mehta.family/tree">
      <div className="ft" style={{ position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* TOP TOOLBAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 18px', borderBottom: '1px solid var(--line-soft)', position: 'relative', zIndex: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 230 }}>
            <FamilySwitcher ctx={ctx} />
          </div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <Segmented value={view} onChange={setView} icons={{ radial: 'radial', timeline: 'timeline', tree: 'tree' }}
              options={[['radial', 'Radial'], ['timeline', 'Timeline'], ['tree', 'Tree']]} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', width: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 42, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12 }}>
                <Icon name="search" size={17} style={{ color: 'var(--mute)' }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search family…" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', font: '500 14px var(--font-sans)' }} />
              </div>
              {matches.length > 0 && (
                <div className="glass anim-scaleIn" style={{ position: 'absolute', top: 48, left: 0, right: 0, borderRadius: 14, padding: 6, boxShadow: 'var(--shadow-3)', zIndex: 50, maxHeight: 280, overflowY: 'auto' }}>
                  {matches.slice(0, 6).map((m) => (
                    <button key={m.id} className="btn press" onClick={() => { setFocusId(m.id); setQ(''); ctx.go('profile', { id: m.id }); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, textAlign: 'left' }}>
                      <Avatar m={m} size={32} /><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.name}</div><div className="mono" style={{ fontSize: 10.5, color: 'var(--mute)' }}>{window.FTCore.lifespan(m)}</div></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <IconBtn name="scan" onClick={() => ctx.openSheet('facematch')} title="Face match" />
            <IconBtn name="users" onClick={() => ctx.openSheet('members')} title="People" />
            <IconBtn name="tune" onClick={() => ctx.openSheet('settings')} title="Settings" />
            <ThemeToggle mode={mode} onToggle={toggleTheme} />
            <button className="btn press" onClick={() => ctx.openSheet('chat')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', height: 42, borderRadius: 12, border: '1px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 600, fontSize: 13.5 }}><Icon name="sparkles" size={17} /> Ask AI</button>
            <button className="btn press" onClick={() => ctx.go('member')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', height: 42, borderRadius: 12, background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700, fontSize: 14, boxShadow: '0 8px 20px var(--accent-soft)' }}><Icon name="plus" size={17} stroke={2.2} /> Add</button>
          </div>
        </div>

        {/* SUB BAR — tree layout picker (radial/timeline carry their own toolbars) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '1px solid var(--line-soft)', position: 'relative', zIndex: 20, minHeight: 56 }}>
          {view === 'tree'
            ? <Segmented size="sm" value={treeLayout} onChange={setTreeLayout} options={[['pyramid', 'Pyramid'], ['ancestors', 'Ancestors'], ['hourglass', 'Hourglass']]} />
            : <div className="mono" style={{ fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>{view === 'radial' ? 'Radial — kinship rings around ' + (adj.get(focusId)?.name || '') : 'Timeline — lifespans across the decades'}</div>}
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: 9, background: ctx.family.color }} /> {members.length} people · {gens} generations
          </div>
        </div>

        {/* CANVAS */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Visualizer members={members} adj={adj} view={view} treeLayout={treeLayout}
            focusId={focusId} setFocusId={setFocusId} meId={meId}
            onOpenProfile={(m) => ctx.go('profile', { id: m.id })} />
        </div>

        {/* RIGHT DRAWER */}
        <DeskDrawer open={!!panel} onClose={() => setPanel(null)}>
          {panel && (
            panel.type === 'profile' ? <ProfileScreen ctx={ctx} id={panel.id} />
            : panel.type === 'member' ? <MemberForm ctx={ctx} id={panel.id} />
            : panel.type === 'chat' ? <ChatSheet ctx={ctx} onClose={() => setPanel(null)} />
            : panel.type === 'facematch' ? <FaceMatchSheet ctx={ctx} onClose={() => setPanel(null)} />
            : panel.type === 'members' ? <MembersSheet ctx={ctx} onClose={() => setPanel(null)} />
            : panel.type === 'family' ? <FamilyInfoPanel ctx={ctx} family={ctx.family} onClose={() => setPanel(null)} />
            : panel.type === 'settings' ? <SettingsSheet ctx={ctx} onClose={() => setPanel(null)} />
            : null
          )}
        </DeskDrawer>
      </div>
    </ChromeWindow>
  );
}

function DeskDrawer({ open, onClose, children }) {
  const [mounted, setMounted] = dUseState(open);
  React.useEffect(() => { if (open) setMounted(true); }, [open]);
  if (!mounted) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, pointerEvents: open ? 'auto' : 'none' }}>
      <div onClick={onClose} onTransitionEnd={() => { if (!open) setMounted(false); }} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', opacity: open ? 1 : 0, transition: 'opacity .3s', backdropFilter: 'blur(2px)' }} />
      <div className="glass" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 440, borderLeft: '1px solid var(--glass-brd)', transform: open ? 'none' : 'translateX(100%)', transition: 'transform .42s var(--ease-out)', boxShadow: 'var(--shadow-3)', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { DesktopApp, DeskDrawer, FamilySwitcher });
