# Birthday sky — geometry flaw fix + full flow capture (2026-09-19, `fable_react`)

Follow-up to `2026-09-18-birthday-celebration.md`. Walked the whole celebration
in the **"Two of Us"** two-member family (the design's default case), fixed the
flaw filed in `flaws/`, and re-captured every beat.

## The flaw

`flaws/wishes nodes are too close to the person.png` — wish tokens crowding the
celebrant's hub, worst in the profile archive sky.

Root cause was in `src/shared/birthday.ts` → `seededPositions`:

1. Radii were seeded as `maxR * band` with bands `[0.42, 0.68, 0.95]`, while the
   hub keep-out was a hard `96`. On a phone frame the whole inner band fell
   **inside** the keep-out, so every one of those tokens was pushed onto the
   same correction circle — 96px from a hub that is 88px across plus ring and
   glow. They read as sitting on the celebrant.
2. The keep-out was enforced *inside* the relaxation loop, so a pair push later
   in the same pass could shove a corrected token straight back onto the hub and
   the loop would exit with it there.

### What changed

- Radii are now seeded **inside the ring**: `r = hubKeep + span * band`, bands
  `[0.12, 0.5, 0.94]`. No seed ever starts under the keep-out.
- `hubKeep` = `min(132, maxR * 0.62)` — the full keep-out on a phone, scaled down
  for the small archive panel instead of eating its whole radius.
- Keep-out is enforced **after each whole pass** and once more at the end, with a
  sideways/vertical fallback for when the margin clamp would push a token back in.
- `minSep` scales with the frame (`max(78, min(92, maxR * 0.44))`), and the
  separation test is now **elliptical** (`V_SQUASH = 1.3`): a token's caption
  hangs below it, so vertical crowding costs more than horizontal. This is what
  was making archive labels collide.
- `BirthdayArchive` sky panel `420 → 470`px — the keep-out and separation both
  scale with the frame, and 420 could not fund either. (520 was tried; it drops
  the hub below the fold of the profile scroll.)

## Two more defects found while shooting

- **Tokens flew through the celebration copy.** The opener copy stayed fully lit
  until the sequence ended, while the handover eases tokens up to seats above it.
  `BirthdaySky` now reports beats (`onBeat`), and `app/birthday.tsx` fades the
  copy out when the beat leaves `opener` — the copy leaves with the sender, which
  is what §4 wants anyway. Opener seat floor also raised (210 → `min(304, h*0.35)`).
- **No z-order on the birthday screen at all**, so a drifting token painted over
  the headline. Header now `zIndex: 2`, celebration copy `zIndex: 3`; tokens pass
  *under* the text during the drift-in.

## Files

`src/shared/birthday.ts` · `src/birthday/BirthdaySky.tsx` (+`onBeat` prop) ·
`src/birthday/BirthdayArchive.tsx` · `app/birthday.tsx` (beat state, CopyRise
`out` fade, zIndex) · `scripts/birthday.test.mjs` (+1 test) ·
`scripts/shot-birthday-light.mjs` (takes a port argument now).

## How to verify

```bash
cd mobile
npm run test:birthday     # 29 pass (was 28 — added the archive-frame keep-out test)
npx tsc --noEmit          # clean
npx expo start --web --port 8084
node scripts/seedBirthdayTest.mjs --yes     # live data; --clean undoes it
node scripts/shot-birthday-cases.mjs 8084   # Two of Us: 15 shots
node scripts/shot-birthday-sealed.mjs 8084  # sealed screen + leak check
node scripts/shot-birthday-light.mjs 8084   # dawn ridges
```

Shots: `scripts/shots/cases/` (current) and `scripts/shots/cases-before-fix/`
(the same 15 frames with the flaw, kept for comparison — delete when done).
No console or page errors in any run; `shot-birthday-sealed` reports
`seal leaks: none`.

## Rules: deployed and verified (2026-09-19)

`scripts/rulesProbe.mjs` exercises every write the celebration needs against the
LIVE rules and restores what it touches — **13/13**:

- recipient may set `read` + `readAt`, `repliedAt`, `reaction`
- sender may edit their own `text` + `wish` block
- rewriting `fromUid` or `toMemberId` is denied
- recipient keys and sender keys in ONE write are denied (`hasOnly` rejects the
  mix — two writes, one per branch, is the correct shape)
- a reply note can be created in the thread and deleted by its author
- an owner can create AND delete a tree doc — the path `seedBirthdayTest.mjs
  --clean` failed on before the deploy

Then end-to-end in the web build: opening a wish stamped `readAt` on exactly the
opened doc, and sending a reply stamped `repliedAt` on its wish. No console or
page errors.

Writing that probe surfaced a real bug, now fixed: `updateWish` passed the
composer's `undefined` straight through for a cleared text or photo, and the SDK
rejects `undefined` (this app never set `ignoreUndefinedProperties`). It now maps
`undefined` → `deleteField()`, so clearing a field deletes it.

## Still open
- Seeded test data is still in the live project (Rohan Mehta's birthday moved to
  today, "Two of Us" tree, 15 demo wishes). Undo with
  `node scripts/seedBirthdayTest.mjs --clean` — note the tree doc itself can't be
  deleted until the rules above are deployed (`--clean` warns and moves on).
