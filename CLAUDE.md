# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
```

No test suite is configured.

## Environment

Requires `.env.local` at the project root:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_GEMINI_API_KEY=
```

## Architecture

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Firebase v12 · Framer Motion

### Data model (`src/types/tree.ts`)

Two core Firestore types:
- `Member` — a person node. `associatedUserId` links a member to an app user account (the "You" badge).
- `Relationship` — a directed edge with `type: 'parent' | 'spouse' | 'sibling'` and optional `status: 'current' | 'divorced'`.

### Firestore structure

```
trees/{userId}                    ← TreeMetadata (name, inviteCode, allowedUsers[])
trees/{userId}/members/{id}       ← Member documents
trees/{userId}/relationships/{id} ← Relationship documents
```

Each user's tree is scoped under their own UID. Shared trees grant access via `allowedUsers[]` on the owner's tree document.

**Firestore security rules required:**
```js
match /trees/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == userId;
}
match /trees/{userId}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

### Auth

Google Sign-In only (`src/context/AuthContext.tsx`). The selected tree ID is persisted in `localStorage` as `activeTreeId`. On project/account change, this key must be cleared or it causes permission errors (stored UID won't match new user's UID).

### Data flow

```
useFamilyTree(treeId)          ← real-time Firestore listeners
  → members[], relationships[]
    → FamilyExplorer            ← primary visualizer (3 views)
    → GeminiChat                ← receives members+relationships for context
```

Write operations go through two paths:
- **Direct edits** (add/update/delete member): `src/lib/firebase/firestore.ts`
- **Semantic actions** (addChild, addSpouse, addSibling): `src/lib/familyExplorer/familyActions.ts` — these cascade-create relationships automatically (e.g. addChild also links the parent's spouse)

### Relationship edge convention

`parent` edges are directed: `fromId` = child, `toId` = parent. So "Alice is Bob's child" is stored as `{ fromId: Alice, toId: Bob, type: 'parent' }`.

`spouse` edges are stored bidirectionally (two documents, one in each direction).

`sibling` edges are stored bidirectionally but are **filtered out of the visual graph** in `FamilyTreeGraph` — siblings are inferred from shared parents instead.

### FamilyExplorer component (`src/components/familyExplorer/`)

Self-contained visualizer with three views (Radial, Timeline, Tree). Key internals:

- `FamilyExplorer.tsx` — shell with tab routing and search
- `common.tsx` — shared UI (Avatar, MemberCard, SearchBox, ProfileModal, ThemeToggle, `FamilyExplorerThemeProvider`)
- `family-explorer.css` — all styles scoped under `.family-explorer`. Dark mode activates via `.dark .family-explorer` (Tailwind parent) or `[data-theme="dark"]` attribute.
- `src/lib/familyExplorer/adjacency.ts` — `buildAdjacency()` builds the in-memory graph used by all three views. `computeGenerations()` assigns generation numbers for layout.

`FamilyExplorerThemeProvider` syncs with the app's Tailwind dark class via `MutationObserver` on `document.documentElement`. Do not reintroduce independent `localStorage`-based theme state here.

### Legacy graph (`src/components/tree/FamilyTreeGraph.tsx`)

ReactFlow + Dagre layout. Uses "virtual cluster" grouping: spouses are merged into a single Dagre node so they render side-by-side, then unpacked to individual positions. Still used alongside `FamilyExplorer`.

### Face recognition

`src/services/faceRecognition.ts` uses `face-api.js`. Models are loaded from `/public/models/`. The `FaceSearchDialog` captures webcam frames, matches against stored `photoUrl` base64 images on members, and returns the best match.

### Gemini chat

`src/components/GeminiChat.tsx` + `src/lib/gemini.ts`. The full `members[]` and `relationships[]` arrays are serialized into the system prompt so the model can answer relationship questions.
