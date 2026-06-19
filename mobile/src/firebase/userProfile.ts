// Per-user profile doc: users/{uid}. Distinct from any family member node and
// from the per-user family index (users/{uid}/families/*). Seeded from the
// Google account on first login; the user fills in member-like details + a
// regional-language override. A claimed member can be synced FROM this profile.
import { doc, onSnapshot, setDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './config';
import type { UserProfile } from '../shared/types';

const profileDoc = (uid: string) => doc(db, 'users', uid);

export const subscribeUserProfile = (uid: string, cb: (p: UserProfile | null) => void) =>
  onSnapshot(
    profileDoc(uid),
    (snap) => cb(snap.exists() ? ({ uid: snap.id, ...(snap.data() as Omit<UserProfile, 'uid'>) }) : null),
    (e) => { console.warn('subscribeUserProfile', e?.message ?? e); cb(null); },
  );

export async function updateUserProfile(uid: string, data: Partial<UserProfile>) {
  await setDoc(profileDoc(uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// Replace the user's regional-language dictionary wholesale. updateDoc OVERWRITES
// the relTerms map; setDoc(merge) would deep-merge it and leave stale keys from a
// previously chosen language (which mixed Hindi + Tamil terms together). Falls
// back to setDoc if the profile doc doesn't exist yet.
export async function setRelLanguage(uid: string, relLang: string, relTerms: Record<string, string>) {
  const ref = profileDoc(uid);
  try {
    await updateDoc(ref, { relLang, relTerms, updatedAt: serverTimestamp() });
  } catch {
    await setDoc(ref, { relLang, relTerms, updatedAt: serverTimestamp() }, { merge: true });
  }
}

// Seed the profile from the signed-in account on first login. Idempotent — never
// clobbers fields the user has since edited (only creates when missing).
export async function ensureUserProfile(user: User) {
  const ref = profileDoc(user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    name: user.displayName || (user.email ? user.email.split('@')[0] : 'Me'),
    email: user.email || '',
    photoUrl: user.photoURL || '',
    createdAt: serverTimestamp(),
  }, { merge: true });
}

// Fields that make sense to copy from a user profile onto a family member node
// (the one-way "Sync to member" action). Identity-only fields (email) stay out.
export const PROFILE_TO_MEMBER_FIELDS: (keyof UserProfile)[] = [
  'name', 'photoUrl', 'birthDate', 'gender', 'phone', 'address', 'location', 'occupation', 'about',
];
