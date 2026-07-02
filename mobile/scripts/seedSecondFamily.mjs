// Seed a SECOND family ("Rao Family" — Priya's side) and a MASTER that combines
// it with the Mehta primary tree, bridged on Priya (she appears in both trees).
// Lets you exercise the Master Families (combined) view end-to-end.
//
// NON-destructive to Mehta: it only READS Mehta to find Priya, then creates a
// brand-new Rao tree + a master. Safe to re-run guard: refuses if a Rao Family
// already exists for this user (so you don't pile up duplicates).
//
// Run:  node scripts/seedSecondFamily.mjs --yes
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, collection, getDocs, query, where, writeBatch, doc, setDoc, serverTimestamp,
} from 'firebase/firestore';

if (!process.argv.includes('--yes')) { console.log('Refusing to run without --yes.'); process.exit(1); }

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const cfg = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
const EMAIL = 'jatin75b@gmail.com', PASS = 'password';

// Rao family (Priya's side). `raoPriya` is the SAME person as Mehta's Priya —
// the master bridges them so the two trees join at her.
const people = [
  { id: 'raoPriya', name: 'Priya Mehta', gender: 'female', birthDate: '1978-03-27', maidenName: 'Rao', occupation: 'Montessori teacher', location: 'Bangalore' },
  { id: 'venkat', name: 'Venkat Rao', gender: 'male', birthDate: '1950-06-11', occupation: 'Professor of physics', placeOfBirth: 'Bangalore', location: 'Bangalore' },
  { id: 'saroj', name: 'Sarojini Rao', gender: 'female', birthDate: '1953-02-19', maidenName: 'Hegde', occupation: 'Classical singer', location: 'Bangalore' },
  { id: 'kiran', name: 'Kiran Rao', gender: 'male', birthDate: '1975-11-30', occupation: 'Orthopaedic surgeon', location: 'Mysore' },
  { id: 'meena', name: 'Meena Rao', gender: 'female', birthDate: '1979-04-08', maidenName: 'Shetty', occupation: 'Physiotherapist', location: 'Mysore' },
  { id: 'aditi', name: 'Aditi Rao', gender: 'female', birthDate: '2007-09-12', occupation: 'Student', location: 'Mysore' },
  { id: 'anilr', name: 'Anil Rao', gender: 'male', birthDate: '1922-01-15', deathDate: '2004-08-04', occupation: 'Freedom-era teacher', placeOfBirth: 'Bangalore' },
  { id: 'lakshmir', name: 'Lakshmi Rao', gender: 'female', birthDate: '1926-10-05', deathDate: '2010-12-19', maidenName: 'Iyengar', occupation: 'Homemaker' },
];
const parents = [
  ['raoPriya', 'venkat'], ['raoPriya', 'saroj'],
  ['kiran', 'venkat'], ['kiran', 'saroj'],
  ['venkat', 'anilr'], ['venkat', 'lakshmir'],
  ['aditi', 'kiran'], ['aditi', 'meena'],
];
const spouses = [['venkat', 'saroj'], ['anilr', 'lakshmir'], ['kiran', 'meena']];

const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

const cred = await signInWithEmailAndPassword(auth, EMAIL, PASS);
const uid = cred.user.uid;
console.log('signed in as', uid);

// Guard: don't create a second Rao Family if one already exists for this user.
const existing = await getDocs(query(collection(db, 'trees'), where('ownerUid', '==', uid)));
if (existing.docs.some((d) => (d.data().name || '') === 'Rao Family')) {
  console.log('A "Rao Family" already exists for this user — aborting to avoid duplicates.');
  process.exit(0);
}

// Find Priya in the Mehta tree (treeId === uid) to bridge on her.
const mehtaMembers = await getDocs(collection(db, 'trees', uid, 'members'));
const mehtaPriya = mehtaMembers.docs.find((d) => (d.data().name || '') === 'Priya Mehta');
if (!mehtaPriya) { console.log('Could not find "Priya Mehta" in the Mehta tree — run seedMehta first.'); process.exit(1); }
const mehtaPriyaId = mehtaPriya.id;

// Create the Rao Family tree.
const raoRef = doc(collection(db, 'trees'));
const raoId = raoRef.id;
const invite = `RAO-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
await setDoc(raoRef, {
  name: 'Rao Family', mono: 'R', color: '#5fd0b0', ownerUid: uid, surname: 'Rao',
  region: 'Karnataka', kind: 'Your family', established: '1922',
  inviteCode: invite, joinPolicy: 'approval', createdAt: serverTimestamp(),
});
await setDoc(doc(db, 'trees', raoId, 'memberships', uid), { uid, email: EMAIL, role: 'owner', joinedAt: serverTimestamp() });
await setDoc(doc(db, 'users', uid, 'families', raoId), { treeId: raoId, role: 'owner', name: 'Rao Family', mono: 'R', color: '#5fd0b0' });

// Members + relationships in the Rao tree.
let batch = writeBatch(db); let n = 0;
const bump = async (k = 1) => { n += k; if (n >= 400) { await batch.commit(); batch = writeBatch(db); n = 0; } };
const flush = async () => { if (n) { await batch.commit(); batch = writeBatch(db); n = 0; } };
const membersCol = collection(db, 'trees', raoId, 'members');
const relsCol = collection(db, 'trees', raoId, 'relationships');

const idMap = {};
for (const pp of people) {
  const ref = doc(membersCol); idMap[pp.id] = ref.id;
  const { id, ...rest } = pp;
  batch.set(ref, { ...rest, createdAt: serverTimestamp() }); await bump();
}
for (const [c, p] of parents) { batch.set(doc(relsCol), { fromId: idMap[c], toId: idMap[p], type: 'parent' }); await bump(); }
for (const [a, b] of spouses) {
  batch.set(doc(relsCol), { fromId: idMap[a], toId: idMap[b], type: 'spouse', status: 'current' });
  batch.set(doc(relsCol), { fromId: idMap[b], toId: idMap[a], type: 'spouse', status: 'current' });
  await bump(2);
}
await flush();

// Create the master combining Mehta (uid) + Rao (raoId), bridged on Priya.
const masterRef = doc(collection(db, 'masters'));
const masterId = masterRef.id;
const memberTreeIds = [uid, raoId];
const sig = [...memberTreeIds].sort().join('|');
await setDoc(masterRef, {
  name: 'Mehta + Rao', ownerUid: uid, color: '#8f8bff', memberTreeIds,
  links: [{ id: 'bridgePriya', type: 'same', aTreeId: uid, aMemberId: mehtaPriyaId, bTreeId: raoId, bMemberId: idMap.raoPriya }],
  createdAt: serverTimestamp(),
});
await setDoc(doc(db, 'users', uid, 'masters', masterId), { masterId, name: 'Mehta + Rao', color: '#8f8bff', treeCount: 2, sig });

console.log(`Seeded "Rao Family" (${people.length} people, tree ${raoId}) + master "Mehta + Rao" (${masterId}), bridged on Priya.`);
process.exit(0);
