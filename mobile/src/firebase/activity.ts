// Lightweight who-changed-what trail (trees/{treeId}/activity). Entries are
// append-only best-effort: every write is fire-and-forget and swallows errors,
// so the app degrades cleanly until the activity rules are deployed.
import {
  collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './config';

export interface ActivityEntry {
  id: string;
  uid: string;
  email?: string;
  action: string;    // e.g. "added", "updated", "removed", "linked", "imported"
  detail?: string;   // e.g. the member's name
  at?: { seconds: number; nanoseconds: number } | null;
}

const activityCol = (treeId: string) => collection(db, 'trees', treeId, 'activity');

export function logActivity(treeId: string | null | undefined, action: string, detail?: string) {
  const u = auth.currentUser;
  if (!u || !treeId) return;
  addDoc(activityCol(treeId), {
    uid: u.uid,
    email: u.email ?? '',
    action,
    ...(detail ? { detail } : {}),
    at: serverTimestamp(),
  }).catch(() => { /* rules not deployed yet / offline — trail is best-effort */ });
}

export const subscribeActivity = (treeId: string, cb: (entries: ActivityEntry[]) => void) =>
  onSnapshot(
    query(activityCol(treeId), orderBy('at', 'desc'), limit(30)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityEntry, 'id'>) }))),
    () => cb([]), // no rules yet → treat as empty, the panel hides the section
  );

// "5m ago" — tiny relative formatter for the panel rows.
export function timeAgo(at?: ActivityEntry['at']): string {
  if (!at?.seconds) return '';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - at.seconds));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / (86400 * 30))}mo ago`;
}
