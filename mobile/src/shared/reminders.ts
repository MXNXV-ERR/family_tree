// Reminder occurrences (pure, DOM-free): upcoming birthdays from
// member.birthDate and wedding anniversaries from spouse edges carrying a
// marriageDate. The platform scheduler (src/notifications) turns these into
// local notifications; the pure part is unit-testable and web-safe.
import type { Member, Relationship } from './types';

export interface Reminder {
  id: string;                       // stable: bday:<memberId> | anniv:<a|b>
  kind: 'birthday' | 'anniversary';
  title: string;
  body: string;
  date: Date;                       // next occurrence, at `hour` local time
  memberIds: string[];
}

const MS_DAY = 86400000;

// Next occurrence of a MM-DD after `from` (handles 29 Feb → 1 Mar on
// non-leap years, and "today counts as upcoming").
function nextOccurrence(isoDate: string, from: Date, hour: number): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!m) return null;
  const month = Number(m[2]) - 1, day = Number(m[3]);
  for (let y = from.getFullYear(); y <= from.getFullYear() + 1; y++) {
    const d = new Date(y, month, day, hour, 0, 0, 0);
    if (d.getMonth() !== month) d.setDate(0); // 29 Feb on a non-leap year → 28 Feb… then bump:
    if (d.getTime() >= from.getTime()) return d;
  }
  return null;
}

const yearsSince = (iso: string, at: Date) => {
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? at.getFullYear() - y : undefined;
};

// All reminders inside the next `windowDays`, soonest first.
export function upcomingReminders(
  members: Member[], relationships: Relationship[],
  opts: { windowDays?: number; hour?: number; now?: Date } = {},
): Reminder[] {
  const now = opts.now ?? new Date();
  const windowDays = opts.windowDays ?? 365;
  const hour = opts.hour ?? 9;
  const horizon = now.getTime() + windowDays * MS_DAY;
  const byId = new Map(members.map((m) => [m.id, m]));
  const out: Reminder[] = [];

  for (const m of members) {
    if (!m.birthDate || m.deathDate) continue; // no birthday pings for the deceased
    const d = nextOccurrence(m.birthDate, now, hour);
    if (!d || d.getTime() > horizon) continue;
    const age = yearsSince(m.birthDate, d);
    out.push({
      id: `bday:${m.id}`, kind: 'birthday', date: d, memberIds: [m.id],
      title: `🎂 ${m.name}'s birthday`,
      body: age !== undefined && age > 0 ? `${m.name} turns ${age} today.` : `It's ${m.name}'s birthday today.`,
    });
  }

  const seen = new Set<string>();
  for (const r of relationships) {
    if (r.type !== 'spouse' || !r.marriageDate) continue;
    if (r.status === 'divorced') continue;
    const key = r.fromId < r.toId ? `${r.fromId}|${r.toId}` : `${r.toId}|${r.fromId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const a = byId.get(r.fromId), b = byId.get(r.toId);
    if (!a || !b || a.deathDate || b.deathDate) continue;
    const d = nextOccurrence(r.marriageDate, now, hour);
    if (!d || d.getTime() > horizon) continue;
    const yrs = yearsSince(r.marriageDate, d);
    out.push({
      id: `anniv:${key}`, kind: 'anniversary', date: d, memberIds: [a.id, b.id],
      title: `💍 ${a.name} & ${b.name}`,
      body: yrs !== undefined && yrs > 0 ? `Their ${yrs}${ordSuffix(yrs)} wedding anniversary is today.` : 'Their wedding anniversary is today.',
    });
  }

  return out.sort((x, y) => x.date.getTime() - y.date.getTime());
}

const ordSuffix = (n: number) => {
  const t = n % 10, h = n % 100;
  if (t === 1 && h !== 11) return 'st';
  if (t === 2 && h !== 12) return 'nd';
  if (t === 3 && h !== 13) return 'rd';
  return 'th';
};
