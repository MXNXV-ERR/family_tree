/* ft-ui.jsx — shared visual primitives. Exports to window. */
const { useState, useEffect, useRef, useCallback } = React;

const genderTint = (g) => g === 'female'
  ? { bg: 'var(--card-f)', brd: 'var(--card-f-brd)', ink: 'var(--rose)' }
  : g === 'other'
  ? { bg: 'var(--card-o)', brd: 'var(--card-o-brd)', ink: 'var(--mute)' }
  : { bg: 'var(--card-m)', brd: 'var(--card-m-brd)', ink: 'var(--accent)' };

function Avatar({ m, size = 40, ring, glow, style }) {
  const t = genderTint(m?.gender);
  const ini = m ? window.FTCore.initials(m.name) : '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: size, flexShrink: 0,
      background: m?.photoUrl ? `center/cover url(${m.photoUrl})` : t.bg,
      border: `1.5px solid ${ring || t.brd}`,
      boxShadow: glow ? `0 0 0 4px var(--accent-soft)` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: t.ink, fontWeight: 700, fontSize: size * 0.34, letterSpacing: '.02em',
      fontFamily: 'var(--font-sans)', overflow: 'hidden', transition: 'box-shadow .25s, border-color .25s',
      ...style,
    }}>
      {!m?.photoUrl && ini}
    </div>
  );
}

function Segmented({ value, onChange, options, size = 'md', icons }) {
  const ref = useRef(null);
  const small = size === 'sm';
  return (
    <div ref={ref} style={{
      display: 'inline-flex', position: 'relative', padding: 4, gap: 2,
      background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 999,
    }}>
      {options.map(([k, label]) => {
        const on = value === k;
        return (
          <button key={k} className="btn press" onClick={() => onChange(k)} style={{
            position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: small ? '7px 13px' : '9px 17px', borderRadius: 999, zIndex: 1,
            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: small ? 13 : 14,
            color: on ? 'var(--accent-ink)' : 'var(--ink-soft)',
            background: on ? 'var(--accent)' : 'transparent',
            boxShadow: on ? '0 4px 14px var(--accent-soft)' : 'none',
            transition: 'color .2s, background .25s var(--ease-out), box-shadow .25s',
          }}>
            {icons && <Icon name={icons[k]} size={small ? 15 : 17} stroke={1.8} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

function IconBtn({ name, onClick, size = 42, icon = 20, tone = 'ghost', title, badge, style, stroke = 1.7, active }) {
  const tones = {
    ghost:   { bg: 'transparent', brd: 'var(--line)', col: 'var(--ink-soft)' },
    glass:   { bg: 'var(--glass)', brd: 'var(--glass-brd)', col: 'var(--ink)' },
    soft:    { bg: 'var(--accent-soft)', brd: 'transparent', col: 'var(--accent)' },
    solid:   { bg: 'var(--accent)', brd: 'var(--accent)', col: 'var(--accent-ink)' },
    rose:    { bg: 'var(--rose-soft)', brd: 'transparent', col: 'var(--rose)' },
  };
  const t = active ? tones.soft : (tones[tone] || tones.ghost);
  return (
    <button className="btn press glass-hover" onClick={onClick} title={title} style={{
      width: size, height: size, borderRadius: tone === 'solid' || size < 46 ? 13 : 14,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      background: t.bg, border: `1px solid ${t.brd}`, color: t.col,
      backdropFilter: tone === 'glass' ? 'blur(16px)' : 'none', WebkitBackdropFilter: tone === 'glass' ? 'blur(16px)' : 'none',
      ...style,
    }}>
      <Icon name={name} size={icon} stroke={stroke} />
      {badge ? <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: 'var(--rose)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span> : null}
    </button>
  );
}

function Chip({ children, tone = 'line', onClick, icon, active, style }) {
  const map = {
    line: { bg: 'var(--paper)', brd: 'var(--line)', col: 'var(--ink-soft)' },
    soft: { bg: 'var(--accent-soft)', brd: 'transparent', col: 'var(--accent)' },
    rose: { bg: 'var(--rose-soft)', brd: 'transparent', col: 'var(--rose)' },
  };
  const t = active ? map.soft : (map[tone] || map.line);
  return (
    <button className="btn press" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: icon ? '6px 12px 6px 8px' : '6px 13px',
      borderRadius: 999, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13,
      background: t.bg, border: `1px solid ${t.brd}`, color: t.col, ...style,
    }}>
      {icon && <Icon name={icon} size={14} stroke={1.9} />}
      {children}
    </button>
  );
}

// bottom sheet / modal with backdrop + slide-up
function Sheet({ open, onClose, children, height = '78%', side }) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => { if (open) setMounted(true); }, [open]);
  if (!mounted) return null;
  const isSide = side === 'right';
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, pointerEvents: open ? 'auto' : 'none' }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'var(--scrim)',
        opacity: open ? 1 : 0, transition: 'opacity .3s', backdropFilter: 'blur(2px)',
      }} onTransitionEnd={() => { if (!open) setMounted(false); }} />
      <div className="glass" style={{
        position: 'absolute', left: isSide ? 'auto' : 0, right: 0, bottom: isSide ? 0 : 0, top: isSide ? 0 : 'auto',
        width: isSide ? '86%' : '100%', height: isSide ? '100%' : height,
        borderRadius: isSide ? '24px 0 0 24px' : '24px 24px 0 0',
        transform: open ? 'none' : (isSide ? 'translateX(100%)' : 'translateY(100%)'),
        transition: 'transform .42s var(--ease-out)', overflow: 'hidden',
        boxShadow: 'var(--shadow-3)', display: 'flex', flexDirection: 'column',
      }}>
        {!isSide && <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}><div style={{ width: 38, height: 4, borderRadius: 99, background: 'var(--line)' }} /></div>}
        {children}
      </div>
    </div>
  );
}

function SectionLabel({ children, style }) {
  return <div className="mono" style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 500, ...style }}>{children}</div>;
}

// animated number counter
function Counter({ value, dur = 900, style }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, start;
    const tick = (t) => { if (!start) start = t; const p = Math.min(1, (t - start) / dur); setN(Math.round((1 - Math.pow(1 - p, 3)) * value)); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="tnum" style={style}>{n}</span>;
}

Object.assign(window, { Avatar, Segmented, IconBtn, Chip, Sheet, SectionLabel, Counter, genderTint });
