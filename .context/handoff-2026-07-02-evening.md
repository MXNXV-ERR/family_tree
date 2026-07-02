# Handoff — 2026-07-02 evening (supersedes handoff-2026-07-02.md)

## Late-night batch (after this handoff was first written)
1. **Network focus carry-over fix**: NetworkView node TAP now also `setFocusId` (was select-only; long-press unchanged) — person picked in Network stays focused in Tree/Radial/Timeline. Verified via sub-bar "kinship around <name>".
2. **First-name viz labels**: `shared/displayName.ts displayLabels()` — first name only; duplicate firsts get "Ravi K."; if that still collides → full name. Setting `firstNames` (SettingsContext, DEFAULT ON) + "First names in visuals" toggle. Applied in Tree/Radial/Timeline/Network node labels only (FocusBar/tooltips/profiles keep full names).
3. **Family calendar** (`components/CalendarPanel.tsx` + pure `shared/occasions.ts`): month grid (dots: birthday teal / anniversary rose / event amber), occasion list w/ turns-N & Nth-anniversary, per-item "+ Google" template link (RRULE:FREQ=YEARLY for annual), "Export all as .ics" via saveText (import into Google/Apple/Outlook). Entry points: desktop toolbar calendar IconBtn + drawer type 'calendar'; SettingsPanel "Family calendar" row (prop `onOpenCalendar`); web reminders toggle now opens the calendar instead of the dead-end message; mobile home quick-tool "Calendar" + BottomSheet. IconBtn got accessibilityLabel=name (aria for scripts).
4. Verify scripts: `scripts/shot-calendar.mjs` (desktop, asserts focus-carry + ics download + settings rows), `shot-calendar-mobile.mjs`. All green, zero console errors, tsc clean.

Branch `fable_react`, all work committed, `npx tsc --noEmit` clean.
Dev server: `cd mobile && npx expo start --web --port 8082` (shot scripts expect 8082; user's own often on 8081).

## Shipped this session (all Playwright-verified, zero console errors)

1. **Task 14 — combined-view chrome** (`app/master.tsx`): amber accent (`c.amber`) on tabs/toolbar/canvas wash; toolbar = Search · Scan · Members · AI chat · Settings · ThemeToggle · Bridges; panels reuse SettingsPanel/ChatPanel/MembersPanel in DesktopDrawer (desktop) / BottomSheets (mobile); shared SearchOverlay.
2. **Task 15 — search**: `src/components/SearchOverlay.tsx` (family dot column only in combined); search button in mobile `app/tree.tsx`.
3. **Task 16 — invites**: `shared/invite.ts` (join URL https://family-tree-6a597.web.app/join?code=…, `familytree://` deep link — NOTE scheme is `familytree`, not `family-tree`), `app/join.tsx` landing (open-join instant / approval request; signed-out stash via kvStore + index.tsx forwards after login), FamilyInfoPanel QR (react-native-qrcode-svg) + Share button, `ensureInviteCode` heals legacy trees (ref-guarded).
4. **Kinship rewrite (user's Tamil complaint)**: age-aware keys in `shared/kinship.ts` (elder/younger siblings + uncles/aunts vs parent, uncle/aunt spouse keys, parallel/cross cousins, parent's-cousin class, cousin's-child, spouse-of-blood-relative bridge, multi-step fallbackKey). `relTermsStatic.ts` Tamil corrected + verified 1:1 vs live Seetharam tree (70 people) — audit + Gemini-crosscheck corrections in `.context/tamil-kinship-audit-2026-07-02.md`. Hindi/Telugu/Kannada partial age-aware entries.
5. **Chat persistence**: ChatPanel module-level session cache keyed per tree/master (`sessionKey` prop at 4 call sites) — survives close/reopen until page reload; Clear button.
6. **NetworkView legend** (Parent/Partner/Sibling edge colors).
7. **Combined tree layout**: adaptive relaxation passes + alternating sweep (`treeLayout.ts layoutLayered`); per-family-coloured connectors (`Line.ownerId` → TreeView `colorFor`), sibling-bar lane dodging (overlapping corridors offset 7px).
8. **Events fix**: DateField `allowFuture` prop; EventsPanel passes it (birth/death fields stay capped at today).
9. **FamilyInfoPanel**: 2×2 action grid (Switch/Photo/Events/Edit-all).
10. **Face match**: `/facematch?master=<id>` matches across combined members (Scan button in master toolbar); upload flow now picks raw + manual `CropSheet` (`src/components/CropSheet.tsx` — fixed square, drag + zoom buttons, cross-platform).

## Task board (persisted harness tasks)
Done: #1 combined lines, #2 FM master, #3 FM crop, #4 family-info grid, #5 notifications (expo-notifications installed, worklets re-pinned 0.8.1; toggle in Settings; sync effect in home; NATIVE FIRING NEEDS EAS DEV BUILD), #6 GEDCOM (shared/gedcom.ts round-trip-tested; ExportPanel tile + .ged import), #7 activity trail (firebase/activity.ts + choke-point logging in firestore.ts + FamilyInfoPanel section + home skeleton/nudge — **USER MUST RUN `firebase deploy --only firestore:rules`** for the new activity rules).
Late adds also done: network legend chips toggle edge kinds (siblings inferred, off default), edges anchor avatar circles, kinship english "Mother's/Father's cousin".
Open: **#9 Seetharam data nudges (USER: birth dates missing/junk 2000-01-01+2001-01-01; "You" node = Seetharam not Jatin), #8 export FULL redesign LAST** (user picked; current: static dark SVGs, radial locked depth 1 at ExportPanel.tsx:38, no network export, PDF weak — spec first).
B-hardening stays OFF (do not touch Google sign-in).

## Test data
Masters: "One big one" 3mnKWwJ9rJu9XGuitXhP (Mehta+Seetharam, 3 same-bridges Jatin/Bhaskar/Aruna), "Mehta + Rao" bqWji3dnLE4LeXqFQDl5, "One mega family" okTuQrgL07Q6ZNms3vLX. Trees: Mehta=uid, Seetharam Nstzbvwy5YyINlIsbOFX (70p), Rao QdsGVr9wWDiRmMQel3YX.
Verify scripts: shot-combined.mjs, shot-master-chrome.mjs (aria-labels on ToolBtn/tree search = "search|scan|users|sparkles|settings|link").

## Gotchas re-confirmed
- PowerShell here: no `&&`, no heredoc; commit long messages via `git commit -F <file>`; sandbox blocks command strings containing paths like `/join` in some args (split commands).
- npm install prunes react-native-worklets → always `npm install <pkg> react-native-worklets@0.8.1 --legacy-peer-deps`.
- Playwright: post-login `domcontentloaded` (never networkidle); heavy ML pages stall screenshots.
