// Live inbox for the signed-in user in one tree: notes sent to them + notes they
// sent, newest first, plus an unread count for the Home badge. Scoped to the
// active tree (notes live under trees/{treeId}/notes). Degrades to empty if the
// notes rules aren't deployed.
import { useEffect, useMemo, useState } from 'react';
import { subscribeInbox, subscribeSent } from './firestore';
import type { Note } from '../shared/types';

// serverTimestamp resolves to a Firestore Timestamp; a just-written note has a
// null createdAt until the server ack — treat that as "now" so it sorts on top.
const tsMs = (t: unknown): number => {
  if (t == null) return Number.MAX_SAFE_INTEGER;
  const anyT = t as any;
  if (typeof anyT.toMillis === 'function') return anyT.toMillis();
  if (typeof anyT.seconds === 'number') return anyT.seconds * 1000;
  return 0;
};
const byNewest = (a: Note, b: Note) => tsMs(b.createdAt) - tsMs(a.createdAt);

// Inbox is keyed on the reader's CLAIMED member node (myMemberId): you receive
// notes addressed to your node — the sender doesn't need you to have claimed it,
// but you must claim it ("This is me") to read them. Sent is keyed on uid.
export function useInbox(treeId?: string | null, uid?: string | null, myMemberId?: string | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [sentRaw, setSentRaw] = useState<Note[]>([]);

  useEffect(() => {
    if (!treeId) { setNotes([]); setSentRaw([]); return; }
    const subs: Array<() => void> = [];
    if (myMemberId) subs.push(subscribeInbox(treeId, myMemberId, setNotes)); else setNotes([]);
    if (uid) subs.push(subscribeSent(treeId, uid, setSentRaw)); else setSentRaw([]);
    return () => subs.forEach((u) => u());
  }, [treeId, uid, myMemberId]);

  // Every note the user can see (to-me ∪ from-me), deduped — used to assemble a
  // note's reply thread. The tab lists show only ROOT notes (no rootId).
  const all = useMemo(() => {
    const m = new Map<string, Note>();
    [...notes, ...sentRaw].forEach((n) => m.set(n.id, n));
    return [...m.values()];
  }, [notes, sentRaw]);

  return {
    inbox: notes.filter((n) => !n.rootId).sort(byNewest),
    sent: sentRaw.filter((n) => !n.rootId).sort(byNewest),
    all,
    unread: notes.filter((n) => !n.read).length,
  };
}
