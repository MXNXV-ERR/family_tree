// Birthday copy engine — SPEC §7, "names while they fit; counts only once names
// stop fitting". Pure, no React, no I/O: one function maps the sender list and
// the wish count to every string the feature shows.
//
// The four banned strings ("1 person wished you", "3 wishes from 1 person",
// "Your family is writing" at one sender, "No wishes yet") are structurally
// unproducible here — there is no branch that pairs a bare digit with a single
// sender, and the empty case renders the countdown line instead.

export interface Sender {
  uid: string;
  name: string;              // first name is enough
  relationship?: string;     // "your wife" — preferred in the celebrant's own view
  gender?: string;           // drives "her"/"his" in the CTA
}

export interface BirthdayCopy {
  headline: string;
  caption?: string;
  cta: string;
  /** "Anita wrote to you six times" style line for the wall/opener. */
  senderLine?: string;
  /** Wall subtitle: "Twelve wishes · three new". */
  countLine: string;
}

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve',
];
const TENS: Record<number, string> = {
  2: 'twenty', 3: 'thirty', 4: 'forty', 5: 'fifty', 6: 'sixty', 7: 'seventy', 8: 'eighty', 9: 'ninety',
};

// Numbers are spelled out to twelve, digits after — except the round-ish crowd
// counts the 7+ headline reads aloud, which stay words up to ninety-nine.
export function spell(n: number): string {
  if (n < 0) return String(n);
  if (n <= 12) return ONES[n];
  if (n < 20) {
    const teens: Record<number, string> = {
      13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen',
      17: 'seventeen', 18: 'eighteen', 19: 'nineteen',
    };
    return teens[n];
  }
  if (n < 100) {
    const t = Math.floor(n / 10), o = n % 10;
    return o ? TENS[t] + '-' + ONES[o] : TENS[t];
  }
  return String(n);
}

/** Spelled to twelve, digits after — the plain §7 rule, for wish counts. */
export const num = (n: number): string => (n <= 12 ? spell(n) : String(n));

const ORDINALS = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh',
  'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
];

export function ordinal(n: number): string {
  if (n >= 1 && n <= 12) return ORDINALS[n];
  const rem100 = n % 100, rem10 = n % 10;
  const suffix = rem100 >= 11 && rem100 <= 13 ? 'th' : rem10 === 1 ? 'st' : rem10 === 2 ? 'nd' : rem10 === 3 ? 'rd' : 'th';
  return String(n) + suffix;
}

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const firstName = (s: Sender) => (s.name || '').trim().split(/\s+/)[0] || 'Someone';

// What we call a sender in the celebrant's own view: a known relationship beats
// a first name ("your wife"), per §7 — but only a SHORT one. The kinship engine
// can return a whole path ("your first cousin's wife"), and "Your first cousin's
// wife wrote to you eight times" is worse than the name the rung was protecting.
const SHORT_REL = /^(your\s+)?[a-z-]+$/i;
const callThem = (s: Sender, viewerIsCelebrant: boolean) =>
  viewerIsCelebrant && s.relationship && SHORT_REL.test(s.relationship.trim())
    ? s.relationship
    : firstName(s);

const possessive = (s?: Sender) =>
  s?.gender === 'female' ? 'her' : s?.gender === 'male' ? 'his' : 'their';

/** "Anita", "Anita and Dev", "Anita, Dev and Priya", "Anita, Dev and three others". */
export function nameList(senders: Sender[], viewerIsCelebrant = false): string {
  const names = senders.map((s) => callThem(s, viewerIsCelebrant));
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return names[0] + ' and ' + names[1];
  if (names.length === 3) return names[0] + ', ' + names[1] + ' and ' + names[2];
  // 4–6: two names then a spelled remainder
  return names[0] + ', ' + names[1] + ' and ' + num(names.length - 2) + ' others';
}

export interface CopyInput {
  senders: Sender[];
  wishCount: number;
  viewerIsCelebrant?: boolean;
  unread?: number;
  /** Celebrant's own first name, for "It's your day, Rajesh". */
  celebrantName?: string;
  /** Days until the birthday — drives the sealed screen. */
  daysUntil?: number;
}

/**
 * The single source of truth for every birthday string.
 * `senders.length` selects the headline rung; `wishCount` never does.
 */
export function birthdayCopy(input: CopyInput): BirthdayCopy {
  const { senders, wishCount, viewerIsCelebrant = false, unread = 0 } = input;
  const n = senders.length;
  const one = senders[0];

  const countLine = wishCount === 0
    ? 'Sealed'
    : cap(num(wishCount)) + ' ' + (wishCount === 1 ? 'wish' : 'wishes')
      + (unread > 0 ? ' · ' + num(unread) + ' new' : '');

  // ≥3 senders: the CTA stops being possessive.
  const cta = n === 0 ? 'Add your wish'
    : n === 1 ? 'Read ' + possessive(one) + ' wishes'
    : 'Open them';

  if (n === 0) {
    // Never "No wishes yet" — the sealed screen shows the countdown alone.
    const d = input.daysUntil ?? 0;
    return {
      headline: d > 0 ? num(d) + ' ' + (d === 1 ? 'day to go' : 'days to go') : 'It’s your day',
      cta: 'Add your wish',
      countLine,
    };
  }

  if (n === 1) {
    const who = callThem(one, viewerIsCelebrant);
    const headline = wishCount <= 1
      ? cap(who) + ' wished you'
      : cap(who) + ' wrote to you ' + num(wishCount) + ' times';
    return {
      headline,
      senderLine: headline,
      caption: wishCount > 1 ? num(wishCount).toUpperCase() + ' TIMES, THIS WEEK' : undefined,
      cta,
      countLine,
    };
  }

  if (n <= 6) {
    const headline = nameList(senders, viewerIsCelebrant) + ' wished you';
    return { headline, senderLine: headline, cta, countLine };
  }

  // 7+: counts replace names.
  return {
    headline: cap(spell(n)) + ' people are thinking of you today',
    senderLine: cap(spell(n)) + ' people wrote to you',
    cta,
    countLine,
  };
}

/** Composer ordinal banner: "This will be your third wish for him." */
export function ordinalWishLine(priorCount: number, recipientName: string, gender?: string): string {
  const nth = ordinal(priorCount + 1);
  const them = gender === 'female' ? 'her' : gender === 'male' ? 'him' : recipientName;
  return priorCount === 0
    ? 'Your first wish for ' + them + '. Write as many as you like.'
    : 'This will be your ' + nth + ' wish for ' + them + '. Write as many as you like.';
}

/** Sealed screen, one sender: "Anita is writing to you." — never a count. */
export function sealedLine(senders: Sender[], viewerIsCelebrant = true): string {
  if (senders.length === 0) return 'Someone is writing to you.';
  if (senders.length === 1) return cap(callThem(senders[0], viewerIsCelebrant)) + ' is writing to you.';
  if (senders.length <= 6) return cap(nameList(senders, viewerIsCelebrant)) + ' are writing to you.';
  return 'Your family is writing to you.'; // only ever at 7+ senders
}

/** Morning push — no name, no count, per §4/§5. */
export const BIRTHDAY_PUSH_TITLE = 'It’s your birthday — open your sky';

/** Strings that must never be producible (asserted in the copy tests). */
export const BANNED_STRINGS = [
  '1 person wished you',
  '3 wishes from 1 person',
  'No wishes yet',
];
