/* ft-sheets.jsx — overlay panels: Chat (AI), FaceMatch, Members/share, Settings.
   Exports to window. */
const { useState: hUseState, useRef: hUseRef, useEffect: hUseEffect, useMemo: hUseMemo } = React;

function SheetHead({ icon, title, sub, onClose, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 12px' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}><Icon name={icon} size={21} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 16.5 }}>{title}</div>
        {sub && <div style={{ color: 'var(--mute)', fontSize: 12.5 }}>{sub}</div>}
      </div>
      <IconBtn name="close" size={38} tone="ghost" onClick={onClose} />
    </div>
  );
}

// ---------------- AI CHAT ----------------
function ChatSheet({ ctx, onClose }) {
  const [msgs, setMsgs] = hUseState([{ who: 'ai', text: "Hi Jatin — I'm your family historian. Ask me anything about the Mehtas." }]);
  const [text, setText] = hUseState('');
  const [typing, setTyping] = hUseState(false);
  const scroller = hUseRef(null);
  hUseEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, typing]);

  const answer = (q) => {
    const ql = q.toLowerCase();
    const ms = ctx.members;
    const find = (n) => ms.find((m) => m.name.toLowerCase().includes(n));
    if (/how many|count|number of/.test(ql)) return `Your tree has ${ms.length} people across 5 generations, joined by ${ctx.rels.length} recorded relationships.`;
    if (/oldest|earliest/.test(ql)) { const o = ms.filter((m) => m.birthDate).sort((a, b) => +a.birthDate - +b.birthDate)[0]; return `${o.name} is the earliest recorded — born ${o.birthDate}. The family line begins with them.`; }
    if (/youngest|newest|baby/.test(ql)) { const y = ms.filter((m) => m.birthDate).sort((a, b) => +b.birthDate - +a.birthDate)[0]; return `${y.name} is the youngest, born ${y.birthDate}. 🌱`; }
    if (/parent|mother|father/.test(ql)) { const m = ms.find((x) => ql.includes(x.name.split(' ')[0].toLowerCase())); if (m) { const ps = ctx.adj.parents(m.id).map((id) => ctx.adj.get(id).name); return ps.length ? `${m.name}'s parents are ${ps.join(' and ')}.` : `I don't have parents recorded for ${m.name} yet.`; } }
    if (/child|kids|children/.test(ql)) { const m = ms.find((x) => ql.includes(x.name.split(' ')[0].toLowerCase())); if (m) { const cs = ctx.adj.children(m.id).map((id) => ctx.adj.get(id).name); return cs.length ? `${m.name} has ${cs.length} ${cs.length === 1 ? 'child' : 'children'}: ${cs.join(', ')}.` : `No children recorded for ${m.name}.`; } }
    const named = ms.find((m) => ql.includes(m.name.split(' ')[0].toLowerCase()));
    if (named) return `${named.name} — ${window.FTCore.lifespan(named)}${named.occupation ? `, ${named.occupation.toLowerCase()}` : ''}${named.location ? `, based in ${named.location}` : ''}. Tap their card in the tree to read their full story.`;
    return "I can tell you about anyone in the tree, count generations, or trace a line. Try “who are Jatin's parents?” or “who is the oldest?”";
  };

  const send = (q) => {
    const t = (q ?? text).trim(); if (!t) return;
    setMsgs((m) => [...m, { who: 'me', text: t }]); setText(''); setTyping(true);
    setTimeout(() => { setTyping(false); setMsgs((m) => [...m, { who: 'ai', text: answer(t) }]); }, 750 + Math.random() * 500);
  };

  const suggestions = ["Who is the oldest?", "Jatin's parents", "How many people?"];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SheetHead icon="sparkles" title="Family AI" sub="Ask about anyone or anything" onClose={onClose} />
      <div ref={scroller} style={{ flex: 1, overflowY: 'auto', padding: '6px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} className="anim-rise" style={{ alignSelf: m.who === 'me' ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
            <div style={{ padding: '11px 14px', borderRadius: m.who === 'me' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: m.who === 'me' ? 'var(--accent)' : 'var(--paper)', color: m.who === 'me' ? 'var(--accent-ink)' : 'var(--ink)', border: m.who === 'me' ? 'none' : '1px solid var(--line)', fontSize: 14.5, lineHeight: 1.5 }}>{m.text}</div>
          </div>
        ))}
        {typing && <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, padding: '13px 16px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '16px 16px 16px 4px' }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--mute)', animation: `ft-float .9s ease-in-out ${i * 0.15}s infinite` }} />)}</div>}
      </div>
      <div style={{ padding: '8px 14px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {suggestions.map((s) => <Chip key={s} tone="soft" onClick={() => send(s)} style={{ whiteSpace: 'nowrap' }}>{s}</Chip>)}
      </div>
      <div style={{ padding: '6px 14px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 0 14px', height: 48, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 999 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ask the family AI…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', font: '500 14.5px var(--font-sans)' }} />
          <IconBtn name="send" size={38} tone="solid" icon={18} onClick={() => send()} />
        </div>
      </div>
    </div>
  );
}

// ---------------- FACE MATCH ----------------
function FaceMatchSheet({ ctx, onClose }) {
  const [stage, setStage] = hUseState('idle'); // idle | scanning | result
  const match = hUseMemo(() => ctx.members[Math.floor(Math.random() * 6) + 6], []);
  const run = () => { setStage('scanning'); setTimeout(() => setStage('result'), 2600); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SheetHead icon="scan" title="Face match" sub="Find who a photo looks like" onClose={onClose} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 22 }}>
        <div style={{ position: 'relative', width: 230, height: 230, borderRadius: 28, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--paper-2)', display: 'grid', placeItems: 'center' }} className="dotgrid">
          {stage === 'result'
            ? <div className="anim-pop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}><Avatar m={match} size={110} glow /><div style={{ fontWeight: 700, fontSize: 17 }}>{match.name}</div><div className="mono" style={{ color: 'var(--mute)', fontSize: 12 }}>{window.FTCore.lifespan(match)}</div></div>
            : <div style={{ color: 'var(--faint)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}><Icon name="camera" size={54} stroke={1.3} /><span style={{ fontSize: 12.5 }} className="mono">{stage === 'scanning' ? 'analysing…' : 'drop a photo'}</span></div>}
          {/* scan reticle */}
          {stage !== 'result' && <div style={{ position: 'absolute', inset: 20, borderRadius: 20, border: '2px solid var(--accent)', opacity: 0.5 }} />}
          {stage === 'scanning' && <div style={{ position: 'absolute', left: 12, right: 12, height: 3, borderRadius: 9, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', boxShadow: '0 0 18px var(--accent)', animation: 'scanline 1.3s ease-in-out infinite' }} />}
        </div>
        {stage === 'result'
          ? <div style={{ textAlign: 'center' }}><div className="mono" style={{ color: 'var(--teal)', fontSize: 12.5, letterSpacing: '.12em' }}>● 92% RESEMBLANCE</div><div style={{ color: 'var(--mute)', fontSize: 13.5, marginTop: 6, maxWidth: 240 }}>Strong likeness around the eyes and jaw.</div></div>
          : <div style={{ color: 'var(--mute)', fontSize: 13.5, textAlign: 'center', maxWidth: 250 }}>Upload a photo and we'll find the relative it most resembles.</div>}
        {stage === 'result'
          ? <div style={{ display: 'flex', gap: 10 }}><button className="btn press" onClick={() => ctx.go('profile', { id: match.id })} style={{ padding: '13px 22px', borderRadius: 13, background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700 }}>View profile</button><button className="btn press" onClick={() => setStage('idle')} style={{ padding: '13px 20px', borderRadius: 13, border: '1px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 600 }}>Again</button></div>
          : <button className="btn press" onClick={run} disabled={stage === 'scanning'} style={{ padding: '14px 26px', borderRadius: 14, background: stage === 'scanning' ? 'var(--paper)' : 'var(--accent)', color: stage === 'scanning' ? 'var(--mute)' : 'var(--accent-ink)', border: stage === 'scanning' ? '1px solid var(--line)' : 'none', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 9 }}>{stage === 'scanning' ? 'Scanning…' : <><Icon name="scan" size={19} /> Start scan</>}</button>}
      </div>
    </div>
  );
}

// ---------------- MEMBERS / SHARE ----------------
function MembersSheet({ ctx, onClose }) {
  const [copied, setCopied] = hUseState(false);
  const [email, setEmail] = hUseState('');
  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SheetHead icon="users" title="People & sharing" sub="Invite family to build it together" onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 20px' }}>
        <div className="glass" style={{ borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <SectionLabel style={{ marginBottom: 5 }}>Invite code</SectionLabel>
            <div className="mono" style={{ fontSize: 19, fontWeight: 600, letterSpacing: '.08em', color: 'var(--accent)' }}>{ctx.treeMeta.inviteCode}</div>
          </div>
          <button className="btn press" onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12, background: copied ? 'var(--teal)' : 'var(--accent-soft)', color: copied ? '#fff' : 'var(--accent)', fontWeight: 700, fontSize: 13.5, transition: 'background .25s' }}>
            <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', height: 48, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12 }}>
            <Icon name="mail" size={17} style={{ color: 'var(--mute)' }} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Invite by email…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', font: '500 14.5px var(--font-sans)' }} />
          </div>
          <button className="btn press" onClick={() => setEmail('')} style={{ padding: '0 18px', borderRadius: 12, background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700 }}>Send</button>
        </div>
        <SectionLabel style={{ marginBottom: 10, marginLeft: 2 }}>{ctx.collaborators.length} people have access</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ctx.collaborators.map((c) => { const m = ctx.adj.get(c.id) || { name: c.email, gender: 'other' };
            return (
              <div key={c.id} className="glass" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14 }}>
                <div style={{ position: 'relative' }}><Avatar m={m} size={42} />{c.online && <span style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 99, background: 'var(--teal)', border: '2px solid var(--bg)' }} />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{m.name}</div>
                  <div style={{ color: 'var(--mute)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>
                </div>
                <Chip tone={c.role === 'Owner' ? 'soft' : 'line'}>{c.role}</Chip>
              </div>
            ); })}
        </div>
      </div>
    </div>
  );
}

// ---------------- SETTINGS ----------------
function SettingsSheet({ ctx, onClose }) {
  const [opts, setOpts] = hUseState({ years: true, glass: true, motion: true });
  const toggle = (k) => setOpts((o) => ({ ...o, [k]: !o[k] }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SheetHead icon="settings" title="Settings" sub="Appearance & display" onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <SectionLabel style={{ marginBottom: 10, marginLeft: 2 }}>Theme</SectionLabel>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['dark', 'moon', 'Dark'], ['light', 'sun', 'Light']].map(([k, ic, lb]) => (
              <button key={k} className="btn press" onClick={(e) => { if (ctx.mode !== k) ctx.toggleTheme(e); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16, borderRadius: 16, background: ctx.mode === k ? 'var(--accent-soft)' : 'var(--paper)', border: `1.5px solid ${ctx.mode === k ? 'var(--accent)' : 'var(--line)'}`, color: ctx.mode === k ? 'var(--accent)' : 'var(--ink-soft)' }}>
                <Icon name={ic} size={24} /><span style={{ fontWeight: 700, fontSize: 14 }}>{lb}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel style={{ marginBottom: 10, marginLeft: 2 }}>Display</SectionLabel>
          <div className="glass" style={{ borderRadius: 16, padding: '4px 16px' }}>
            {[['years', 'Show birth years', 'cake'], ['glass', 'Glass surfaces', 'grid'], ['motion', 'Motion & animation', 'sparkles']].map(([k, lb, ic], i, a) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: i < a.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                <span style={{ color: 'var(--mute)' }}><Icon name={ic} size={18} /></span>
                <div style={{ flex: 1, fontWeight: 500, fontSize: 14.5 }}>{lb}</div>
                <Toggle on={opts[k]} onClick={() => toggle(k)} />
              </div>
            ))}
          </div>
        </div>
        <button className="btn press" onClick={() => ctx.go('login')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 15, borderRadius: 13, border: '1px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 600, fontSize: 14.5 }}><Icon name="logout" size={18} /> Sign out</button>
      </div>
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button className="btn" onClick={onClick} style={{ width: 48, height: 28, borderRadius: 999, padding: 3, background: on ? 'var(--accent)' : 'var(--line)', transition: 'background .25s', position: 'relative' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 22, height: 22, borderRadius: 999, background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,.25)', transition: 'left .25s var(--ease-spring)' }} />
    </button>
  );
}

Object.assign(window, { ChatSheet, FaceMatchSheet, MembersSheet, SettingsSheet, Toggle, SheetHead });
