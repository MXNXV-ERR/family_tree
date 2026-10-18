// Probe the DEPLOYED Firestore rules for the birthday feature.
// Exercises every write the celebration needs and every write it must NOT get.
// Restores whatever it touches.
//   node scripts/rulesProbe.mjs
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, limit, serverTimestamp, deleteField,
} from 'firebase/firestore';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const app = initializeApp({
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
});
const db = getFirestore(app);
const { user } = await signInWithEmailAndPassword(getAuth(app), 'jatin75b@gmail.com', 'password');
const uid = user.uid;
const TREE = 'bdaytest-' + uid.slice(0, 8);

let pass = 0, fail = 0;
const ok = (name, extra = '') => { pass++; console.log('  PASS  ' + name + (extra ? '  (' + extra + ')' : '')); };
const bad = (name, why) => { fail++; console.log('  FAIL  ' + name + '  → ' + why); };

// expect: 'allow' — the write must succeed; 'deny' — it must be rejected.
const probe = async (name, expect, fn) => {
  try {
    await fn();
    if (expect === 'allow') ok(name);
    else bad(name, 'the rules ALLOWED a write they should reject');
  } catch (e) {
    const denied = e?.code === 'permission-denied';
    if (expect === 'deny' && denied) ok(name, 'denied, as intended');
    else bad(name, e?.code || e?.message || String(e));
  }
};

console.log('tree:', TREE, '\nuid:', uid, '\n');

// ---------------------------------------------------------------- wishes ----
const notes = collection(doc(db, 'trees', TREE), 'notes');
const mine = await getDocs(query(notes, where('fromUid', '==', uid), limit(20)));
const wishes = mine.docs.filter((d) => d.data().wish);
if (!wishes.length) { console.error('No wishes in ' + TREE + ' — run seedBirthdayTest.mjs --yes first.'); process.exit(1); }
console.log('wishes visible to this account:', wishes.length, '\n');

const w = wishes[0];
const before = w.data();

await probe('recipient marks a wish read (read + readAt)', 'allow',
  () => updateDoc(w.ref, { read: true, readAt: Date.now() }));

await probe('recipient stamps repliedAt', 'allow',
  () => updateDoc(w.ref, { repliedAt: Date.now() }));

await probe('recipient reacts', 'allow',
  () => updateDoc(w.ref, { reaction: '❤️' }));

await probe('sender edits their own wish (text + wish block)', 'allow',
  () => updateDoc(w.ref, { text: (before.text ?? '') + ' ', wish: { ...before.wish, sticker: '🎂' } }));

await probe('nobody may rewrite who a wish is from', 'deny',
  () => updateDoc(w.ref, { fromUid: 'someone-else' }));

await probe('nobody may re-address a wish', 'deny',
  () => updateDoc(w.ref, { toMemberId: 'another-member' }));

// Restore in TWO writes, one per rule branch: recipient keys and sender keys
// can't travel together — `hasOnly` rejects the mix, which is the rule working.
// (A field that wasn't there before goes back to absent.)
const back = (k) => (k in before ? before[k] : deleteField());
await probe('restore recipient keys', 'allow', () => updateDoc(w.ref, {
  read: back('read'), readAt: back('readAt'), repliedAt: back('repliedAt'), reaction: back('reaction'),
}));
await probe('restore sender keys', 'allow', () => updateDoc(w.ref, {
  text: back('text'), wish: back('wish'),
}));
// BOTH values have to actually change or `affectedKeys` sees one key and the
// matching branch allows it — which is what made two earlier versions of this
// probe report a false failure.
await probe('recipient + sender keys in ONE write', 'deny',
  () => updateDoc(w.ref, { readAt: Date.now(), text: (before.text ?? '') + ' (mixed)' }));
// If that write got through, it changed real content — put it back.
if ((await getDoc(w.ref)).data().text !== before.text) {
  await updateDoc(w.ref, { text: back('text') });
  console.log('  ....  mixed write landed; text restored');
}
console.log('  ....  wish restored\n');

// ---------------------------------------------------------------- reply -----
const replyRef = doc(notes);
await probe('reply lands in the notes thread', 'allow', () => setDoc(replyRef, {
  rootId: w.id, toMemberId: before.toMemberId, toUid: before.toUid,
  fromUid: uid, fromName: 'Probe', text: 'probe reply', createdAt: serverTimestamp(),
}));
await probe('author deletes their reply', 'allow', () => deleteDoc(replyRef));

// ---------------------------------------------------------------- tree ------
// The path `seedBirthdayTest.mjs --clean` failed on before the deploy.
const scratch = doc(db, 'trees', TREE + '-probe');
await probe('create a tree doc', 'allow', () => setDoc(scratch, {
  name: 'Rules probe', mono: 'P', color: '#888', ownerUid: uid,
  inviteCode: 'PROBE-' + Date.now(), createdAt: serverTimestamp(),
}));
await probe('owner deletes their tree doc', 'allow', () => deleteDoc(scratch));

const treeDoc = await getDoc(doc(db, 'trees', TREE));
console.log('\n"Two of Us" tree doc readable:', treeDoc.exists());

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
