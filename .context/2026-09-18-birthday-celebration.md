# Birthday Celebration — full build (2026-09-18, branch `fable_react`)

Implements the Claude Design handoff `design_handoff_birthday_celebration`
(project `8b0060f6-f48e-454f-a71e-c9a790a74390`), all ten prompt stages.
`SPEC-FINAL.md` is authoritative; `README.md` in that bundle documents a deleted
geometry ladder and was ignored where the two disagree.

## What the feature is

For ±7 days around a member's birthday an orb floats over the bottom nav. Family
members post **wishes** (note / photo / Drive video). Wishes stay **sealed**
until the birthday, then unseal at once into a celebration that settles into the
member's **sky**: their node as the hub, one straight link out to each wish.

Two rules drive everything:
1. **Counting is per wish, never per person.** `senderCount` feeds copy only;
   `wishCount` feeds geometry. Nothing ever says "1 person wished you".
2. **Geometry never switches with family size.** Two members and twenty-five
   produce the same shape.

## Key decisions

- **Wishes reuse `trees/{treeId}/notes`** (chosen over a new collection) so
  replies, reactions and the existing rules keep working. A note is a wish iff it
  carries a `wish` block: `{ year, sticker?, media, videoUrl? }`, plus `readAt` /
  `repliedAt`. Wishes are filtered OUT of the Inbox list and its unread badge —
  surfacing one there would leak the seal.
- **Sealing is client-side.** The rules let the recipient read their own notes,
  so "sealed" is a display rule (`isSealed`), not a security boundary. Fine for a
  family app; worth knowing before anyone calls it privacy.
- **The sky owns the whole celebration.** Reveal → opener → handover → links all
  run inside `BirthdaySky` with the SAME mounted tokens, which is what makes the
  0.7s handover read as one object rather than a cut. Entrance sits on a wrapper,
  the permanent wander on the token inside it — both animate transform.
- **No conic gradients in RN**, so the ray crown is an SVG fan of rays masked to
  an annulus; **no mask in RN**, so the wall's light sweep fakes its vertical
  falloff with eight stacked gradient bands.

## Files

New — `mobile/src/shared/`
- `birthday.ts` — windows (`windowFor`/`openWindows`), wish selectors, `isSealed`,
  `seededPositions` (stable scatter, unequal radii/angles, relaxed for collisions),
  twelve-link cap.
- `birthdayCopy.ts` — the §7 copy ladder, spelled numbers, ordinals, `sealedLine`,
  the sealed-safe push title.

New — `mobile/src/birthday/`
- `BirthdaySky.tsx` — hub, links, tokens, wander, crown, opener, handover, links draw.
- `WishPaper.tsx` — token zooms into the polaroid; five reactions; reply lands in
  the existing notes thread and stamps `repliedAt`.
- `WishComposer.tsx` — "Add another", ordinal banner, sticker picker, star preview,
  prior-wish list with Edit.
- `BirthdayOrb.tsx` — bob, breathing rings, shimmer, sparkle, tick/numeric badge.
- `BirthdayArchive.tsx` — profile → Birthdays, one live sky per year (§6).
- `DawnRidges.tsx` — light-mode dawn range (§8). Dark never gets a ridge.
- `DesktopBirthdayPanel.tsx` — drawer wall + the toolbar cake tool (§9).
- `haptics.ts` — thud / tap / tick / press, no-ops off native.

New — routes & scripts
- `mobile/app/birthday.tsx` — sealed · celebration · wall on one screen.
- `mobile/scripts/birthday.test.mjs` — 28 tests (`npm run test:birthday`).
- `mobile/scripts/seedWishes.mjs` — demo wishes, `--yes` / `--clean`.
- `mobile/scripts/shot-birthday.mjs`, `shot-birthday-light.mjs`.

Edited: `types.ts` (Note.wish/readAt/repliedAt) · `firestore.ts` (markWishRead /
markWishReplied / updateWish) · `useInbox.ts` (wishes excluded) · `home.tsx` (gold
hero, gold celebrant row, orb) · `profile.tsx` (Birthdays tab) · `tree.tsx` +
`DesktopWorkspace.tsx` (gold celebrant node via the existing `colorOf` hook) ·
`NoteNotifier.tsx` + `reminders.ts` (no wish ever notifies; the celebrant's own
morning push is "It's your birthday — open your sky") · `package.json`
(expo-haptics pinned to ~56.0.3 — npm's default v57 is the SDK mismatch that
caused the earlier launch crash).

## ⚠️ Deploy the rules

`firestore.rules` notes block was extended — the old update rule allowed the
recipient only `['read','reaction']`, so **marking a wish read and replying would
both be rejected**, and a sender could not edit their own wish at all. Now:
recipient `['read','reaction','readAt','repliedAt']`, sender
`['text','image','subject','wish']`.

```bash
firebase deploy --only firestore:rules
```

Until that lands: reading a wish won't cool its link, replies won't stamp the
tick, and composer edits fail silently.

## How to verify

```bash
cd mobile
npm run test:birthday            # 28 copy + geometry + window tests
npx tsc --noEmit                 # clean
npx expo start --web --port 8082
node scripts/shot-birthday.mjs       # home orb → sky → composer
node scripts/shot-birthday-light.mjs # dawn ridges + sun-pinned hub
```

Verified in the web build: orb (gold border, breathing rings, bob), sky hub +
header + FAB, composer (ordinal banner, Spectral field, sticker picker, star
preview), light-mode ridges with the hub pinned in the sun glow. No console
errors in any run.

**Not yet verified with real data** — the seeded tree has no wishes, and creating
them writes to the live family tree. Run `node scripts/seedWishes.mjs --yes` (and
set that member's `birthDate` to today) to walk the celebration, tokens, links,
paper and archive, then `--clean`.

## Known divergences from SPEC

1. **Family-wide unsealing isn't possible.** §5 says everything unseals "for the
   family too" on the day, but the notes rules restrict reads to sender +
   recipient. Senders see only their own wishes; the celebrant sees all. Changing
   this needs a rules change that lets any tree member read wishes after the day.
2. **Multi-sender copy rungs are untested end to end** — rules require
   `fromUid == uid`, so one account cannot seed several senders. The ladder is
   unit-tested at 1 / 2 / 3 / 4 / 6 / 7 / 25.
3. **No sparkle on the in-canvas celebrant node** — the viz `colorOf` hook gives
   the gold border and halo; a sparkle would mean editing four view components.
4. **Video is embedded only on web** (Drive `/preview` iframe). No video library
   is installed, so native degrades to thumbnail + "Open in Drive" — never a
   broken player, per spec.


---

# Round 2 — full flow test (2026-09-19)

Seeded real data and walked every screen in the web build. `scripts/seedBirthdayTest.mjs
--yes` builds two scenarios (`--clean` undoes both, and restores the birthDate it
moved): **Mehta** with the signed-in user's own node moved to today plus seven
varied wishes, and **"Two of Us"**, a new two-member family (the design's default
case) with eight wishes from the one other member.

Captures: `scripts/shots/flow/` (17) and `scripts/shots/cases/` (17) via
`shot-birthday-flow.mjs`, `shot-birthday-cases.mjs`, `shot-birthday-sealed.mjs`.

## Bugs found and fixed

1. **`collapsable` DOM warning** — `Animated.createAnimatedComponent` leaks
   `collapsable={false}` onto SVG elements on web. Applied the repo's existing
   `sansCollapsable` shim (as in `viz/RadialView.tsx`) to Line, Circle and G.
2. **No ambient background** — the screen painted `c.bg` over the root layout's
   starfield. Now transparent in both modes, like every other screen.
3. **Polaroid unreachable/clipped** — a tall card overflowed the viewport with no
   scroll. Each card is now bounded to the frame and scrolls internally, cards are
   vertically centred, the photo is capped at 210px, and the close button moved
   off the card's own corner onto its own chip.
4. **Inbox read "Inbox (1)" over "No notes yet"** — a REPLY to a wish has no `wish`
   block, so it passed the badge filter while the list (roots only) dropped it.
   `useInbox` now matches replies through their root.
5. **`🥹` rendered as tofu** on Windows Chrome — swapped for `😊`.
6. **"Your first cousin's wife wrote to you eight times"** — the kinship engine
   returns whole paths, and §7's relationship-over-name rule made the headline
   worse, not better. A relationship now only wins when it is a single word.
7. **Token crowding** — labels overlapped each other and the chrome. Minimum
   separation 74→92px, margin 46→72px, and the scatter now reserves the header /
   copy band and the CTA strip, scaled to the frame so the 420px archive panel
   doesn't squeeze every token into one ribbon.
8. **The opener showed the wrong face**, and read tokens showed the wrong name —
   both looked the sender up by `associatedUserId`, which finds the account owner
   rather than who the wish says it is from. Everything now resolves through
   `senderMember` (fromMemberId first); `BirthdaySky`'s `memberByUid` prop became
   `senderOf(wish)`.
9. **Opener tokens escaped the frame** — the opener seats weren't clamped, so
   tokens landed under the copy and off the right edge.
10. **Broken video player** — an invalid/unshareable Drive link rendered Google's
    own error page inside the paper. The embed is now opt-in behind a poster, with
    "Open in Drive" always one tap away.
11. **Sealed screen showed the viewer's initials** on the unlit token instead of
    the sender's — the same uid-lookup bug.

## Verified working

Gold hero · orb (bob, rings, shimmer, tick badge) · gold celebrant row · crown
bloom · opener drift-in · handover · links drawing one by one · resting wall ·
polaroid with photo/sticker/reactions/reply · composer with ordinal banner and
star preview · light-mode dawn ridges with the hub pinned in the sun · reduced
motion (static, nothing loops) · archive with a live per-year sky · desktop cake
tool + drawer wall · sealed state (calm grey "3d" orb, countdown, no count, and
an automated check that no wish count or preview text reaches the page).

Zero console errors across every run.

## Still open

- **No multi-celebrant picker.** With two members celebrating on the same day the
  orb surfaces only the nearest window; the design's 2b picker sheet isn't built.
- **Multi-sender rungs still untested end to end** — Firestore requires
  `fromUid == uid`, so one account can't seed several senders. Unit-tested only.
- The in-canvas celebrant node gets its gold border via `colorOf` but no sparkle.
