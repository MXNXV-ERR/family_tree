// Seed (or remove) demo birthday wishes so the celebration, the tokens and the
// links can be walked end to end. Writes to the LIVE tree, so it never runs
// without an explicit flag, and every doc it creates is tagged `demoWish: true`
// so `--clean` can take them all back out again.
//
//   node scripts/seedWishes.mjs --yes                  6 wishes from one sender to the signed-in user, dated today
//   node scripts/seedWishes.mjs --yes --senders 4      spread them over 4 senders instead
//   node scripts/seedWishes.mjs --yes --count 20       20 wishes (exercises the twelve-link cap + "+n")
//   node scripts/seedWishes.mjs --clean                delete every demo wish again
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, collection, getDocs, query, where, writeBatch, doc, Timestamp,
} from 'firebase/firestore';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? (args[i + 1] ?? dflt) : dflt;
};
const clean = args.includes('--clean');
if (!clean && !args.includes('--yes')) {
  console.log('Refusing to write to the live tree without --yes. Use --clean to remove demo wishes.');
  process.exit(1);
}

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
const auth = getAuth(app);
const db = getFirestore(app);

const { user } = await signInWithEmailAndPassword(auth, 'jatin75b@gmail.com', 'password');
const treeId = user.uid;           // the legacy primary tree keeps treeId === uid
const notesCol = collection(doc(db, 'trees', treeId), 'notes');

if (clean) {
  const snap = await getDocs(query(notesCol, where('fromUid', '==', user.uid)));
  const demo = snap.docs.filter((d) => d.data().demoWish === true);
  for (let i = 0; i < demo.length; i += 400) {
    const batch = writeBatch(db);
    demo.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  console.log('removed ' + demo.length + ' demo wishes');
  process.exit(0);
}

// The recipient is the signed-in user's own claimed node, so the celebration
// (which only the celebrant sees) is reachable without a second account.
const members = (await getDocs(collection(doc(db, 'trees', treeId), 'members')))
  .docs.map((d) => ({ id: d.id, ...d.data() }));
const me = members.find((m) => m.associatedUserId === user.uid);
if (!me) { console.error('No member on this tree is claimed by the signed-in user ("This is me").'); process.exit(1); }

const count = Number(flag('count', 6));
const senders = Number(flag('senders', 1));
const others = members.filter((m) => m.id !== me.id).slice(0, Math.max(1, senders));
if (senders > 1) {
  console.warn([
    'NOTE: the notes rules require fromUid === the signed-in uid, so every seeded wish is',
    '      written by this account. --senders varies the displayed name and avatar, but',
    '      senderCount stays 1. Testing the 2 / 3-6 / 7+ copy rungs needs second accounts.',
  ].join('\n'));
}

const STICKERS = ['🎂', '🎉', '❤️', '🎈', '🌸', '⭐', '🥳'];
const TEXTS = [
  'Happy birthday! Thinking of you all morning.',
  'Found this from 1994 — look how young everyone was.',
  'One more year, one more reason to celebrate you.',
  'Come home soon. The kitchen misses you.',
  'You taught me everything I know about patience.',
  'A small thing, but it made me think of you.',
];

// Today's birthday cycle — the app buckets wishes by the calendar year of the
// birthday, and the seeded member's own birthDate decides that year.
const year = new Date().getFullYear();

const batch = writeBatch(db);
for (let i = 0; i < count; i++) {
  const from = others[i % others.length];
  const media = i % 5 === 4 ? 'video' : 'none';
  batch.set(doc(notesCol), {
    toMemberId: me.id,
    toUid: user.uid,
    fromUid: user.uid,              // rules: the writer must own the doc
    fromName: from.name,
    fromMemberId: from.id,
    text: TEXTS[i % TEXTS.length],
    read: false,
    createdAt: Timestamp.fromDate(new Date(Date.now() - (count - i) * 3600_000)),
    demoWish: true,
    wish: {
      year,
      sticker: STICKERS[i % STICKERS.length],
      media,
      ...(media === 'video' ? { videoUrl: 'https://drive.google.com/file/d/DEMO/view' } : {}),
    },
  });
}
await batch.commit();

console.log(
  'seeded ' + count + ' wishes for ' + me.name + ' from ' + others.length +
  ' sender(s). Set that member\'s birthDate to today to see the celebration; ' +
  'run with --clean to remove them.',
);
process.exit(0);
