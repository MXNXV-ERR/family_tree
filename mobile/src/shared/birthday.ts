// Birthday celebration — pure domain layer (DOM-free, no React).
//
// A "wish" is a Note carrying a `wish` block (see types.ts): wishes live in the
// same trees/{treeId}/notes collection as ordinary notes, so replies, reactions
// and the existing security rules all keep working unchanged.
//
// Two rules from the spec shape everything here:
//   1. Counting is per WISH, never per person. `senderCount` feeds copy only;
//      `wishCount` feeds the geometry (one link + one token per wish).
//   2. `seededPos` is a stable scatter — unequal radii and angles, never a ring —
//      so a member's sky is always their sky.
import type { Member, Note } from './types';

export const WINDOW_DAYS = 7; // orb opens 7 days before, closes 7 days after

// ---- dates ---------------------------------------------------------------

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const DAY_MS = 86_400_000;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function parseISO(iso?: string): { y: number; m: number; d: number } | null {
  const m = ISO.exec((iso ?? '').trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

// The birthday's occurrence in a given calendar year (29 Feb → 28 Feb).
function occurrenceIn(year: number, month: number, day: number): Date {
  const d = new Date(year, month, day);
  if (d.getMonth() !== month) return new Date(year, month + 1, 0);
  return d;
}

export interface BirthdayWindow {
  memberId: string;
  date: Date;        // the birthday itself, this cycle
  year: number;      // calendar year of `date` — the wish bucket key
  opensAt: Date;     // date − 7d
  closesAt: Date;    // date + 7d
  isToday: boolean;
  daysUntil: number; // negative once the day has passed
  turning?: number;  // age reached on `date`, when the birth year is known
}

// The window a member is currently inside, or null. Checks the neighbouring
// years too so a window spanning New Year still resolves.
export function windowFor(m: Member, now = new Date()): BirthdayWindow | null {
  if (!m.birthDate || m.deathDate) return null;
  const p = parseISO(m.birthDate);
  if (!p) return null;
  const today = startOfDay(now);
  for (const y of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
    const date = occurrenceIn(y, p.m, p.d);
    const opensAt = new Date(date.getTime() - WINDOW_DAYS * DAY_MS);
    const closesAt = new Date(date.getTime() + WINDOW_DAYS * DAY_MS);
    if (today < opensAt || today > closesAt) continue;
    const daysUntil = Math.round((date.getTime() - today.getTime()) / DAY_MS);
    return {
      memberId: m.id, date, year: y, opensAt, closesAt,
      isToday: daysUntil === 0,
      daysUntil,
      turning: p.y > 1000 ? y - p.y : undefined,
    };
  }
  return null;
}

// Every member currently in window, soonest first.
export function openWindows(members: Member[], now = new Date()): BirthdayWindow[] {
  return members
    .map((m) => windowFor(m, now))
    .filter((w): w is BirthdayWindow => !!w)
    .sort((a, b) => Math.abs(a.daysUntil) - Math.abs(b.daysUntil));
}

// Celebrants whose birthday is TODAY (drives the orb-tap picker).
export const celebrantsToday = (members: Member[], now = new Date()) =>
  openWindows(members, now).filter((w) => w.isToday);

// ---- wish selectors ------------------------------------------------------

export const isWish = (n: Note): boolean => !!n.wish && !n.rootId;

export const tsMs = (t: unknown): number => {
  if (t == null) return Date.now();
  const any = t as any;
  if (typeof any === 'number') return any;
  if (typeof any.toMillis === 'function') return any.toMillis();
  if (typeof any.seconds === 'number') return any.seconds * 1000;
  return 0;
};

export const byOldest = (a: Note, b: Note) => tsMs(a.createdAt) - tsMs(b.createdAt);

// Every wish for one member's birthday cycle, oldest first — the order tokens
// are seeded in and the "already written by you" list is shown in.
export function wishesFor(notes: Note[], memberId: string, year: number): Note[] {
  return notes
    .filter((n) => isWish(n) && n.toMemberId === memberId && n.wish!.year === year)
    .sort(byOldest);
}

export const myWishesFor = (notes: Note[], memberId: string, year: number, uid?: string | null) =>
  uid ? wishesFor(notes, memberId, year).filter((n) => n.fromUid === uid) : [];

// senderCount drives COPY ONLY — never geometry.
export const senderCount = (wishes: Note[]) => new Set(wishes.map((w) => w.fromUid)).size;
export const wishCount = (wishes: Note[]) => wishes.length;

export const isRead = (w: Note) => !!w.readAt || !!w.read;
export const unreadCount = (wishes: Note[]) => wishes.filter((w) => !isRead(w)).length;

export const mediaKind = (w: Note): 'none' | 'photo' | 'video' =>
  w.wish?.media === 'video' && w.wish?.videoUrl ? 'video' : w.image ? 'photo' : 'none';

// A wish is sealed while the celebrant may not read it: always before the day,
// and afterwards only for wishes written after the day began (so the reveal
// feeling repeats through the back half of the window) until they're opened.
export function isSealed(w: Note, win: BirthdayWindow, now = new Date()): boolean {
  if (startOfDay(now) < startOfDay(win.date)) return true;
  if (isRead(w)) return false;
  return tsMs(w.createdAt) >= win.date.getTime();
}

// ---- seeded scatter ------------------------------------------------------

// FNV-1a — small, stable, and identical on every platform.
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Deterministic [0,1) stream off one id, so each wish gets several stable rolls.
const roll = (id: string, salt: number) => (hashId(id + '#' + salt) % 100000) / 100000;

export interface SkyFrame { w: number; h: number; hubX: number; hubY: number }
export const DEFAULT_FRAME: SkyFrame = { w: 390, h: 844, hubX: 195, hubY: 430 };

export interface SeededToken { id: string; x: number; y: number; r: number; angle: number }

// Vertical crowding costs more than horizontal: a token's caption hangs below
// it, so the same gap that looks clean left-to-right reads as an overlap when
// one token sits above another.
const V_SQUASH = 1.3;

// Stable scattered positions — unequal radii AND unequal angles, never a ring.
// The angle is the golden-angle sequence jittered per id (so ids never queue up
// evenly) and the radius rolls across three unequal bands. A few relaxation
// passes push overlapping tokens apart while keeping each near its seed.
export function seededPositions(
  ids: string[],
  frame: SkyFrame = DEFAULT_FRAME,
  opts: { minSep?: number; margin?: number; top?: number; bottom?: number; hubKeep?: number } = {},
): SeededToken[] {
  // The LABEL is the widest part of a token (~84px), so the centre has to stay
  // a half-label plus a gutter away from the frame edge or the caption clips.
  const margin = opts.margin ?? 72;
  // Bands the scatter must stay out of: the header + celebration copy at the
  // top, and the CTA / FAB / nav at the bottom.
  const top = opts.top ?? margin + 46;
  const bottom = opts.bottom ?? frame.h - margin - 96;
  const maxR = Math.min(frame.w, frame.h * 0.62) * 0.52;
  // Keep-out around the hub. The hub is 88px across and an unread media token
  // 64px, so 44 + 32 only just stops them intersecting — and the hub also
  // carries a ring and a wide glow, which is why the old 96px read as tokens
  // sitting ON the celebrant. 132 leaves a clear dark gap at every size. A
  // small frame (the ~420px archive panel) can't spend that much of its
  // radius, so the keep-out caps at a share of it.
  const hubKeep = Math.min(opts.hubKeep ?? 132, maxR * 0.62);
  // Labels collide before tokens do (~92px apart). In a small frame that
  // separation is unreachable and only piles every token onto the margins, so
  // it eases down with the frame.
  const minSep = opts.minSep ?? Math.max(78, Math.min(92, maxR * 0.44));
  // Radii are seeded INSIDE the ring, never from the hub outward — the old
  // `maxR * band` put the whole inner band under the keep-out, where every
  // token was then pushed onto the same correction circle.
  const span = Math.max(28, maxR - hubKeep);

  const out: SeededToken[] = ids.map((id, i) => {
    // 137.508° golden angle keeps successive wishes far apart; the ±34° jitter
    // breaks the residual regularity so no arrangement ever reads as a ring.
    const angle = (i * 137.508 + roll(id, 1) * 68 - 34) * (Math.PI / 180);
    const band = [0.12, 0.5, 0.94][hashId(id + '#band') % 3];
    const t = Math.min(1, band * (0.86 + roll(id, 2) * 0.28));
    const r = hubKeep + span * t;
    return { id, angle, r, x: frame.hubX + Math.cos(angle) * r, y: frame.hubY + Math.sin(angle) * r * 1.22 };
  });

  const clamp = (t: SeededToken) => {
    t.x = Math.max(margin, Math.min(frame.w - margin, t.x));
    t.y = Math.max(top, Math.min(bottom, t.y));
  };
  // Push a token back out of the keep-out. Clamping can shove it straight back
  // in when the frame band is thin, so the fallback slides it sideways along
  // the ring instead of leaving it on the celebrant.
  const offHub = (t: SeededToken) => {
    const dx = t.x - frame.hubX, dy = t.y - frame.hubY;
    const d = Math.hypot(dx, dy);
    if (d >= hubKeep) return;
    const ux = d < 0.5 ? Math.cos(t.angle) : dx / d;
    const uy = d < 0.5 ? Math.sin(t.angle) : dy / d;
    t.x = frame.hubX + ux * hubKeep;
    t.y = frame.hubY + uy * hubKeep;
    clamp(t);
    if (Math.hypot(t.x - frame.hubX, t.y - frame.hubY) >= hubKeep) return;
    const side = t.x >= frame.hubX ? 1 : -1;
    const vy = t.y - frame.hubY;
    const need = Math.sqrt(Math.max(1, hubKeep * hubKeep - vy * vy));
    t.x = Math.max(margin, Math.min(frame.w - margin, frame.hubX + side * need));
    const gotX = t.x - frame.hubX;
    if (Math.abs(gotX) >= need - 0.001) return;
    // The margin ate the sideways room, so buy the distance vertically instead.
    const needY = Math.sqrt(Math.max(1, hubKeep * hubKeep - gotX * gotX));
    const dir = vy >= 0 ? 1 : -1;
    t.y = Math.max(top, Math.min(bottom, frame.hubY + dir * needY));
    if (Math.hypot(t.x - frame.hubX, t.y - frame.hubY) < hubKeep) {
      t.y = Math.max(top, Math.min(bottom, frame.hubY - dir * needY));
    }
  };
  out.forEach((t) => { clamp(t); offHub(t); });

  for (let pass = 0; pass < 14; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        // Every token carries its caption UNDER it, so two tokens stacked
        // vertically collide (caption into token) at a distance that reads
        // fine side by side. The separation test is elliptical for that.
        const d = Math.hypot(dx, dy * V_SQUASH) || 0.001;
        if (d >= minSep) continue;
        const push = (minSep - d) / 2;
        const ux = dx / d, uy = (dy * V_SQUASH) / d;
        a.x -= ux * push; a.y -= (uy * push) / V_SQUASH;
        b.x += ux * push; b.y += (uy * push) / V_SQUASH;
        clamp(a); clamp(b);
        moved = true;
      }
    }
    // Enforce the keep-out AFTER the whole pass: a pair push late in the pass
    // used to be able to shove a corrected token back onto the hub, and the
    // loop would then exit with it there.
    out.forEach(offHub);
    if (!moved) break;
  }
  out.forEach((t) => { clamp(t); offHub(t); });
  return out;
}

export const seededPos = (id: string, ids: string[], frame?: SkyFrame): SeededToken => {
  const f = frame ?? DEFAULT_FRAME;
  return seededPositions(ids, f).find((t) => t.id === id) ?? { id, x: f.hubX, y: f.hubY, r: 0, angle: 0 };
};

// Spec §2: cap at twelve links; the remainder collapse into one "+n" node.
export const LINK_CAP = 12;
export function capWishes<T>(wishes: T[]): { shown: T[]; overflow: T[] } {
  if (wishes.length <= LINK_CAP) return { shown: wishes, overflow: [] };
  return { shown: wishes.slice(0, LINK_CAP), overflow: wishes.slice(LINK_CAP) };
}
