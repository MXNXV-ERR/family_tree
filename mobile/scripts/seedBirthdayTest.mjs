// Build a full, walkable birthday test bed. Writes to the LIVE project, so it
// only runs with --yes, tags everything it creates, and --clean takes it back out.
//
//   node scripts/seedBirthdayTest.mjs --yes      set up both scenarios
//   node scripts/seedBirthdayTest.mjs --clean    undo everything
//
// Scenario A — Mehta (the existing tree): the signed-in user's own claimed node
//   gets today's birthday plus a spread of wishes (notes, photos, a video,
//   sticker-only, one already read) so the celebration, the tokens, the links
//   and the polaroid can all be walked as the CELEBRANT.
//
// Scenario B — "Two of Us": a brand-new two-member family, the design's default
//   case. The user's node has today's birthday and the single other member has
//   written many wishes — the binary/opener path the spec is built around.
//
// Rules note: notes require fromUid === the signed-in uid, so every wish is
// written by this account; fromName/fromMemberId vary so the UI shows different
// faces, but senderCount stays 1 (which is exactly Scenario B's design case).
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';

const args = process.argv.slice(2);
const clean = args.includes('--clean');
if (!clean && !args.includes('--yes')) {
  console.log('Refusing to write to the live project without --yes. (--clean undoes it.)');
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
const uid = user.uid;

const TEST_TREE = 'bdaytest-' + uid.slice(0, 8);   // Scenario B's tree id
const BACKUP = 'scripts/.birthday-test-backup.json';
const today = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Two tiny inline images (the app stores photos as base64 data URIs, < 1 MB).
const PHOTO_A = 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffce6b"/><stop offset="1" stop-color="#cf6bd0"/></linearGradient></defs><rect width="420" height="300" fill="url(#g)"/><text x="210" y="160" font-family="Georgia" font-size="34" fill="#2a1a05" text-anchor="middle">Summer 1994</text></svg>`,
).toString('base64');
const PHOTO_B = 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300"><rect width="420" height="300" fill="#2a3a63"/><circle cx="210" cy="130" r="64" fill="#ffce6b"/><text x="210" y="240" font-family="Georgia" font-size="28" fill="#f4efff" text-anchor="middle">The old house</text></svg>`,
).toString('base64');

// ---------------------------------------------------------------- clean ----
if (clean) {
  let removed = 0;
  const backup = fs.existsSync(BACKUP) ? JSON.parse(fs.readFileSync(BACKUP, 'utf8')) : null;

  for (const treeId of [uid, TEST_TREE]) {
    const notesCol = collection(doc(db, 'trees', treeId), 'notes');
    try {
      const snap = await getDocs(query(notesCol, where('fromUid', '==', uid)));
      const demo = snap.docs.filter((d) => d.data().demoWish === true);
      for (let i = 0; i < demo.length; i += 400) {
        const b = writeBatch(db);
        demo.slice(i, i + 400).forEach((d) => b.delete(d.ref));
        await b.commit();
        removed += Math.min(400, demo.length - i);
      }
    } catch (e) { console.warn('notes cleanup on ' + treeId + ':', e.message); }
  }

  // restore the Mehta birthDate we overwrote
  if (backup?.mehta) {
    await setDoc(doc(db, 'trees', uid, 'members', backup.mehta.id),
      { birthDate: backup.mehta.birthDate ?? null }, { merge: true });
    console.log('restored ' + backup.mehta.name + "'s birthDate to " + (backup.mehta.birthDate ?? '(none)'));
  }

  // tear the test family down
  try {
    for (const sub of ['members', 'relationships', 'memberships', 'notes']) {
      const snap = await getDocs(collection(doc(db, 'trees', TEST_TREE), sub));
      for (const d of snap.docs) await deleteDoc(d.ref);
    }
    await deleteDoc(doc(db, 'trees', TEST_TREE));
    await deleteDoc(doc(db, 'users', uid, 'families', TEST_TREE));
    console.log('removed the test family');
  } catch (e) { console.warn('test family cleanup:', e.message); }

  fs.rmSync(BACKUP, { force: true });
  console.log('removed ' + removed + ' demo wishes');
  process.exit(0);
}

// ------------------------------------------------------- scenario A: Mehta --
const membersSnap = await getDocs(collection(doc(db, 'trees', uid), 'members'));
const members = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
const me = members.find((m) => m.associatedUserId === uid);
if (!me) { console.error('No Mehta member is claimed by this account ("This is me").'); process.exit(1); }

fs.writeFileSync(BACKUP, JSON.stringify({ mehta: { id: me.id, name: me.name, birthDate: me.birthDate ?? null } }, null, 2));

// keep the birth YEAR (so "turns N" stays truthful), move the day to today
const birthYear = (me.birthDate || '1992-01-01').slice(0, 4);
const newBirth = `${birthYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
await setDoc(doc(db, 'trees', uid, 'members', me.id), { birthDate: newBirth }, { merge: true });
console.log(`Mehta: ${me.name}'s birthday moved to today (${newBirth})`);

const others = members.filter((m) => m.id !== me.id);
const pick = (i) => others[i % others.length];

const wish = (o) => ({
  toMemberId: o.to, toUid: uid, fromUid: uid,
  fromName: o.from.name, fromMemberId: o.from.id,
  ...(o.text ? { text: o.text } : {}),
  ...(o.image ? { image: o.image } : {}),
  read: !!o.read,
  ...(o.read ? { readAt: Date.now() - 3600_000 } : {}),
  createdAt: Timestamp.fromDate(new Date(Date.now() - (o.hoursAgo ?? 2) * 3600_000)),
  demoWish: true,
  wish: {
    year: today.getFullYear(),
    ...(o.sticker ? { sticker: o.sticker } : {}),
    media: o.video ? 'video' : o.image ? 'photo' : 'none',
    ...(o.video ? { videoUrl: o.video } : {}),
  },
});

const mehtaWishes = [
  { from: pick(0), text: 'Happy birthday! I have been thinking about you all morning.', sticker: '🎂', hoursAgo: 9 },
  { from: pick(1), text: 'Found this from 1994 — look how young everyone was.', sticker: '🎉', image: PHOTO_A, hoursAgo: 8 },
  { from: pick(2), text: 'One more year, one more reason to celebrate you.', sticker: '❤️', hoursAgo: 7, read: true },
  { from: pick(3), sticker: '🎈', hoursAgo: 6 },                       // sticker only, no text
  { from: pick(4), text: 'A short film from the old house.', sticker: '⭐', video: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view', hoursAgo: 5 },
  { from: pick(5), text: 'You taught me everything I know about patience. Thank you for that, and for every Sunday lunch, and for never once making me feel like a guest in my own family.', sticker: '🙏', hoursAgo: 4 },
  { from: pick(6), text: 'Come home soon. The kitchen misses you.', sticker: '🌸', image: PHOTO_B, hoursAgo: 3 },
];

let batch = writeBatch(db);
const mehtaNotes = collection(doc(db, 'trees', uid), 'notes');
mehtaWishes.forEach((w) => batch.set(doc(mehtaNotes), wish({ ...w, to: me.id })));
await batch.commit();
console.log(`Mehta: ${mehtaWishes.length} wishes written to ${me.name}`);

// --------------------------------------------- scenario B: two-member family --
const meName = me.name || 'You';
await setDoc(doc(db, 'trees', TEST_TREE), {
  name: 'Two of Us', mono: 'T', color: '#ff8caf', ownerUid: uid,
  inviteCode: 'TWOOFUS-TEST', kind: 'Your family', createdAt: serverTimestamp(),
}, { merge: true });
await setDoc(doc(db, 'trees', TEST_TREE, 'memberships', uid),
  { uid, email: user.email || '', role: 'owner', joinedAt: serverTimestamp() }, { merge: true });
await setDoc(doc(db, 'users', uid, 'families', TEST_TREE),
  { treeId: TEST_TREE, role: 'owner', name: 'Two of Us', mono: 'T', color: '#ff8caf' });

const A = doc(collection(doc(db, 'trees', TEST_TREE), 'members'));   // the celebrant (me)
const B = doc(collection(doc(db, 'trees', TEST_TREE), 'members'));   // the one other member
await setDoc(A, {
  name: meName, gender: me.gender || 'male', birthDate: newBirth,
  associatedUserId: uid, occupation: me.occupation || 'Engineer', createdAt: serverTimestamp(),
});
await setDoc(B, {
  name: 'Anita Mehta', gender: 'female', birthDate: '1991-04-18',
  occupation: 'Illustrator', createdAt: serverTimestamp(),
});
const relsCol = collection(doc(db, 'trees', TEST_TREE), 'relationships');
await setDoc(doc(relsCol), { fromId: A.id, toId: B.id, type: 'spouse', status: 'current', marriageDate: '2018-11-12' });
await setDoc(doc(relsCol), { fromId: B.id, toId: A.id, type: 'spouse', status: 'current', marriageDate: '2018-11-12' });

const anita = { id: B.id, name: 'Anita Mehta' };
const twoWishes = [
  { from: anita, text: 'Happy birthday, my love. Thirty-four looks good on you.', sticker: '❤️', hoursAgo: 10 },
  { from: anita, text: 'Us, on the terrace, the year we met.', sticker: '🎉', image: PHOTO_A, hoursAgo: 9 },
  { from: anita, sticker: '🎂', hoursAgo: 8 },
  { from: anita, text: 'I recorded something for you. Watch it when the house is quiet.', sticker: '⭐', video: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view', hoursAgo: 7 },
  { from: anita, text: 'The old house, before they painted it.', sticker: '🌸', image: PHOTO_B, hoursAgo: 6 },
  { from: anita, text: 'One more, because one was never going to be enough. You make an ordinary Tuesday feel like something worth remembering, and I would like a few more decades of that if you can spare them.', sticker: '🥳', hoursAgo: 5 },
  { from: anita, text: 'Cake is in the fridge. Do not let your brother find it first.', sticker: '🎈', hoursAgo: 4 },
  { from: anita, text: 'Okay, last one. Happy birthday.', sticker: '🙏', hoursAgo: 3 },
];
batch = writeBatch(db);
const twoNotes = collection(doc(db, 'trees', TEST_TREE), 'notes');
twoWishes.forEach((w) => batch.set(doc(twoNotes), wish({ ...w, to: A.id })));
await batch.commit();

console.log(`"Two of Us": ${twoWishes.length} wishes from Anita to ${meName} (both born today-in-window)`);
console.log('\nSwitch family in the app to walk each scenario. Undo with --clean.');
process.exit(0);
