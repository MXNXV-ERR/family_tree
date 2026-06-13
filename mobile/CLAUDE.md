@AGENTS.md

# Mobile app (Expo React Native)

The active product — a full rewrite of the root Next.js web app on Expo
(managed). One codebase targets **Android, iOS, and web** (react-native-web).

## Commands

```bash
npm install --legacy-peer-deps   # REQUIRED — tfjs peers need legacy resolution
npx expo start                   # press w (web) · a (Android) · i (iOS)
npx expo start --web --port 8082 # web only (the port the shot scripts expect)
npx tsc --noEmit                 # typecheck (no test suite)
```

Run all commands from `E:/Software Projects/family_tree/mobile`, **not** the repo
root — the root has its own (Next.js) `expo`/no-main setup and `npx expo start`
there falls back to the default `expo/AppEntry` and fails.

### Install gotcha (read before any `npm install`)

`npm install` here **prunes `react-native-worklets`** (reanimated 4 needs
`0.8.x`). After ANY install, re-add it or the bundle breaks with
`Unable to resolve "react-native-worklets"`:

```bash
npm install <pkg> react-native-worklets@0.8.1 --legacy-peer-deps
```

## Environment

`.env` (EXPO_PUBLIC_ prefix, not NEXT_PUBLIC_): `EXPO_PUBLIC_FIREBASE_*`,
`EXPO_PUBLIC_GEMINI_API_KEY`, and optional `EXPO_PUBLIC_GOOGLE_{WEB,ANDROID,IOS}_CLIENT_ID`
(Google sign-in stays disabled until at least one is set). Firebase project is
`family-tree-6a597`, shared with the web app. See `SETUP.md` for EAS build +
Google-auth setup.

## Stack

Expo SDK 56 (RN 0.85, React 19.2) · expo-router (file-based) · Firebase JS SDK
v12 · react-native-svg + react-native-gesture-handler + react-native-reanimated 4
(pan/zoom) · expo-blur (glass) · @tensorflow/tfjs (face match) · @google/generative-ai
(chat) · xlsx + expo-print/-sharing/-file-system (export) · expo-google-fonts.

## Layout

```
app/                       ← expo-router screens (file = route)
  _layout.tsx              ← font load gate, providers, LogBox filter, Stack
  index.tsx                ← redirect: /home if signed in else /login
  login · home · profile · member · link · tree · facematch · chat · export
src/
  shared/                  ← PURE logic, DOM-free, ported from the web app
    types.ts               ← Member, Relationship (+ marriageDate), TreeMetadata
    adjacency.ts           ← buildAdjacency(), computeGenerations(), yearOf, lifespan, initials
    treeLayout.ts          ← pyramid / inverted / hourglass layout math
    radialLayout.ts        ← radial ring layout (relaxRing)
    relationshipActions.ts ← planRelationship(): cascade + validation (pure)
    relationshipLogic.ts + relationTo.ts ← BFS path → "Your grandparent"
    validation.ts          ← validateMember()
    photo.ts               ← pick/capture → crop prompt → compress < 1 MB base64
    gemini.ts              ← chat(): serializes tree into the system prompt
    exportData.ts / importData.ts ← JSON/CSV/XLSX/SVG/PDF builders + merge planner
  viz/                     ← TreeView · RadialView · TimelineView · ZoomPanCanvas · vizChrome
  face/                    ← faceEngine.{web,native}.ts (tfjs) + faceMatch + faceRunner
  export/                  ← fileExport.{web,native} (download vs share) + treeImage.{web,native}
  firebase/                ← config · AuthContext · firestore · useFamilyTree · families · FamilyContext
  theme/                   ← theme.ts (tokens+font map) · fonts.ts · ThemeProvider · GlassSurface · SettingsContext
  ui/                      ← Icon.tsx (line-icon set) · primitives.tsx (Avatar/IconBtn/Counter/ThemeToggle/Rise) · useResponsive
  components/              ← MemberForm · LinkForm · ChatPanel · BottomSheet · panelChrome · SettingsPanel · FamilyPickerPanel · FamilyInfoPanel
  desktop/                 ← DesktopWorkspace · DesktopDrawer · DesktopProfile (web wide-screen only)
```

### Platform-split files

Metro resolves `./x` to `x.web.ts` (web) / `x.native.ts` (native), with `x.ts`
as the TS-checker fallback. Used by `face/faceEngine`, `export/treeImage`. The
**native tfjs face engine cannot run in Expo Go or on web** — it needs an EAS
dev build. The web face engine runs the same pipeline on the WebGL backend.

## Data model & conventions

Firestore: `trees/{uid}` (TreeMetadata) · `trees/{uid}/members/{id}` ·
`trees/{uid}/relationships/{id}` — one tree per signed-in UID.

Relationship edges (`Relationship`):
- `parent` — directed, `fromId` = CHILD, `toId` = PARENT.
- `spouse` — bidirectional (two docs); optional `status: 'current' | 'divorced'`
  and `marriageDate` (powers anniversary events on the timeline).
- `sibling` — bidirectional; inferred from shared parents in the visuals.

Writes: direct member CRUD via `firebase/firestore.ts`; relationship links via
`shared/relationshipActions.planRelationship()` (pure plan: cascade + hard-block
reasons + soft warnings) → `firestore.addRelationships()`. Imports merge via
`importData.planMerge()` → `firestore.commitMerge()` (skips duplicate members by
name+birthDate and existing edges by from|to|type).

## Theme & type system

Dark is the DEFAULT; light is a warm paper tone. Tokens + the font-family map
live in `theme/theme.ts` (`font.*` — Newsreader serif display, Plus Jakarta Sans
body, Spline Sans Mono meta). RN needs an exact font family per weight — use
`font.sansSemi` etc., never rely on `fontWeight` synthesis. Every surface uses
`GlassSurface` (BlurView; translucent View + backdropFilter on web). All icons
come from `ui/Icon.tsx` — no emoji in UI.

## Verifying changes

No device here — verify the **web build** with Playwright:
`scripts/shot*.mjs` load `localhost:8082`, log in
(`jatin75b@gmail.com` / `password`), screenshot, and report console errors
(the react-native-svg responder warning is filtered). After adding a route,
restart `expo start` so expo-router regenerates `.expo/types` before `tsc`.

## Multi-family (membership model)

A user can belong to several trees and switch between them (the design's family
switcher + Family-info panel). Implemented as a membership restructure:

```
trees/{treeId}                       ← FamilyTree metadata (ownerUid, name, mono, color, inviteCode, …)
trees/{treeId}/members|relationships ← tree data (unchanged)
trees/{treeId}/memberships/{uid}     ← collaborators + role
users/{uid}/families/{treeId}        ← per-user index that drives the switcher
```

The **legacy single tree keeps `treeId === ownerUid`**, so existing data and the
old security rules keep working. `firebase/FamilyContext.tsx` backfills the
primary family, subscribes to the user's families, and tracks `activeTreeId`
(persisted per-uid). **Every data screen reads `activeTreeId` from `useFamily()`**
— not `user.uid` — and `useFamilyTree(treeId)`/the `firestore.ts` CRUD take a
treeId. `firebase/families.ts` has `createFamily` / `joinFamilyByInvite` /
`subscribeMyFamilies` / `ensurePrimaryFamily`.

**Deploy the rules.** New families use generated treeIds, which the old
`uid === treeId` rules forbid. The updated membership-aware rules live in the
repo-root `firestore.rules` — run `firebase deploy --only firestore:rules`.
Until then the app degrades gracefully to the single primary tree (the family
listeners swallow permission errors); create/join silently fail.

## Responsive desktop workspace

On web at width ≥ 900 (`ui/useResponsive.ts`), `app/home.tsx` renders
`desktop/DesktopWorkspace.tsx` instead of the mobile home: a top toolbar (family
switcher · Radial/Timeline/Tree switch · search · face-match/people/settings/AI/
add), a sub-bar with live counts, the shared visualizers as the canvas, and a
right `DesktopDrawer` that hosts the profile / member form / settings / family
info / chat. Native + narrow web keep the mobile layout.

## Settings & display prefs

`theme/SettingsContext.tsx` persists `years` / `glass` / `motion`. `GlassSurface`
falls back to a solid surface when glass is off; `Rise`/`Counter` skip animation
when motion is off. The shared `components/SettingsPanel.tsx` (theme cards +
toggles + sign out) is shown in the mobile `BottomSheet` and the desktop drawer.
Shared panel chrome (`SheetHead`, `Toggle`) lives in `components/panelChrome.tsx`.
