'use client';

import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, type ReactNode, type CSSProperties } from 'react';
import type { Member } from '@/types/tree';
import type { Adjacency } from '@/lib/familyExplorer/adjacency';
import { lifespan, initials, yearOf } from '@/lib/familyExplorer/adjacency';

// ── Theme context ────────────────────────────────────────────────
type ThemeCtxValue = { theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark', origin?: { x: number; y: number }) => void };
const ThemeCtx = createContext<ThemeCtxValue>({ theme: 'light', setTheme: () => {} });

export function FamilyExplorerThemeProvider({ children }: { children: ReactNode }) {
  const getAppTheme = (): 'light' | 'dark' =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  const [theme, setThemeState] = useState<'light' | 'dark'>(getAppTheme);

  // Stay in sync with the app's Tailwind dark class
  useEffect(() => {
    setThemeState(getAppTheme());
    const observer = new MutationObserver(() => setThemeState(getAppTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.querySelector('.family-explorer') as HTMLElement | null;
    if (root) root.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((next: 'light' | 'dark', origin?: { x: number; y: number }) => {
    const apply = () => setThemeState(next);
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    if (!doc.startViewTransition) {
      apply();
      return;
    }
    if (origin) {
      document.documentElement.style.setProperty('--fe-vt-x', `${origin.x}px`);
      document.documentElement.style.setProperty('--fe-vt-y', `${origin.y}px`);
    }
    document.documentElement.dataset.feVt = 'theme';
    const tr = doc.startViewTransition(apply);
    tr.finished.finally(() => {
      delete document.documentElement.dataset.feVt;
    });
  }, []);

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export const useFamilyExplorerTheme = () => useContext(ThemeCtx);

// ── Icons ────────────────────────────────────────────────────────
type IconProps = { size?: number; className?: string };

const SvgIcon = ({ size = 18, children }: { size?: number; children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const Icons = {
  Sun: (p: IconProps) => (
    <SvgIcon {...p}>
      <circle cx={12} cy={12} r={4} />
      {[[12,2,12,4],[12,20,12,22],[2,12,4,12],[20,12,22,12],[4.93,4.93,6.34,6.34],[17.66,17.66,19.07,19.07],[4.93,19.07,6.34,17.66],[17.66,6.34,19.07,4.93]].map(([x1,y1,x2,y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </SvgIcon>
  ),
  Moon:   (p: IconProps) => <SvgIcon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></SvgIcon>,
  Search: (p: IconProps) => <SvgIcon {...p}><circle cx={11} cy={11} r={7} /><line x1={21} y1={21} x2={16.65} y2={16.65} /></SvgIcon>,
  X:      (p: IconProps) => <SvgIcon {...p}><path d="M18 6 6 18 M6 6l12 12" /></SvgIcon>,
  Plus:   (p: IconProps) => <SvgIcon {...p}><path d="M12 5v14M5 12h14" /></SvgIcon>,
  Minus:  (p: IconProps) => <SvgIcon {...p}><path d="M5 12h14" /></SvgIcon>,
  Target: (p: IconProps) => <SvgIcon {...p}><circle cx={12} cy={12} r={8} /><circle cx={12} cy={12} r={3} /><line x1={12} y1={2} x2={12} y2={4} /><line x1={12} y1={20} x2={12} y2={22} /><line x1={2} y1={12} x2={4} y2={12} /><line x1={20} y1={12} x2={22} y2={12} /></SvgIcon>,
  Radial: (p: IconProps) => <SvgIcon {...p}><circle cx={12} cy={12} r={2} /><circle cx={5} cy={6} r={1.6} /><circle cx={19} cy={6} r={1.6} /><circle cx={5} cy={18} r={1.6} /><circle cx={19} cy={18} r={1.6} /><line x1={12} y1={12} x2={5} y2={6} /><line x1={12} y1={12} x2={19} y2={6} /><line x1={12} y1={12} x2={5} y2={18} /><line x1={12} y1={12} x2={19} y2={18} /></SvgIcon>,
  Timeline: (p: IconProps) => <SvgIcon {...p}><line x1={3} y1={12} x2={21} y2={12} /><circle cx={6} cy={12} r={1.6} fill="currentColor" /><circle cx={12} cy={12} r={1.6} fill="currentColor" /><circle cx={18} cy={12} r={1.6} fill="currentColor" /><line x1={6} y1={9} x2={6} y2={6} /><line x1={12} y1={9} x2={12} y2={6} /><line x1={18} y1={9} x2={18} y2={6} /></SvgIcon>,
  Tree:   (p: IconProps) => <SvgIcon {...p}><rect x={9} y={2} width={6} height={5} rx={1} /><rect x={2} y={17} width={6} height={5} rx={1} /><rect x={16} y={17} width={6} height={5} rx={1} /><path d="M12 7v4M5 17v-3h14v3" /></SvgIcon>,
  Sliders: (p: IconProps) => <SvgIcon {...p}><line x1={4} y1={21} x2={4} y2={14} /><line x1={4} y1={10} x2={4} y2={3} /><line x1={12} y1={21} x2={12} y2={12} /><line x1={12} y1={8} x2={12} y2={3} /><line x1={20} y1={21} x2={20} y2={16} /><line x1={20} y1={12} x2={20} y2={3} /><circle cx={4} cy={12} r={1.6} fill="currentColor" /><circle cx={12} cy={10} r={1.6} fill="currentColor" /><circle cx={20} cy={14} r={1.6} fill="currentColor" /></SvgIcon>,
  Calendar: (p: IconProps) => <SvgIcon {...p}><rect x={3} y={4} width={18} height={18} rx={2} /><line x1={16} y1={2} x2={16} y2={6} /><line x1={8} y1={2} x2={8} y2={6} /><line x1={3} y1={10} x2={21} y2={10} /></SvgIcon>,
  Map:    (p: IconProps) => <SvgIcon {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx={12} cy={10} r={3} /></SvgIcon>,
  Share:  (p: IconProps) => <SvgIcon {...p}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1={12} y1={2} x2={12} y2={15} /></SvgIcon>,
  Heart:  (p: IconProps) => <SvgIcon {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></SvgIcon>,
};

// ── Avatar ───────────────────────────────────────────────────────
export function Avatar({ member, size = 40 }: { member: Member; size?: number }) {
  const palette = member.gender === 'male'   ? ['#dde7ff', '#3956b8'] :
                  member.gender === 'female' ? ['#ffe0eb', '#b8366a'] :
                                                 ['#e8e2ff', '#5a3eb8'];
  const style: CSSProperties = {
    width: size, height: size,
    background: member.photoUrl ? '#eee' : palette[0],
    color: palette[1],
    fontSize: size * 0.36,
  };
  return (
    <div className="fe-avatar" style={style}>
      {member.photoUrl ? <img src={member.photoUrl} alt={member.name} /> : initials(member.name)}
    </div>
  );
}

// ── MemberCard ───────────────────────────────────────────────────
export type CardSize = 'sm' | 'md' | 'lg';

export function MemberCard({
  member, isFocus, isHighlight, isDim, isMe, size = 'md', onClick, onPointerEnter, onPointerLeave, relationship,
}: {
  member: Member;
  isFocus?: boolean;
  isHighlight?: boolean;
  isDim?: boolean;
  isMe?: boolean;
  size?: CardSize;
  onClick?: (m: Member, e: React.MouseEvent) => void;
  onPointerEnter?: (m: Member) => void;
  onPointerLeave?: (m: Member) => void;
  relationship?: string | null;
}) {
  const dims = {
    sm: { w: 110, pad: 8,  avatar: 30, font: 11.5, sub: 10 },
    md: { w: 160, pad: 12, avatar: 40, font: 13, sub: 11 },
    lg: { w: 200, pad: 16, avatar: 56, font: 15, sub: 12 },
  }[size];

  const classes = ['fe-mc'];
  if (isFocus) classes.push('fe-mc-focus');
  if (isHighlight) classes.push('fe-mc-hl');
  if (isDim) classes.push('fe-mc-dim');
  if (member.gender === 'female') classes.push('fe-mc-f');
  if (member.gender === 'male') classes.push('fe-mc-m');

  return (
    <button
      className={classes.join(' ')}
      style={{ ['--fe-mc-w' as string]: `${dims.w}px`, ['--fe-mc-pad' as string]: `${dims.pad}px` }}
      onClick={(e) => onClick?.(member, e)}
      onPointerEnter={() => onPointerEnter?.(member)}
      onPointerLeave={() => onPointerLeave?.(member)}
    >
      <Avatar member={member} size={dims.avatar} />
      <div className="fe-mc-body">
        <div className="fe-mc-name" style={{ fontSize: dims.font }}>{member.name}</div>
        <div className="fe-mc-sub-row">
          <span className="fe-mc-sub" style={{ fontSize: dims.sub }}>{lifespan(member)}</span>
          {isMe && <span className="fe-me-tag">You</span>}
        </div>
      </div>
      {relationship && <div className="fe-mc-rel-badge">{relationship}</div>}
    </button>
  );
}

// ── ThemeToggle ──────────────────────────────────────────────────
export function ThemeToggle() {
  const { theme, setTheme } = useFamilyExplorerTheme();
  const btnRef = useRef<HTMLButtonElement>(null);
  const onClick = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    const origin = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined;
    setTheme(theme === 'dark' ? 'light' : 'dark', origin);
  };
  return (
    <button ref={btnRef} className="fe-icon-btn" onClick={onClick} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
      {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
    </button>
  );
}

// ── SearchBox ────────────────────────────────────────────────────
export function SearchBox({ members, onSelect }: { members: Member[]; onSelect?: (m: Member) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return members.filter((m) => m.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [q, members]);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, []);

  return (
    <div className="fe-search" ref={wrapRef}>
      <Icons.Search size={16} />
      <input
        type="search"
        value={q}
        placeholder="Search family…"
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHover(0); }}
        onKeyDown={(e) => {
          if (!open || !results.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHover((h) => Math.min(h + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHover((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); onSelect?.(results[hover]); setOpen(false); setQ(''); }
          else if (e.key === 'Escape') { setOpen(false); }
        }}
      />
      {open && results.length > 0 && (
        <div className="fe-search-results">
          {results.map((m, i) => (
            <div
              key={m.id}
              className={'fe-search-result' + (i === hover ? ' is-hover' : '')}
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => { onSelect?.(m); setOpen(false); setQ(''); }}
            >
              <Avatar member={m} size={26} />
              <div>
                <div className="fe-sr-name">{m.name}</div>
                <div className="fe-sr-sub">{lifespan(m)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ProfileModal ─────────────────────────────────────────────────
export function ProfileModal({
  member, adjacency, onClose, onJumpTo,
}: {
  member: Member | null;
  adjacency: Adjacency;
  onClose: () => void;
  onJumpTo?: (m: Member) => void;
}) {
  useEffect(() => {
    if (!member) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [member, onClose]);

  if (!member) return null;

  const parents = adjacency.parents(member.id).map((id) => adjacency.get(id)!).filter(Boolean);
  const partners = adjacency.spouses(member.id).map((s) => ({ m: adjacency.get(s.id)!, status: s.status }));
  const children = adjacency.children(member.id).map((id) => adjacency.get(id)!).filter(Boolean);
  const siblings = adjacency.siblings(member.id).map((id) => adjacency.get(id)!).filter(Boolean);

  const Group = ({ label, people, status }: { label: string; people: Member[]; status?: 'divorced' }) =>
    people.length > 0 ? (
      <div>
        <div className="fe-pm-group-label">{label}</div>
        <div className="fe-pm-people">
          {people.map((p) => (
            <button key={p.id} className={'fe-pm-chip' + (status === 'divorced' ? ' is-ex' : '')} onClick={() => onJumpTo?.(p)}>
              <Avatar member={p} size={22} />
              <span>{p.name}</span>
              {status === 'divorced' && <span className="fe-pm-chip-tag">former</span>}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="fe-pm-backdrop" onClick={onClose}>
      <div className="fe-pm-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={member.name}>
        <button className="fe-pm-close fe-icon-btn" onClick={onClose} aria-label="Close"><Icons.X /></button>
        <div className="fe-pm-head">
          <Avatar member={member} size={84} />
          <div>
            <div className="fe-pm-name">
              {member.name}
              {member.associatedUserId && <span className="fe-me-tag">You</span>}
            </div>
            <div className="fe-pm-sub">
              {member.birthDate && <span><Icons.Calendar size={12} /> {lifespan(member)}</span>}
              {(member as Member & { location?: string }).location && <span><Icons.Map size={12} /> {(member as Member & { location?: string }).location}</span>}
            </div>
          </div>
        </div>
        {member.about && <p className="fe-pm-about">{member.about}</p>}
        <div className="fe-pm-groups">
          <Group label="Partner" people={partners.filter((p) => p.status !== 'divorced').map((p) => p.m)} />
          <Group label="Former partner" people={partners.filter((p) => p.status === 'divorced').map((p) => p.m)} status="divorced" />
          <Group label="Parents" people={parents} />
          <Group label="Siblings" people={siblings} />
          <Group label="Children" people={children} />
        </div>
      </div>
    </div>
  );
}
