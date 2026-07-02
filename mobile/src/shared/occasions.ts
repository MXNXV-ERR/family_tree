// Family calendar occasions (pure, DOM-free): birthdays from member.birthDate,
// wedding anniversaries from spouse edges carrying a marriageDate, and one-off
// family events (trees/{id}/events). Feeds the CalendarPanel month grid, the
// .ics export (importable into Google Calendar / Apple / Outlook) and the
// per-occasion "Add to Google Calendar" template links.
import type { Member, Relationship, FamilyEvent } from './types';

export type OccasionKind = 'birthday' | 'anniversary' | 'event';

export interface Occasion {
  id: string;
  kind: OccasionKind;
  title: string;
  month: number;          // 0-11, from the anchor date
  day: number;            // 1-31
  annual: boolean;        // birthdays/anniversaries recur yearly; events are one-off
  baseYear?: number;      // original year → powers "turns 34" / "25th anniversary"
  date?: string;          // one-off events: full ISO yyyy-mm-dd
  endDate?: string;       // one-off events: optional range end
  location?: string;
  description?: string;
  memberIds: string[];
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;

function parseISO(iso?: string): { y: number; m: number; d: number } | null {
  const m = ISO.exec((iso ?? '').trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

export function buildOccasions(members: Member[], relationships: Relationship[], events: FamilyEvent[] = []): Occasion[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const out: Occasion[] = [];

  for (const m of members) {
    if (!m.birthDate || m.deathDate) continue; // no birthday entries for the deceased
    const p = parseISO(m.birthDate);
    if (!p) continue;
    out.push({
      id: `bday:${m.id}`, kind: 'birthday', title: `${m.name}'s birthday`,
      month: p.m, day: p.d, annual: true, baseYear: p.y > 1000 ? p.y : undefined, memberIds: [m.id],
    });
  }

  const seen = new Set<string>();
  for (const r of relationships) {
    if (r.type !== 'spouse' || !r.marriageDate || r.status === 'divorced') continue;
    const key = r.fromId < r.toId ? `${r.fromId}|${r.toId}` : `${r.toId}|${r.fromId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const a = byId.get(r.fromId), b = byId.get(r.toId);
    if (!a || !b || a.deathDate || b.deathDate) continue;
    const p = parseISO(r.marriageDate);
    if (!p) continue;
    out.push({
      id: `anniv:${key}`, kind: 'anniversary', title: `${a.name} & ${b.name} — anniversary`,
      month: p.m, day: p.d, annual: true, baseYear: p.y > 1000 ? p.y : undefined, memberIds: [a.id, b.id],
    });
  }

  for (const ev of events) {
    const p = parseISO(ev.date);
    if (!p) continue;
    out.push({
      id: `event:${ev.id}`, kind: 'event', title: ev.title,
      month: p.m, day: p.d, annual: false, date: ev.date.slice(0, 10), endDate: ev.endDate?.slice(0, 10),
      location: ev.location, description: ev.description, memberIds: ev.memberIds ?? [],
    });
  }

  return out;
}

// Occasions landing in a specific calendar month. Annual entries map to every
// year (29 Feb shows on 28 Feb in non-leap years, like the reminders do);
// one-off events only appear in their own month + year.
export function occasionsInMonth(occasions: Occasion[], year: number, month: number): { occ: Occasion; day: number; years?: number }[] {
  const out: { occ: Occasion; day: number; years?: number }[] = [];
  for (const occ of occasions) {
    if (occ.annual) {
      if (occ.month !== month) continue;
      let day = occ.day;
      const probe = new Date(year, month, day);
      if (probe.getMonth() !== month) day = new Date(year, month + 1, 0).getDate(); // 29 Feb → last day of Feb
      const years = occ.baseYear !== undefined ? year - occ.baseYear : undefined;
      out.push({ occ, day, years: years !== undefined && years > 0 ? years : undefined });
    } else {
      const p = parseISO(occ.date);
      if (!p || p.y !== year || p.m !== month) continue;
      out.push({ occ, day: p.d });
    }
  }
  return out.sort((a, b) => a.day - b.day || a.occ.title.localeCompare(b.occ.title));
}

// Next occurrence on/after `from` — for the Google quick-add year.
export function nextOccurrenceOf(occ: Occasion, from = new Date()): Date {
  if (!occ.annual) {
    const p = parseISO(occ.date)!;
    return new Date(p.y, p.m, p.d);
  }
  for (let y = from.getFullYear(); ; y++) {
    let d = new Date(y, occ.month, occ.day);
    if (d.getMonth() !== occ.month) d = new Date(y, occ.month + 1, 0);
    if (d.getTime() >= new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) return d;
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const ymdOf = (d: Date) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
const plusDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const isoToDate = (iso: string) => { const p = parseISO(iso)!; return new Date(p.y, p.m, p.d); };

const KIND_EMOJI: Record<OccasionKind, string> = { birthday: '🎂', anniversary: '💍', event: '📅' };

// "Add to Google Calendar" template link (all-day; annual entries repeat
// yearly). Query built by hand — RN's URLSearchParams is unreliable.
export function googleCalendarUrl(occ: Occasion, from = new Date()): string {
  const start = nextOccurrenceOf(occ, from);
  const end = occ.endDate ? plusDays(isoToDate(occ.endDate), 1) : plusDays(start, 1); // end date exclusive
  const details = occ.description
    || (occ.kind === 'birthday' ? 'Birthday — from your family tree.'
      : occ.kind === 'anniversary' ? 'Wedding anniversary — from your family tree.'
      : 'Family event — from your family tree.');
  const parts = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(`${KIND_EMOJI[occ.kind]} ${occ.title}`)}`,
    `dates=${ymdOf(start)}/${ymdOf(end)}`,
    `details=${encodeURIComponent(details)}`,
  ];
  if (occ.location) parts.push(`location=${encodeURIComponent(occ.location)}`);
  if (occ.annual) parts.push(`recur=${encodeURIComponent('RRULE:FREQ=YEARLY')}`);
  return `https://calendar.google.com/calendar/render?${parts.join('&')}`;
}

const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Whole-calendar .ics: import once in Google Calendar (Settings → Import & export)
// or open with any calendar app. Annual occasions carry RRULE:FREQ=YEARLY.
export function buildICS(occasions: Occasion[], calendarName: string, now = new Date()): string {
  const stamp = `${ymdOf(now)}T${pad2(now.getHours())}${pad2(now.getMinutes())}00`;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Family Tree//Occasions//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];
  for (const occ of occasions) {
    // Anchor annual entries at the original year when it's real, else the next
    // occurrence — Google renders the series either way.
    const start = occ.annual && occ.baseYear && occ.baseYear > 1800
      ? new Date(occ.baseYear, occ.month, occ.day)
      : nextOccurrenceOf(occ, now);
    const end = occ.endDate ? plusDays(isoToDate(occ.endDate), 1) : plusDays(start, 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${occ.id.replace(/[^A-Za-z0-9:|-]/g, '')}@family-tree`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymdOf(start)}`,
      `DTEND;VALUE=DATE:${ymdOf(end)}`,
      `SUMMARY:${icsEscape(`${KIND_EMOJI[occ.kind]} ${occ.title}`)}`,
    );
    if (occ.annual) lines.push('RRULE:FREQ=YEARLY');
    if (occ.location) lines.push(`LOCATION:${icsEscape(occ.location)}`);
    if (occ.description) lines.push(`DESCRIPTION:${icsEscape(occ.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
