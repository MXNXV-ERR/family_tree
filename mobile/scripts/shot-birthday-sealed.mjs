// Sealed screen (SPEC 4 step 1 / 5): move the celebrant's birthday 3 days out,
// confirm the pre-day screen leaks no count and no preview, then put it back.
import { chromium } from 'playwright';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDocs, collection, setDoc } from 'firebase/firestore';

const PORT = process.argv[2] || '8084';
const out = 'scripts/shots/cases';
const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const app = initializeApp({
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY, authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
});
const auth = getAuth(app); const db = getFirestore(app);
const { user } = await signInWithEmailAndPassword(auth, 'jatin75b@gmail.com', 'password');
// Use the two-member family: the primary tree has other members whose birthday
// is also today, and the orb always surfaces the NEAREST window, so the
// celebrant's own sealed state would never be the one on screen.
const TREE = 'bdaytest-' + user.uid.slice(0, 8);

const snap = await getDocs(collection(doc(db, 'trees', TREE), 'members'));
const me = snap.docs.map((d) => ({ id: d.id, ...d.data() })).find((m) => m.associatedUserId === user.uid);
if (!me) { console.error('no claimed member in the primary tree'); process.exit(1); }
const original = me.birthDate;

const plus3 = new Date(Date.now() + 3 * 86400000);
const shifted = `${original.slice(0, 4)}-${String(plus3.getMonth() + 1).padStart(2, '0')}-${String(plus3.getDate()).padStart(2, '0')}`;
await setDoc(doc(db, 'trees', TREE, 'members', me.id), { birthDate: shifted }, { merge: true });
console.log('birthday moved to ' + shifted + ' (3 days out)');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(4000);
const email = page.locator('input[type="email"], input').first();
if (await email.count()) {
  await email.fill('jatin75b@gmail.com');
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) await pwd.fill('password');
  await page.getByText('Sign In', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(10000);
}
// pin the app to the two-member family before measuring the seal
// The key may not exist yet (it's only written on a switch), so write it
// directly from the uid this script already holds.
await page.evaluate(([t, u]) => {
  try { localStorage.setItem('ft.activeTree.' + u, t); } catch {}
}, [TREE, user.uid]);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(10000);
await page.screenshot({ path: `${out}/16-sealed-home-calm-orb.png` });

const orb = page.getByLabel(/days to your birthday|Open birthday wishes/);
if (await orb.count()) {
  await orb.first().click({ force: true });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/17-sealed-screen.png` });
}

// the seal must not leak: no wish count anywhere on the page
const body = await page.evaluate(() => document.body.innerText);
// The seal hides things from the CELEBRANT: no wish count, no preview text, no
// sender-written words. (A giver seeing their own count is not a leak.)
const leaks = ['eight wishes', '8 wishes', 'wishes ·', 'happy birthday, my love', 'cake is in the fridge']
  .filter((t) => body.toLowerCase().includes(t));
console.log('seal leaks:', leaks.length ? leaks : 'none');
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();

await setDoc(doc(db, 'trees', TREE, 'members', me.id), { birthDate: original }, { merge: true });
console.log('birthday restored to ' + original);
process.exit(0);
