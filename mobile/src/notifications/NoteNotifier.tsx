// Mounted once (in the root NavShell). Fires a local OS notification when a note
// arrives for the signed-in user's claimed node while the app is running.
// Native-only (foreground delivery); a closed app needs push (FCM), out of scope.
import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../firebase/AuthContext';
import { useFamily } from '../firebase/FamilyContext';
import { useFamilyTree } from '../firebase/useFamilyTree';
import { subscribeInbox } from '../firebase/firestore';
import { myMemberId } from '../shared/permissions';
import { remindersSupported, presentNoteNotification } from './reminders';
import type { Note } from '../shared/types';

export function NoteNotifier() {
  const { user } = useAuth();
  const { activeTreeId } = useFamily();
  const { members } = useFamilyTree(activeTreeId);
  const myId = useMemo(() => myMemberId(members, user?.uid), [members, user]);
  // null = baseline not captured yet (first snapshot is the existing backlog, no
  // notification); afterwards, any id not in the set is a genuinely new note.
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!remindersSupported || !activeTreeId || !myId) return;
    seen.current = null;
    const unsub = subscribeInbox(activeTreeId, myId, (notes: Note[]) => {
      if (seen.current === null) { seen.current = new Set(notes.map((n) => n.id)); return; }
      for (const n of notes) {
        if (seen.current.has(n.id)) continue;
        seen.current.add(n.id);
        if (n.fromUid === user?.uid) continue; // never notify for my own note
        const title = n.fromName ? `Note from ${n.fromName}` : 'New note';
        const body = n.text ? n.text.slice(0, 140) : (n.image ? 'Sent you a photo' : 'You have a new note');
        presentNoteNotification(title, body);
      }
    });
    return () => unsub();
  }, [activeTreeId, myId, user?.uid]);

  return null;
}
