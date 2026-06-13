/* ft-screens.jsx — Login, Visualizer screen, Profile, Member form.
   Exports to window. Receives a shared `ctx` prop bag from MobileApp. */
const { useState: sUseState, useMemo: sUseMemo, useRef: sUseRef, useEffect: sUseEffect } = React;

// ---------------- LOGIN ----------------
function LoginScreen({ onEnter, mode }) {
  const [email, setEmail] = sUseState('jatin75b@gmail.com');
  const [pw, setPw] = sUseState('••••••••');
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 28, overflow: 'hidden' }}>
      {/* ambient tree glyph */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)', width: 360, height: 360, borderRadius: 999, background: 'radial-gradient(circle, var(--accent-soft), transparent 65%)', animation: 'ft-float 7s ease-in-out infinite' }} />
      </div>
      <div className="anim-rise" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--paper)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', boxShadow: 'var(--shadow-2)' }}>
            <Icon name="branch" size={30} stroke={1.7} />
          </div>
        </div>
        <div className="serif" style={{ fontSize: 40, lineHeight: 1.05, textAlign: 'center', fontWeight: 500, fontStyle: 'italic', letterSpacing: '-.01em' }}>Mehta Family</div>
        <div style={{ textAlign: 'center', color: 'var(--mute)', marginTop: 8, fontSize: 14.5 }}>Every name has a story. Welcome back.</div>

        <div className="glass" style={{ marginTop: 28, padding: 20, borderRadius: 22, boxShadow: 'var(--shadow-2)' }}>
          <Field label="Email" value={email} onChange={setEmail} icon="mail" />
          <Field label="Password" value={pw} onChange={setPw} icon="settings" type="password" style={{ marginTop: 12 }} />
          <button className="btn press" onClick={onEnter} style={{ marginTop: 18, width: '100%', padding: 15, borderRadius: 14, background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700, fontSize: 15.5, boxShadow: '0 10px 26px var(--accent-soft)' }}>Sign in</button>
          <button className="btn press" onClick={onEnter} style={{ marginTop: 12, width: '100%', padding: 14, borderRadius: 14, border: '1px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 600, fontSize: 14.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            <Icon name="globe" size={18} /> Continue with Google
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 18, color: 'var(--mute)', fontSize: 13 }}>New here? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Create a tree</span></div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, icon, type, multiline, placeholder, style }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <SectionLabel style={{ marginBottom: 7, marginLeft: 2 }}>{label}</SectionLabel>
      <div style={{ display: 'flex', alignItems: multiline ? 'flex-start' : 'center', gap: 10, padding: multiline ? '12px 13px' : '0 13px', height: multiline ? 'auto' : 48, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 13 }}>
        {icon && <span style={{ color: 'var(--mute)', marginTop: multiline ? 2 : 0 }}><Icon name={icon} size={17} /></span>}
        {multiline
          ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', font: '500 14.5px var(--font-sans)', lineHeight: 1.5 }} />
          : <input value={value} onChange={(e) => onChange(e.target.value)} type={type === 'password' ? 'password' : 'text'} placeholder={placeholder} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', font: '500 15px var(--font-sans)' }} />}
      </div>
    </label>
  );
}

// ---------------- VISUALIZER SCREEN ----------------
function VizScreen({ ctx }) {
  const [view, setView] = sUseState('tree');
  const [treeLayout, setTreeLayout] = sUseState('pyramid');
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '48px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconBtn name="back" size={42} onClick={ctx.back} tone="glass" />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Segmented value={view} onChange={setView} icons={{ tree: 'tree', radial: 'radial', timeline: 'timeline' }}
              options={[['tree', 'Tree'], ['radial', 'Radial'], ['timeline', 'Timeline']]} />
          </div>
        </div>
        {view === 'tree' && (
          <div className="anim-fade" style={{ display: 'flex', justifyContent: 'center' }}>
            <Segmented size="sm" value={treeLayout} onChange={setTreeLayout}
              options={[['pyramid', 'Pyramid'], ['ancestors', 'Ancestors'], ['hourglass', 'Hourglass']]} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <Visualizer members={ctx.members} adj={ctx.adj} view={view} treeLayout={treeLayout}
          focusId={ctx.focusId} setFocusId={ctx.setFocusId} meId={ctx.meId} compact
          onOpenProfile={(m) => ctx.go('profile', { id: m.id })} />
      </div>
    </div>
  );
}

// ---------------- PROFILE ----------------
function ProfileScreen({ ctx, id }) {
  const [tab, setTab] = sUseState('info');
  const m = ctx.adj.get(id);
  if (!m) return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--mute)' }}>Member not found</div>;
  const t = window.genderTint(m.gender);
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      {/* banner */}
      <div style={{ position: 'relative', height: 120, background: `linear-gradient(135deg, ${t.bg}, transparent)`, borderBottom: '1px solid var(--line-soft)' }} className="dotgrid">
        <div style={{ position: 'absolute', top: 48, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', zIndex: 2 }}>
          <IconBtn name="back" size={40} tone="glass" onClick={ctx.back} />
          <div style={{ display: 'flex', gap: 8 }}>
            <IconBtn name="share" size={40} tone="glass" />
            <IconBtn name="edit" size={40} tone="glass" onClick={() => ctx.go('member', { id })} />
          </div>
        </div>
      </div>
      <div style={{ padding: '0 18px 30px', marginTop: -52 }}>
        <div className="anim-rise" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Avatar m={m} size={104} glow style={{ borderWidth: 3, borderColor: 'var(--paper)', boxShadow: 'var(--shadow-2)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <div className="serif" style={{ fontSize: 27, fontWeight: 600, textAlign: 'center' }}>{m.name}</div>
            {m.me && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-ink)', background: 'var(--accent)', padding: '3px 7px', borderRadius: 6 }}>YOU</span>}
          </div>
          <div className="mono" style={{ color: 'var(--mute)', fontSize: 12.5, marginTop: 4 }}>{window.FTCore.lifespan(m)}</div>
          {m.occupation && <div style={{ color: 'var(--ink-soft)', marginTop: 6, fontSize: 14.5 }}>{m.occupation}</div>}
          {m.location && <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--mute)', fontSize: 13, marginTop: 5 }}><Icon name="pin" size={14} /> {m.location}</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'center' }}>
          {[['tree', 'In tree', () => { ctx.setFocusId(id); ctx.go('viz'); }], ['link', 'Add relative', () => ctx.openSheet('member')], ['sparkles', 'Ask AI', () => ctx.openSheet('chat')]].map(([ic, lb, fn]) => (
            <button key={lb} className="btn press" onClick={fn} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 14, background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>
              <Icon name={ic} size={19} /><span style={{ fontSize: 11.5, fontWeight: 600 }}>{lb}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 4, padding: 4, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 14 }}>
          {['info', 'relations', 'story'].map((tk) => (
            <button key={tk} className="btn press" onClick={() => setTab(tk)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontWeight: 700, fontSize: 13.5, textTransform: 'capitalize', color: tab === tk ? 'var(--accent-ink)' : 'var(--ink-soft)', background: tab === tk ? 'var(--accent)' : 'transparent', transition: 'all .2s' }}>{tk}</button>
          ))}
        </div>

        <div className="anim-fade" key={tab} style={{ marginTop: 16 }}>
          {tab === 'info' && <InfoTab m={m} />}
          {tab === 'relations' && <RelationsTab m={m} ctx={ctx} />}
          {tab === 'story' && <StoryTab m={m} />}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ children, style }) { return <div className="glass" style={{ borderRadius: 18, padding: 16, ...style }}>{children}</div>; }

function InfoTab({ m }) {
  const rows = [
    ['phone', 'Phone', m.phone, m.phone && `tel:${m.phone}`],
    ['mail', 'Email', m.email, m.email && `mailto:${m.email}`],
    ['pin', 'Address', m.address],
    ['globe', 'Current location', m.location],
    ['cake', 'Born', m.birthDate],
    ['pin', 'Place of birth', m.placeOfBirth],
    ['user', 'Maiden name', m.maidenName],
    ['briefcase', 'Occupation', m.occupation],
    ...((m.custom || []).filter((c) => c.label && c.value).map((c) => ['info', c.label, c.value])),
  ].filter((r) => r[2]);
  if (!rows.length) return <Empty text="No details recorded yet." />;
  return (
    <InfoCard style={{ padding: '4px 16px' }}>
      {rows.map((r, i) => (
        <div key={r[1]} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
          <span style={{ color: 'var(--mute)' }}><Icon name={r[0]} size={18} /></span>
          <div style={{ flex: 1 }}>
            <SectionLabel style={{ marginBottom: 2 }}>{r[1]}</SectionLabel>
            <div style={{ fontSize: 14.5, fontWeight: 500, textTransform: r[1] === 'Maiden name' ? 'none' : 'none' }}>{r[2]}</div>
          </div>
          {r[3] && <a href={r[3]} className="btn press" style={{ textDecoration: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, border: '1px solid var(--accent)', borderRadius: 999, padding: '5px 12px' }}>Open</a>}
        </div>
      ))}
    </InfoCard>
  );
}

function RelationsTab({ m, ctx }) {
  const groups = [
    ['Parents', ctx.adj.parents(m.id), 'child'],
    ['Partners', ctx.adj.spouses(m.id), 'spouse'],
    ['Children', ctx.adj.children(m.id), 'parent'],
    ['Siblings', ctx.adj.siblings(m.id), 'sibling'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map(([title, ids, kind]) => (
        <InfoCard key={title}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: ids.length ? 12 : 4 }}>
            <SectionLabel>{title} · {ids.length}</SectionLabel>
            <button className="btn press" onClick={() => ctx.openSheet('member')} style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="plus" size={14} stroke={2.2} /> Add</button>
          </div>
          {ids.length === 0 ? <div style={{ color: 'var(--mute)', fontSize: 13 }}>None recorded.</div> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ids.map((rid) => { const p = ctx.adj.get(rid); if (!p) return null; const ex = title === 'Partners' && ctx.adj.status(m.id, rid) === 'divorced';
                return (
                  <button key={rid} className="btn press" onClick={() => ctx.go('profile', { id: rid })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 13px 5px 5px', borderRadius: 999, background: 'var(--paper)', border: '1px solid var(--line)' }}>
                    <Avatar m={p} size={28} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</span>{ex && <span style={{ color: 'var(--amber)', fontSize: 11 }}>ex</span>}
                  </button>
                ); })}
            </div>
          )}
        </InfoCard>
      ))}
    </div>
  );
}

function StoryTab({ m }) {
  const blocks = [['quote', 'Favourite quote', m.favoriteQuote], ['info', 'About', m.about], ['heart', 'Childhood', m.childhoodStories], ['edit', 'Notes', m.notes]].filter((b) => b[2]);
  if (!blocks.length) return <Empty text="No story written yet — tap edit to add one." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blocks.map(([ic, label, val]) => (
        <InfoCard key={label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--accent)' }}><Icon name={ic} size={16} /><SectionLabel style={{ color: 'var(--accent)' }}>{label}</SectionLabel></div>
          {label === 'Favourite quote'
            ? <div className="serif" style={{ fontStyle: 'italic', fontSize: 18, lineHeight: 1.5, color: 'var(--ink)' }}>“{val}”</div>
            : <div style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)' }}>{val}</div>}
        </InfoCard>
      ))}
    </div>
  );
}

function Empty({ text }) { return <InfoCard style={{ textAlign: 'center', color: 'var(--mute)', padding: 28, fontSize: 14 }}>{text}</InfoCard>; }

// ---------------- MEMBER FORM ----------------
function FormSection({ title, children, action }) {
  return (
    <div className="glass" style={{ borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel>{title}</SectionLabel>
        {action}
      </div>
      {children}
    </div>
  );
}

function MemberForm({ ctx, id }) {
  const existing = id ? ctx.adj.get(id) : null;
  const [f, setF] = sUseState(existing
    ? { ...existing, custom: existing.custom ? existing.custom.map((c) => ({ ...c })) : [] }
    : { name: '', gender: 'male', birthDate: '', occupation: '', location: '', about: '', custom: [] });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const setCustom = (i, key) => (v) => setF((s) => ({ ...s, custom: s.custom.map((c, j) => (j === i ? { ...c, [key]: v } : c)) }));
  const addCustom = () => setF((s) => ({ ...s, custom: [...(s.custom || []), { label: '', value: '' }] }));
  const removeCustom = (i) => setF((s) => ({ ...s, custom: s.custom.filter((_, j) => j !== i) }));
  const save = () => {
    const clean = { ...f, custom: (f.custom || []).filter((c) => c.label.trim() || c.value.trim()) };
    if (id) ctx.updateMember(id, clean); else ctx.addMember(clean);
    ctx.back();
  };
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 16px 12px', borderBottom: '1px solid var(--line-soft)' }}>
        <IconBtn name="close" size={40} tone="glass" onClick={ctx.back} />
        <div className="serif" style={{ fontSize: 19, fontWeight: 600, fontStyle: 'italic' }}>{id ? 'Edit member' : 'New member'}</div>
        <button className="btn press" onClick={save} style={{ padding: '9px 18px', borderRadius: 12, background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700, fontSize: 14 }}>Save</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
          <div style={{ position: 'relative' }}>
            <Avatar m={{ name: f.name || '? ?', gender: f.gender }} size={88} />
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 32, height: 32, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', border: '2px solid var(--bg)' }}><Icon name="camera" size={16} /></div>
          </div>
        </div>

        <FormSection title="Basics">
          <Field label={<span>Name <span style={{ color: 'var(--rose)' }}>*</span></span>} value={f.name} onChange={set('name')} placeholder="e.g. Anjali Mehta" />
          <div>
            <SectionLabel style={{ marginBottom: 8, marginLeft: 2 }}>Gender</SectionLabel>
            <Segmented value={f.gender} onChange={set('gender')} options={[['male', 'Male'], ['female', 'Female'], ['other', 'Other']]} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Born" value={f.birthDate || ''} onChange={set('birthDate')} placeholder="1990" style={{ flex: 1 }} />
            <Field label="Died" value={f.deathDate || ''} onChange={set('deathDate')} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
          </div>
        </FormSection>

        <FormSection title="Contact">
          <Field label="Phone" value={f.phone || ''} onChange={set('phone')} icon="phone" placeholder="+1 555 123 4567" />
          <Field label="Email" value={f.email || ''} onChange={set('email')} icon="mail" placeholder="name@example.com" />
          <Field label="Address" value={f.address || ''} onChange={set('address')} icon="pin" placeholder="Street, city" />
          <Field label="Current location" value={f.location || ''} onChange={set('location')} icon="globe" placeholder="Mumbai" />
        </FormSection>

        <FormSection title="Life & story">
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Occupation" value={f.occupation || ''} onChange={set('occupation')} icon="briefcase" placeholder="Architect" style={{ flex: 1 }} />
            <Field label="Maiden name" value={f.maidenName || ''} onChange={set('maidenName')} placeholder="—" style={{ flex: 1 }} />
          </div>
          <Field label="Place of birth" value={f.placeOfBirth || ''} onChange={set('placeOfBirth')} icon="pin" placeholder="City, country" />
          <Field label="Favourite quote" value={f.favoriteQuote || ''} onChange={set('favoriteQuote')} icon="quote" placeholder="Words they lived by…" />
          <Field label="About" value={f.about || ''} onChange={set('about')} icon="info" multiline placeholder="A few words about them…" />
        </FormSection>

        <FormSection title="Custom fields" action={<button className="btn press" onClick={addCustom} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontWeight: 700, fontSize: 12.5 }}><Icon name="plus" size={14} stroke={2.2} /> Add field</button>}>
          {(!f.custom || f.custom.length === 0)
            ? <div style={{ color: 'var(--mute)', fontSize: 13 }}>Add anything else — nickname, blood group, education, a memory…</div>
            : f.custom.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={c.label} onChange={(e) => setCustom(i, 'label')(e.target.value)} placeholder="Label" style={{ width: 130, flexShrink: 0, height: 44, padding: '0 12px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 11, color: 'var(--ink)', outline: 'none', font: '600 13.5px var(--font-sans)' }} />
                <input value={c.value} onChange={(e) => setCustom(i, 'value')(e.target.value)} placeholder="Value" style={{ flex: 1, minWidth: 0, height: 44, padding: '0 12px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 11, color: 'var(--ink)', outline: 'none', font: '500 14px var(--font-sans)' }} />
                <IconBtn name="close" size={38} tone="rose" icon={16} onClick={() => removeCustom(i)} />
              </div>
            ))}
        </FormSection>

        {id && <button className="btn press" onClick={() => { ctx.deleteMember(id); ctx.back(); }} style={{ marginTop: 2, padding: 14, borderRadius: 13, border: '1px solid var(--rose-soft)', background: 'var(--rose-soft)', color: 'var(--rose)', fontWeight: 700, fontSize: 14 }}>Delete member</button>}
      </div>
    </div>
  );
}

// ---------------- FAMILY INFO ----------------
function FamilyInfoPanel({ ctx, family, onClose, onEdit }) {
  const fam = family;
  const gens = sUseMemo(() => {
    const g = window.FTCore.computeGenerations(fam.members, fam.relationships);
    return Math.max(...[...g.values()]) + 1;
  }, [fam]);
  const couples = fam.relationships.filter((r) => r.type === 'spouse').length;
  const stats = [['Members', fam.members.length], ['Generations', gens], ['Couples', couples]];
  const meta = [['pin', 'Region', fam.region], ['cake', 'Established', fam.established], ['user', 'Owner', fam.owner], ['link', 'Invite code', fam.inviteCode]];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 18px 14px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="serif" style={{ fontSize: 19, fontWeight: 600, fontStyle: 'italic' }}>Family info</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onEdit && <IconBtn name="edit" size={38} tone="glass" onClick={onEdit} />}
          <IconBtn name="close" size={38} tone="glass" onClick={onClose} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, flexShrink: 0, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${fam.color} 22%, var(--paper))`, border: `1.5px solid ${fam.color}`, color: fam.color, fontWeight: 800, fontSize: 28, fontFamily: 'var(--font-display)' }}>{fam.mono}</div>
          <div style={{ minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 24, fontWeight: 600 }}>{fam.name}</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 5, padding: '3px 9px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 11.5, fontWeight: 700 }}>{fam.kind}</span>
          </div>
        </div>
        <div style={{ color: 'var(--ink-soft)', fontSize: 14.5, lineHeight: 1.6 }}>{fam.summary}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {stats.map(([lb, v]) => (
            <div key={lb} className="glass" style={{ flex: 1, padding: '13px 14px', borderRadius: 16 }}>
              <div className="serif" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1 }}>{v}</div>
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mute)', marginTop: 6 }}>{lb}</div>
            </div>
          ))}
        </div>
        <div className="glass" style={{ borderRadius: 16, padding: '4px 16px' }}>
          {meta.filter((r) => r[2]).map((r, i, a) => (
            <div key={r[1]} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', borderBottom: i < a.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
              <span style={{ color: 'var(--mute)' }}><Icon name={r[0]} size={18} /></span>
              <div style={{ flex: 1 }}>
                <SectionLabel style={{ marginBottom: 2 }}>{r[1]}</SectionLabel>
                <div className={r[1] === 'Invite code' ? 'mono' : ''} style={{ fontSize: 14.5, fontWeight: r[1] === 'Invite code' ? 600 : 500, color: r[1] === 'Invite code' ? 'var(--accent)' : 'var(--ink)' }}>{r[2]}</div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <SectionLabel style={{ marginBottom: 10, marginLeft: 2 }}>{fam.collaborators.length} people have access</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fam.collaborators.map((c) => { const mem = fam.members.find((x) => x.id === c.id) || { name: c.email, gender: 'other' };
              return (
                <div key={c.id} className="glass" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 14 }}>
                  <div style={{ position: 'relative' }}><Avatar m={mem} size={38} />{c.online && <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 99, background: 'var(--teal)', border: '2px solid var(--bg)' }} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{mem.name}</div>
                    <div style={{ color: 'var(--mute)', fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>
                  </div>
                  <Chip tone={c.role === 'Owner' ? 'soft' : 'line'}>{c.role}</Chip>
                </div>
              ); })}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, VizScreen, ProfileScreen, MemberForm, FamilyInfoPanel, FormSection, Field, InfoCard, Empty });
