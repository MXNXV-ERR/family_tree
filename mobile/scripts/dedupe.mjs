// One-off cleanup: remove duplicate relationship edges (same fromId|toId|type),
// keeping the earliest of each. Signs in as the tree owner via email/password.
import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(Boolean).map((l) => {
  const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)];
}));

const app = initializeApp({
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

const cred = await signInWithEmailAndPassword(auth, 'jatin75b@gmail.com', 'password');
const uid = cred.user.uid;
const relsCol = collection(doc(db, 'trees', uid), 'relationships');
const snap = await getDocs(relsCol);

const seen = new Set();
const toDelete = [];
snap.forEach((d) => {
  const r = d.data();
  const sig = `${r.fromId}|${r.toId}|${r.type}`;
  if (seen.has(sig)) toDelete.push(d.id);
  else seen.add(sig);
});

console.log(`total=${snap.size} unique=${seen.size} duplicates=${toDelete.length}`);
for (const id of toDelete) await deleteDoc(doc(relsCol, id));
console.log(`deleted ${toDelete.length} duplicate edges`);
process.exit(0);
