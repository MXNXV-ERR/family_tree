// Glue between the tree data and the birthday copy engine: turns the wishes on
// a celebrant's sky into the ordered Sender list §7 needs (first name, known
// relationship, gender), deduped by uid in the order they first wrote.
import { relToMe } from '../shared/relationTo';
import { tsMs } from '../shared/birthday';
import type { Sender } from '../shared/birthdayCopy';
import type { Member, Note, Relationship } from '../shared/types';

export function buildSenders(
  wishes: Note[],
  members: Member[],
  relationships: Relationship[],
  celebrantId: string,
): Sender[] {
  const byUid = new Map<string, Member>();
  members.forEach((m) => { if (m.associatedUserId) byUid.set(m.associatedUserId, m); });

  const seen = new Map<string, Sender>();
  [...wishes].sort((a, b) => tsMs(a.createdAt) - tsMs(b.createdAt)).forEach((w) => {
    if (seen.has(w.fromUid)) return;
    const m = w.fromMemberId ? members.find((x) => x.id === w.fromMemberId) : byUid.get(w.fromUid);
    // Relationship is computed FROM the celebrant's side — "your wife" is only
    // correct in the celebrant's own view, and the copy engine gates on that.
    const rel = m ? relToMe(members, relationships, m.id, celebrantId) : undefined;
    seen.set(w.fromUid, {
      uid: w.fromUid,
      name: m?.name || w.fromName || 'Someone',
      relationship: rel && rel !== 'You' ? rel.toLowerCase() : undefined,
      gender: m?.gender,
    });
  });
  return [...seen.values()];
}

/** The member behind a wish's sender uid, for avatars and token badges. */
export function senderMember(w: Note, members: Member[]): Member | undefined {
  if (w.fromMemberId) {
    const m = members.find((x) => x.id === w.fromMemberId);
    if (m) return m;
  }
  return members.find((x) => x.associatedUserId === w.fromUid);
}

const REL_WORDS = /^(your\s+)?/i;
/** "your wife" → "Wife", for the polaroid footer. */
export const relChip = (rel?: string) => (rel ? rel.replace(REL_WORDS, '').replace(/^./, (s) => s.toUpperCase()) : undefined);

/** "Yesterday" / "Monday" / a date — the paper's "relationship · when" line. */
export function whenWord(t: unknown): string {
  const ms = tsMs(t);
  const d = new Date(ms);
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString();
}
