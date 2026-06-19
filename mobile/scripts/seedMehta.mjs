// Wipe + reseed the Mehta primary tree (treeId === jatin75b's uid) with a richer
// 5-generation family. DESTRUCTIVE on the Mehta tree only. Run:  node scripts/seedMehta.mjs --yes
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';

if (!process.argv.includes('--yes')) { console.log('Refusing to run without --yes (this WIPES the Mehta tree).'); process.exit(1); }

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

// id, name, gender, birthDate, [deathDate], + optional rich fields. me=true → linked to the signed-in user.
const people = [
  // G0 — great-great-grandparents
  { id: 'govindlal', name: 'Govindlal Mehta', gender: 'male', birthDate: '1895-12-01', deathDate: '1970-06-15', occupation: 'Cloth trader', placeOfBirth: 'Surat', location: 'Surat', about: 'Founder of the Mehta cloth trade.' },
  { id: 'radha', name: 'Radha Mehta', gender: 'female', birthDate: '1899-04-10', deathDate: '1975-09-20', maidenName: 'Bhatt', occupation: 'Homemaker', placeOfBirth: 'Surat' },
  // G1 — great-grandparents
  { id: 'ramanlal', name: 'Ramanlal Mehta', gender: 'male', birthDate: '1920-03-14', deathDate: '1996-11-02', occupation: 'Textile merchant', placeOfBirth: 'Surat', location: 'Ahmedabad', about: 'Expanded the family textile business to Ahmedabad.', favoriteQuote: 'Hard work is the only shortcut.' },
  { id: 'kamla', name: 'Kamla Mehta', gender: 'female', birthDate: '1924-07-22', deathDate: '2002-01-30', maidenName: 'Shah', occupation: 'Homemaker', placeOfBirth: 'Vadodara', about: 'Known for her kitchen and her kindness.' },
  // G2 — grandparents (children of Ramanlal + Kamla)
  { id: 'suresh', name: 'Suresh Mehta', gender: 'male', birthDate: '1948-05-10', occupation: 'Civil engineer', placeOfBirth: 'Ahmedabad', location: 'Mumbai', about: 'Built bridges across Gujarat.', phone: '+91 98200 11111', email: 'suresh.mehta@example.com' },
  { id: 'pushpa', name: 'Pushpa Mehta', gender: 'female', birthDate: '1951-09-03', maidenName: 'Patel', occupation: 'School principal', location: 'Mumbai' },
  { id: 'mahesh', name: 'Mahesh Mehta', gender: 'male', birthDate: '1951-02-18', occupation: 'Cardiologist', location: 'Pune', about: 'Ran a free weekend heart clinic for 20 years.' },
  { id: 'rekha', name: 'Rekha Mehta', gender: 'female', birthDate: '1955-11-25', maidenName: 'Joshi', occupation: 'Pharmacist', location: 'Pune' },
  { id: 'sunita', name: 'Sunita Desai', gender: 'female', birthDate: '1954-08-30', maidenName: 'Mehta', occupation: 'Bank manager', location: 'Surat' },
  { id: 'dilip', name: 'Dilip Desai', gender: 'male', birthDate: '1950-04-12', occupation: 'Chartered accountant', location: 'Surat' },
  { id: 'bharat', name: 'Bharat Mehta', gender: 'male', birthDate: '1957-06-08', occupation: 'Restaurateur', location: 'Ahmedabad' },
  { id: 'lata', name: 'Lata Mehta', gender: 'female', birthDate: '1960-10-14', maidenName: 'Trivedi', occupation: 'Chef', location: 'Ahmedabad' },
  // G3 — parents (the signed-in user is here: Rohan)
  { id: 'rohan', name: 'Rohan Mehta', gender: 'male', birthDate: '1975-07-19', occupation: 'Software architect', placeOfBirth: 'Mumbai', location: 'Bangalore', about: 'Loves trekking and building the family tree app.', favoriteQuote: 'Code is family history written forward.', email: 'rohan.mehta@example.com', phone: '+91 99000 22222', me: true },
  { id: 'priya', name: 'Priya Mehta', gender: 'female', birthDate: '1978-03-27', maidenName: 'Rao', occupation: 'Montessori teacher', location: 'Bangalore' },
  { id: 'anjali', name: 'Anjali Iyer', gender: 'female', birthDate: '1980-12-05', maidenName: 'Mehta', occupation: 'UX designer', location: 'Chennai' },
  { id: 'vikram', name: 'Vikram Iyer', gender: 'male', birthDate: '1978-09-16', occupation: 'Marine biologist', location: 'Chennai' },
  { id: 'karan', name: 'Karan Mehta', gender: 'male', birthDate: '1979-01-22', occupation: 'Entrepreneur', location: 'Pune' },
  { id: 'neha', name: 'Neha Mehta', gender: 'female', birthDate: '1982-05-09', maidenName: 'Gupta', occupation: 'Interior designer', location: 'Pune' },
  { id: 'pooja', name: 'Pooja Reddy', gender: 'female', birthDate: '1984-08-11', maidenName: 'Mehta', occupation: 'Architect', location: 'Hyderabad' },
  { id: 'aakash', name: 'Aakash Reddy', gender: 'male', birthDate: '1983-02-02', occupation: 'Civil servant', location: 'Hyderabad' },
  { id: 'amit', name: 'Amit Desai', gender: 'male', birthDate: '1981-11-03', occupation: 'Airline pilot', location: 'Delhi' },
  { id: 'kavya', name: 'Kavya Desai', gender: 'female', birthDate: '1985-02-14', maidenName: 'Nair', occupation: 'Radiologist', location: 'Delhi' },
  { id: 'sneha', name: 'Sneha Kapoor', gender: 'female', birthDate: '1983-04-18', maidenName: 'Mehta', occupation: 'Journalist', location: 'Delhi' },
  { id: 'rahul', name: 'Rahul Kapoor', gender: 'male', birthDate: '1981-07-07', occupation: 'Documentary filmmaker', location: 'Delhi' },
  { id: 'manish', name: 'Manish Mehta', gender: 'male', birthDate: '1986-09-29', occupation: 'Data scientist', location: 'Ahmedabad' },
  { id: 'divya', name: 'Divya Mehta', gender: 'female', birthDate: '1988-06-21', maidenName: 'Shah', occupation: 'Veterinarian', location: 'Ahmedabad' },
  // G4 — children
  { id: 'diya', name: 'Diya Mehta', gender: 'female', birthDate: '2003-10-02', occupation: 'Medical student', location: 'Bangalore', about: 'The first doctor-to-be of her generation.' },
  { id: 'arjun', name: 'Arjun Mehta', gender: 'male', birthDate: '2006-12-19', occupation: 'High-school student', location: 'Bangalore' },
  { id: 'ishaan', name: 'Ishaan Iyer', gender: 'male', birthDate: '2005-05-23', occupation: 'Engineering student', location: 'Chennai' },
  { id: 'ananya', name: 'Ananya Iyer', gender: 'female', birthDate: '2008-08-08', occupation: 'Student', location: 'Chennai' },
  { id: 'aarav', name: 'Aarav Mehta', gender: 'male', birthDate: '2009-03-15', occupation: 'Student', location: 'Pune' },
  { id: 'saanvi', name: 'Saanvi Mehta', gender: 'female', birthDate: '2012-11-27', occupation: 'Student', location: 'Pune' },
  { id: 'reyansh', name: 'Reyansh Desai', gender: 'male', birthDate: '2010-01-09', occupation: 'Student', location: 'Delhi' },
  { id: 'aditya', name: 'Aditya Mehta', gender: 'male', birthDate: '2011-07-30', occupation: 'Student', location: 'Ahmedabad' },
  { id: 'tara', name: 'Tara Kapoor', gender: 'female', birthDate: '2009-09-09', occupation: 'Student', location: 'Delhi' },
];

// [child, parent]
const parents = [
  ['ramanlal', 'govindlal'], ['ramanlal', 'radha'],
  ['suresh', 'ramanlal'], ['suresh', 'kamla'],
  ['mahesh', 'ramanlal'], ['mahesh', 'kamla'],
  ['sunita', 'ramanlal'], ['sunita', 'kamla'],
  ['bharat', 'ramanlal'], ['bharat', 'kamla'],
  ['rohan', 'suresh'], ['rohan', 'pushpa'],
  ['anjali', 'suresh'], ['anjali', 'pushpa'],
  ['karan', 'mahesh'], ['karan', 'rekha'],
  ['pooja', 'mahesh'], ['pooja', 'rekha'],
  ['amit', 'sunita'], ['amit', 'dilip'],
  ['sneha', 'bharat'], ['sneha', 'lata'],
  ['manish', 'bharat'], ['manish', 'lata'],
  ['diya', 'rohan'], ['diya', 'priya'],
  ['arjun', 'rohan'], ['arjun', 'priya'],
  ['ishaan', 'anjali'], ['ishaan', 'vikram'],
  ['ananya', 'anjali'], ['ananya', 'vikram'],
  ['aarav', 'karan'], ['aarav', 'neha'],
  ['saanvi', 'karan'], ['saanvi', 'neha'],
  ['reyansh', 'amit'], ['reyansh', 'kavya'],
  ['aditya', 'manish'], ['aditya', 'divya'],
  ['tara', 'sneha'], ['tara', 'rahul'],
];

// [a, b]
const spouses = [
  ['govindlal', 'radha'], ['ramanlal', 'kamla'], ['suresh', 'pushpa'], ['mahesh', 'rekha'],
  ['sunita', 'dilip'], ['bharat', 'lata'], ['rohan', 'priya'], ['anjali', 'vikram'],
  ['karan', 'neha'], ['pooja', 'aakash'], ['amit', 'kavya'], ['sneha', 'rahul'], ['manish', 'divya'],
];

const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

const cred = await signInWithEmailAndPassword(auth, EMAIL, PASS);
const uid = cred.user.uid;
console.log('signed in as', uid, '(tree = this uid)');
const treeRef = doc(db, 'trees', uid);
const membersCol = collection(treeRef, 'members');
const relsCol = collection(treeRef, 'relationships');

let batch = writeBatch(db); let n = 0;
const bump = async (k = 1) => { n += k; if (n >= 400) { await batch.commit(); batch = writeBatch(db); n = 0; } };
const flush = async () => { if (n) { await batch.commit(); batch = writeBatch(db); n = 0; } };

// wipe
const [mSnap, rSnap] = await Promise.all([getDocs(membersCol), getDocs(relsCol)]);
console.log('wiping', mSnap.size, 'members +', rSnap.size, 'relationships');
for (const d of [...mSnap.docs, ...rSnap.docs]) { batch.delete(d.ref); await bump(); }
await flush();

// members
const idMap = {};
for (const pp of people) {
  const ref = doc(membersCol);
  idMap[pp.id] = ref.id;
  const { id, me, ...rest } = pp;
  const data = { ...rest, createdAt: serverTimestamp() };
  if (me) data.associatedUserId = uid;
  batch.set(ref, data); await bump();
}
await flush();

// relationships
for (const [c, p] of parents) { batch.set(doc(relsCol), { fromId: idMap[c], toId: idMap[p], type: 'parent' }); await bump(); }
for (const [a, b] of spouses) {
  batch.set(doc(relsCol), { fromId: idMap[a], toId: idMap[b], type: 'spouse', status: 'current' });
  batch.set(doc(relsCol), { fromId: idMap[b], toId: idMap[a], type: 'spouse', status: 'current' });
  await bump(2);
}
await flush();

console.log(`seeded ${people.length} members, ${parents.length} parent links, ${spouses.length} couples. "You" = Rohan Mehta.`);
process.exit(0);
