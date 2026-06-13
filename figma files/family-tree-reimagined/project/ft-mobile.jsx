/* ft-mobile.jsx — MobileApp shell (nav + state + sheets), Home, header, bottom nav.
   Exports window.MobileApp. Receives { mode, toggleTheme } from the app. */
const { useState: mUseState, useMemo: mUseMemo, useRef: mUseRef, useEffect: mUseEffect } = React;

function ThemeToggle({ mode, onToggle, size = 42, tone = 'glass' }) {
  return (
    <button className="btn press theme-toggle glass-hover" onClick={onToggle} title="Toggle theme" style={{
      width: size, height: size, borderRadius: 13, display: 'grid', placeItems: 'center',
      background: tone === 'glass' ? 'var(--glass)' : 'transparent', border: '1px solid var(--glass-brd)',
      color: 'var(--ink)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    }}>
      <span style={{ display: 'grid', placeItems: 'center', transform: mode === 'dark' ? 'rotate(0deg)' : 'rotate(360deg)', transition: 'transform .6s var(--ease-spring)' }}>
        <Icon name={mode === 'dark' ? 'moon' : 'sun'} size={20} />
      </span>
    </button>
  );
}

function MobileApp({ mode, toggleTheme }) {
  const families = window.FT.families;
  const [familyId, setFamilyId] = mUseState(families[0].id);
  const family = families.find((f) => f.id === familyId) || families[0];
  const [membersByFam, setMembersByFam] = mUseState(() => Object.fromEntries(families.map((f) => [f.id, f.members])));
  const members = membersByFam[familyId];
  const rels = family.relationships;
  const [stack, setStack] = mUseState([{ name: 'login' }]);
  const [sheet, setSheet] = mUseState(null);
  const [focusId, setFocusId] = mUseState(members.find((m) => m.me)?.id || members[0].id);

  const adj = mUseMemo(() => window.FTCore.buildAdj(members, rels), [members, rels]);
  const meId = mUseMemo(() => members.find((m) => m.me)?.id, [members]);
  const cur = stack[stack.length - 1];

  mUseEffect(() => { setFocusId(members.find((m) => m.me)?.id || members[0].id); setStack((s) => (s[s.length - 1].name === 'login' ? s : [{ name: 'home' }])); }, [familyId]);

  const go = (name, params = {}) => { if (name === 'login' || name === 'home') setStack([{ name, ...params }]); else setStack((s) => [...s, { name, ...params }]); };
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const openSheet = (s) => setSheet(s);

  const setMembers = (updater) => setMembersByFam((prev) => ({ ...prev, [familyId]: typeof updater === 'function' ? updater(prev[familyId]) : updater }));
  const updateMember = (id, data) => setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...data } : m)));
  const addMember = (data) => setMembers((ms) => [...ms, { ...data, id: 'm' + Date.now() }]);
  const deleteMember = (id) => setMembers((ms) => ms.filter((m) => m.id !== id));

  const ctx = {
    members, rels, adj, meId, treeMeta: window.FT.treeMetaFor(family), collaborators: family.collaborators,
    families, family, familyId, setFamilyId,
    go, back, openSheet, focusId, setFocusId, mode, toggleTheme,
    updateMember, addMember, deleteMember,
  };

  const showNav = cur.name === 'home' || cur.name === 'profile';
  const dark = mode === 'dark';

  return (
    <IOSDevice dark={dark} width={400} height={862}>
      <div className="ft" style={{ position: 'absolute', inset: 0, background: 'var(--bg)', overflow: 'hidden' }}>
        <div className="ft" style={{ position: 'absolute', inset: 0, paddingTop: cur.name === 'login' ? 0 : 0 }}>
          {/* screen stack — keyed so each animates in */}
          <div key={cur.name + (cur.id || '')} className="anim-fade" style={{ position: 'absolute', inset: 0 }}>
            {cur.name === 'login' && <LoginScreen mode={mode} onEnter={() => go('home')} />}
            {cur.name === 'home' && <HomeScreen ctx={ctx} />}
            {cur.name === 'viz' && <VizScreen ctx={ctx} />}
            {cur.name === 'profile' && <ProfileScreen ctx={ctx} id={cur.id} />}
            {cur.name === 'member' && <MemberForm ctx={ctx} id={cur.id} />}
          </div>
        </div>

        {showNav && <BottomNav cur={cur.name} ctx={ctx} />}

        {/* sheets */}
        <Sheet open={sheet === 'chat'} onClose={() => setSheet(null)} height="86%"><ChatSheet ctx={ctx} onClose={() => setSheet(null)} /></Sheet>
        <Sheet open={sheet === 'facematch'} onClose={() => setSheet(null)} height="74%"><FaceMatchSheet ctx={ctx} onClose={() => setSheet(null)} /></Sheet>
        <Sheet open={sheet === 'members'} onClose={() => setSheet(null)} height="80%"><MembersSheet ctx={ctx} onClose={() => setSheet(null)} /></Sheet>
        <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} height="72%"><SettingsSheet ctx={ctx} onClose={() => setSheet(null)} /></Sheet>
        <Sheet open={sheet === 'families'} onClose={() => setSheet(null)} height="64%"><FamilyPickerSheet ctx={ctx} onClose={() => setSheet(null)} onInfo={() => setSheet('family')} /></Sheet>
        <Sheet open={sheet === 'family'} onClose={() => setSheet(null)} height="88%"><FamilyInfoPanel ctx={ctx} family={ctx.family} onClose={() => setSheet(null)} /></Sheet>
      </div>
    </IOSDevice>
  );
}

function HomeScreen({ ctx }) {
  const [q, setQ] = mUseState('');
  const gens = 5;
  const couples = ctx.rels.filter((r) => r.type === 'spouse').length;
  const shown = q.trim() ? ctx.members.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase())) : ctx.members;
  const me = ctx.adj.get(ctx.meId);

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingBottom: 96 }}>
      {/* header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, padding: '54px 16px 12px', background: 'linear-gradient(var(--bg), color-mix(in srgb, var(--bg) 70%, transparent))', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn press" onClick={() => ctx.openSheet('families')} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left' }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${ctx.family.color} 22%, var(--paper))`, border: `1.5px solid ${ctx.family.color}`, color: ctx.family.color, fontWeight: 800, fontSize: 20, fontFamily: 'var(--font-display)' }}>{ctx.family.mono}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 23, fontWeight: 600, fontStyle: 'italic', lineHeight: 1.1, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 6 }}>{ctx.treeMeta.name} <Icon name="chevD" size={15} style={{ color: 'var(--mute)' }} /></div>
              <div className="mono" style={{ color: 'var(--mute)', fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: 9, background: 'var(--teal)' }} />{ctx.family.kind}</div>
            </div>
          </button>
          <ThemeToggle mode={ctx.mode} onToggle={ctx.toggleTheme} />
          <IconBtn name="tune" tone="glass" onClick={() => ctx.openSheet('settings')} />
        </div>
      </div>

      <div style={{ padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* HERO — the main tool */}
        <button className="btn press anim-rise" onClick={() => ctx.go('viz')} style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', padding: 20, borderRadius: 24, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--accent-ink)', boxShadow: '0 18px 40px var(--accent-soft), var(--shadow-2)' }}>
          <div aria-hidden className="dotgrid" style={{ position: 'absolute', inset: 0, opacity: 0.35, maskImage: 'radial-gradient(circle at 80% 30%, #000, transparent 70%)' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 10.5, letterSpacing: '.18em', opacity: 0.85, textTransform: 'uppercase' }}>The whole family, at a glance</div>
              <div className="serif" style={{ fontSize: 30, fontWeight: 600, fontStyle: 'italic', margin: '5px 0 10px', lineHeight: 1 }}>Visualize</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.18)', fontWeight: 700, fontSize: 13.5, backdropFilter: 'blur(8px)' }}>Open tree <Icon name="chevR" size={15} stroke={2.2} /></div>
            </div>
            <div style={{ width: 78, height: 78, borderRadius: 22, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', display: 'grid', placeItems: 'center', animation: 'ft-float 5s ease-in-out infinite', backdropFilter: 'blur(6px)' }}>
              <Icon name="tree" size={40} stroke={1.5} />
            </div>
          </div>
        </button>

        {/* stats */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[['Members', ctx.members.length], ['Couples', couples], ['Generations', gens]].map(([lb, v], i) => (
            <div key={lb} className="glass anim-rise" style={{ flex: 1, padding: '14px 14px', borderRadius: 18, animationDelay: `${i * 70 + 60}ms` }}>
              <div className="serif" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1 }}><Counter value={v} /></div>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mute)', marginTop: 6 }}>{lb}</div>
            </div>
          ))}
        </div>

        {/* quick tools */}
        <div style={{ display: 'flex', gap: 9, overflowX: 'auto', paddingBottom: 2, margin: '0 -16px', padding: '0 16px' }}>
          {[['scan', 'Face match', () => ctx.openSheet('facematch')], ['users', 'People', () => ctx.openSheet('members')], ['sparkles', 'Family AI', () => ctx.openSheet('chat')], ['share', 'Export', () => ctx.openSheet('members')], ['link', 'Link', () => ctx.openSheet('members')]].map(([ic, lb, fn]) => (
            <button key={lb} className="btn press" onClick={fn} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '12px 14px', borderRadius: 16, background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink-soft)', minWidth: 78 }}>
              <span style={{ color: 'var(--accent)' }}><Icon name={ic} size={20} /></span>
              <span style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{lb}</span>
            </button>
          ))}
        </div>

        {/* search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 50, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 14 }}>
          <Icon name="search" size={19} style={{ color: 'var(--mute)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search family…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', font: '500 15px var(--font-sans)' }} />
          {q && <button className="btn" onClick={() => setQ('')} style={{ color: 'var(--mute)' }}><Icon name="close" size={17} /></button>}
        </div>

        {/* member list */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <SectionLabel>{q ? `${shown.length} matches` : 'All members'}</SectionLabel>
          <button className="btn press" onClick={() => ctx.go('member')} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontWeight: 700, fontSize: 12.5 }}><Icon name="plus" size={14} stroke={2.2} /> Add</button>
        </div>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map((m, i) => (
            <button key={m.id} className="btn press" onClick={() => ctx.go('profile', { id: m.id })} style={{ '--i': Math.min(i, 16), display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 15, background: 'var(--paper)', border: '1px solid var(--line)', textAlign: 'left' }}>
              <Avatar m={m} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</span>
                  {m.me && <span style={{ fontSize: 8.5, fontWeight: 800, color: 'var(--accent-ink)', background: 'var(--accent)', padding: '2px 5px', borderRadius: 5 }}>YOU</span>}
                </div>
                <div className="mono" style={{ color: 'var(--mute)', fontSize: 11.5, marginTop: 2 }}>{window.FTCore.lifespan(m)}{m.occupation ? ` · ${m.occupation}` : ''}</div>
              </div>
              <span style={{ color: 'var(--faint)' }}><Icon name="chevR" size={18} /></span>
            </button>
          ))}
          {shown.length === 0 && <Empty text="No matches found." />}
        </div>
      </div>
    </div>
  );
}

function BottomNav({ cur, ctx }) {
  const items = [
    ['home', 'home', 'Home', () => ctx.go('home')],
    ['users', 'people', 'People', () => ctx.openSheet('members')],
    ['tree', 'viz', '', () => ctx.go('viz')],
    ['sparkles', 'ai', 'AI', () => ctx.openSheet('chat')],
    ['user', 'me', 'Me', () => ctx.go('profile', { id: ctx.meId })],
  ];
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 40, padding: '0 14px 22px', pointerEvents: 'none' }}>
      <div className="glass anim-rise" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderRadius: 24, boxShadow: 'var(--shadow-3)' }}>
        {items.map(([ic, key, lb, fn]) => {
          if (key === 'viz') return (
            <button key={key} className="btn press" onClick={fn} style={{ width: 60, height: 60, borderRadius: 20, marginTop: -28, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', boxShadow: '0 12px 26px var(--accent-soft), var(--shadow-2)', border: '3px solid var(--bg)' }}>
              <Icon name="tree" size={27} stroke={1.7} />
            </button>
          );
          const active = (key === 'home' && cur === 'home');
          return (
            <button key={key} className="btn press" onClick={fn} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 12px', color: active ? 'var(--accent)' : 'var(--mute)', minWidth: 52 }}>
              <Icon name={ic} size={21} stroke={active ? 2 : 1.7} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>{lb}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FamilyPickerSheet({ ctx, onClose, onInfo }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SheetHead icon="users" title="Your families" sub="Switch between the trees you belong to" onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ctx.families.map((f) => {
          const on = f.id === ctx.familyId;
          return (
            <button key={f.id} className="btn press" onClick={() => { ctx.setFamilyId(f.id); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 13, borderRadius: 18, textAlign: 'left', background: on ? 'var(--accent-soft)' : 'var(--paper)', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}` }}>
              <div style={{ width: 50, height: 50, borderRadius: 15, flexShrink: 0, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${f.color} 22%, var(--paper))`, border: `1.5px solid ${f.color}`, color: f.color, fontWeight: 800, fontSize: 24, fontFamily: 'var(--font-display)' }}>{f.mono}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{f.name}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>{f.kind} · {f.members.length} people</div>
              </div>
              {on ? <span style={{ display: 'inline-flex', padding: 6, borderRadius: 99, background: 'var(--accent)', color: 'var(--accent-ink)' }}><Icon name="check" size={16} /></span> : <Icon name="chevR" size={18} style={{ color: 'var(--faint)' }} />}
            </button>
          );
        })}
        <button className="btn press" onClick={onInfo} style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 15, borderRadius: 14, border: '1px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 600, fontSize: 14.5 }}><Icon name="info" size={18} /> View family info</button>
      </div>
    </div>
  );
}

Object.assign(window, { MobileApp, ThemeToggle, HomeScreen, BottomNav, FamilyPickerSheet });
