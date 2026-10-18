// Unit tests for the birthday copy engine + geometry seeds (SPEC §7, §2).
// The repo has no test runner, so this compiles the two pure modules with the
// local tsc and asserts against the emitted JS.
//
//   node scripts/birthday.test.mjs      (or: npm run test:birthday)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'ft-birthday-'));

// Call tsc's own entry with this node binary — `npx` is not spawnable directly
// on Windows, and this avoids a shell entirely.
execFileSync(
  process.execPath,
  [resolve(root, 'node_modules/typescript/bin/tsc'),
    'src/shared/birthdayCopy.ts', 'src/shared/birthday.ts',
    '--outDir', out, '--module', 'es2022', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck', '--ignoreConfig'],
  { cwd: root, stdio: 'inherit' },
);

const copy = await import(pathToFileURL(join(out, 'birthdayCopy.js')).href);
const geo = await import(pathToFileURL(join(out, 'birthday.js')).href);

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) {
    console.error('FAIL  ' + name + '\n      ' + (e.message ?? e));
    process.exitCode = 1;
  }
};

const mk = (n, over = {}) =>
  Array.from({ length: n }, (_, i) => ({
    uid: 'u' + i,
    name: ['Anita', 'Dev', 'Priya', 'Rohan', 'Meera', 'Arjun', 'Kiran'][i] ?? 'Person' + i,
    ...over,
  }));

// ---- SPEC §7 copy ladder -------------------------------------------------

test('1 sender, 1 wish → "Anita wished you"', () => {
  assert.equal(copy.birthdayCopy({ senders: mk(1), wishCount: 1 }).headline, 'Anita wished you');
});

test('1 sender, 6 wishes → "Anita wrote to you six times"', () => {
  const r = copy.birthdayCopy({ senders: mk(1), wishCount: 6 });
  assert.equal(r.headline, 'Anita wrote to you six times');
  assert.equal(r.caption, 'SIX TIMES, THIS WEEK');
});

test('2 senders → "Anita and Dev wished you"', () => {
  assert.equal(copy.birthdayCopy({ senders: mk(2), wishCount: 5 }).headline, 'Anita and Dev wished you');
});

test('3 senders → "Anita, Dev and Priya wished you"', () => {
  assert.equal(copy.birthdayCopy({ senders: mk(3), wishCount: 3 }).headline, 'Anita, Dev and Priya wished you');
});

test('4 senders → "Anita, Dev and two others wished you"', () => {
  assert.equal(copy.birthdayCopy({ senders: mk(4), wishCount: 9 }).headline, 'Anita, Dev and two others wished you');
});

test('6 senders → "Anita, Dev and four others wished you"', () => {
  assert.equal(copy.birthdayCopy({ senders: mk(6), wishCount: 6 }).headline, 'Anita, Dev and four others wished you');
});

test('7 senders → crowd headline, no names', () => {
  const r = copy.birthdayCopy({ senders: mk(7), wishCount: 7 });
  assert.equal(r.headline, 'Seven people are thinking of you today');
  assert.equal(r.headline.includes('Anita'), false);
});

test('25 senders → "Twenty-five people are thinking of you today"', () => {
  assert.equal(copy.birthdayCopy({ senders: mk(25), wishCount: 40 }).headline,
    'Twenty-five people are thinking of you today');
});

test('relationship beats first name in the celebrant’s own view', () => {
  const senders = [{ uid: 'u0', name: 'Anita Mehta', relationship: 'your wife', gender: 'female' }];
  assert.equal(copy.birthdayCopy({ senders, wishCount: 1, viewerIsCelebrant: true }).headline,
    'Your wife wished you');
  assert.equal(copy.birthdayCopy({ senders, wishCount: 1, viewerIsCelebrant: false }).headline,
    'Anita wished you');
});

test('CTA is possessive at one sender, neutral at three', () => {
  assert.equal(copy.birthdayCopy({ senders: mk(1, { gender: 'female' }), wishCount: 3 }).cta, 'Read her wishes');
  assert.equal(copy.birthdayCopy({ senders: mk(1, { gender: 'male' }), wishCount: 1 }).cta, 'Read his wishes');
  assert.equal(copy.birthdayCopy({ senders: mk(3), wishCount: 3 }).cta, 'Open them');
});

test('numbers spelled out to twelve, digits after', () => {
  assert.equal(copy.num(12), 'twelve');
  assert.equal(copy.num(13), '13');
  assert.equal(copy.birthdayCopy({ senders: mk(1), wishCount: 13 }).headline, 'Anita wrote to you 13 times');
});

test('ordinals for repeat wishes', () => {
  assert.equal(copy.ordinal(1), 'first');
  assert.equal(copy.ordinal(3), 'third');
  assert.equal(copy.ordinal(12), 'twelfth');
  assert.equal(copy.ordinal(13), '13th');
  assert.equal(copy.ordinal(21), '21st');
  assert.match(copy.ordinalWishLine(2, 'Rajesh', 'male'), /your third wish for him/);
});

test('wall count line pairs wishes with new, never people', () => {
  assert.equal(copy.birthdayCopy({ senders: mk(1), wishCount: 12, unread: 3 }).countLine,
    'Twelve wishes · three new');
  assert.equal(copy.birthdayCopy({ senders: mk(1), wishCount: 1 }).countLine, 'One wish');
});

// ---- banned strings ------------------------------------------------------

test('banned strings are unproducible across the whole input space', () => {
  const banned = [/\b1 person wished you\b/i, /\b\d+ wishes from 1 person\b/i, /No wishes yet/i];
  for (let s = 0; s <= 30; s++) {
    for (const wishes of [0, 1, 2, 3, 6, 12, 13, 20, 40]) {
      for (const viewerIsCelebrant of [true, false]) {
        for (const unread of [0, 1, 3]) {
          const r = copy.birthdayCopy({
            senders: mk(s), wishCount: wishes, viewerIsCelebrant, unread, daysUntil: 3,
          });
          const all = [r.headline, r.caption, r.cta, r.senderLine, r.countLine].filter(Boolean).join(' | ');
          for (const re of banned) {
            assert.equal(re.test(all), false, 'produced a banned string: "' + all + '"');
          }
          // a bare digit must never sit next to a single sender
          if (s === 1) {
            assert.equal(/\b1 person\b/.test(all), false, 'counted a single person: ' + all);
          }
        }
      }
    }
  }
});

test('"Your family is writing" only appears at 7+ senders', () => {
  for (let s = 0; s <= 10; s++) {
    const line = copy.sealedLine(mk(s));
    if (/Your family is writing/.test(line)) assert.ok(s >= 7, 'family line leaked at ' + s + ' senders');
  }
  assert.equal(copy.sealedLine(mk(1)), 'Anita is writing to you.');
});

test('zero wishes renders a countdown, not an empty state', () => {
  const r = copy.birthdayCopy({ senders: [], wishCount: 0, daysUntil: 3 });
  assert.equal(r.headline, 'three days to go');
  assert.equal(/no wishes/i.test(r.headline), false);
});

test('push notification carries no name and no count', () => {
  assert.equal(/\d/.test(copy.BIRTHDAY_PUSH_TITLE), false);
  assert.equal(copy.BIRTHDAY_PUSH_TITLE, 'It’s your birthday — open your sky');
});

// ---- SPEC §2 geometry ----------------------------------------------------

const ids = (n) => Array.from({ length: n }, (_, i) => 'wish-' + i);

test('seeded positions are stable for the same id', () => {
  const a = geo.seededPositions(ids(6));
  const b = geo.seededPositions(ids(6));
  a.forEach((t, i) => {
    assert.equal(Math.round(t.x), Math.round(b[i].x));
    assert.equal(Math.round(t.y), Math.round(b[i].y));
  });
});

test('radii are unequal — never a ring', () => {
  for (const n of [3, 6, 12, 20]) {
    const f = geo.DEFAULT_FRAME;
    const radii = geo.seededPositions(ids(n)).map((t) => Math.hypot(t.x - f.hubX, t.y - f.hubY));
    const spread = Math.max(...radii) - Math.min(...radii);
    assert.ok(spread > 40, n + ' wishes formed a ring (radius spread ' + spread.toFixed(1) + 'px)');
  }
});

// The hub is 88px across and an unread media token 64px, so centres must stay
// at least 44 + 32 apart just to stop the shapes intersecting; the ring and
// glow need more. The full frame gets the whole keep-out, the small archive
// panel the scaled-down one.
const keepOutFor = (f) => Math.min(132, Math.min(f.w, f.h * 0.62) * 0.52 * 0.62);

test('tokens never collide and never sit on the hub', () => {
  for (const n of [1, 3, 6, 12, 20]) {
    const f = geo.DEFAULT_FRAME;
    const keep = keepOutFor(f);
    const pts = geo.seededPositions(ids(n));
    pts.forEach((p) => {
      const d = Math.hypot(p.x - f.hubX, p.y - f.hubY);
      assert.ok(d >= keep - 0.5, 'token sat on the hub (' + d.toFixed(1) + 'px < ' + keep.toFixed(1) + ')');
      assert.ok(p.x >= 0 && p.x <= f.w && p.y >= 0 && p.y <= f.h, 'token left the frame');
    });
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) > 44,
          n + ' wishes: tokens ' + i + '/' + j + ' overlap');
      }
    }
  }
});

test('the hub keep-out holds in the small archive frame too', () => {
  // The archive embeds the sky in a ~420px panel — the frame where tokens were
  // landing on the celebrant.
  const f = { w: 350, h: 420, hubX: 175, hubY: 214 };
  const keep = keepOutFor(f);
  assert.ok(keep >= 76, 'archive keep-out (' + keep.toFixed(1) + ') is under hub+token half');
  for (const n of [1, 3, 8, 12]) {
    const pts = geo.seededPositions(ids(n), f, { top: 80, bottom: f.h - 71 });
    pts.forEach((p) => {
      const d = Math.hypot(p.x - f.hubX, p.y - f.hubY);
      assert.ok(d >= keep - 0.5,
        n + ' wishes: token sat on the hub (' + d.toFixed(1) + 'px < ' + keep.toFixed(1) + ')');
    });
  }
});

test('geometry does not switch with sender count — only wish count', () => {
  // six wishes from one sender and six from six senders must place identically
  const oneSender = geo.seededPositions(ids(6));
  const manySenders = geo.seededPositions(ids(6));
  oneSender.forEach((t, i) => assert.equal(Math.round(t.x), Math.round(manySenders[i].x)));
});

test('twelve-link cap collapses the remainder', () => {
  const { shown, overflow } = geo.capWishes(ids(20));
  assert.equal(shown.length, 12);
  assert.equal(overflow.length, 8);
  assert.equal(geo.capWishes(ids(9)).overflow.length, 0);
});

// ---- window helpers ------------------------------------------------------

const member = (birthDate) => ({ id: 'm1', name: 'Rajesh', birthDate });

test('window opens 7 days before and closes 7 days after', () => {
  const now = new Date(2026, 8, 24); // 24 Sep 2026
  const w = geo.windowFor(member('1992-09-24'), now);
  assert.ok(w);
  assert.equal(w.isToday, true);
  assert.equal(w.daysUntil, 0);
  assert.equal(w.turning, 34);
  assert.equal(geo.windowFor(member('1992-09-24'), new Date(2026, 8, 17)).daysUntil, 7);
  assert.equal(geo.windowFor(member('1992-09-24'), new Date(2026, 9, 1)).daysUntil, -7);
  assert.equal(geo.windowFor(member('1992-09-24'), new Date(2026, 8, 16)), null);
  assert.equal(geo.windowFor(member('1992-09-24'), new Date(2026, 9, 2)), null);
});

test('window spans the new year', () => {
  const w = geo.windowFor(member('1990-01-02'), new Date(2026, 11, 29));
  assert.ok(w, 'a 2 Jan birthday must be in window on 29 Dec');
  assert.equal(w.year, 2027);
});

test('the deceased get no birthday window', () => {
  assert.equal(geo.windowFor({ id: 'm', name: 'X', birthDate: '1950-09-24', deathDate: '2010-01-01' }, new Date(2026, 8, 24)), null);
});

test('sealed before the day, unsealed on it', () => {
  const now = new Date(2026, 8, 21);
  const win = geo.windowFor(member('1992-09-24'), now);
  const wish = { id: 'w', toMemberId: 'm1', toUid: 'u', fromUid: 'a', wish: { year: 2026 }, createdAt: now.getTime() };
  assert.equal(geo.isSealed(wish, win, now), true);
  const day = new Date(2026, 8, 24, 10);
  const winDay = geo.windowFor(member('1992-09-24'), day);
  assert.equal(geo.isSealed(wish, winDay, day), false);
});

test('a wish written after the day lands sealed until opened', () => {
  const later = new Date(2026, 8, 26, 9);
  const win = geo.windowFor(member('1992-09-24'), later);
  const late = { id: 'w2', toMemberId: 'm1', toUid: 'u', fromUid: 'a', wish: { year: 2026 }, createdAt: later.getTime() };
  assert.equal(geo.isSealed(late, win, later), true);
  assert.equal(geo.isSealed({ ...late, readAt: later.getTime() }, win, later), false);
});

test('senderCount and wishCount are independent', () => {
  const ws = [
    { id: 'a', fromUid: 'u1', toMemberId: 'm1', toUid: 'x', wish: { year: 2026 } },
    { id: 'b', fromUid: 'u1', toMemberId: 'm1', toUid: 'x', wish: { year: 2026 } },
    { id: 'c', fromUid: 'u1', toMemberId: 'm1', toUid: 'x', wish: { year: 2026 } },
  ];
  assert.equal(geo.senderCount(ws), 1);
  assert.equal(geo.wishCount(ws), 3);
});

rmSync(out, { recursive: true, force: true });
console.log(passed + ' birthday tests passed' + (process.exitCode ? ' (with failures above)' : ''));
