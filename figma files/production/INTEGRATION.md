# Family Explorer — integration guide

A drop-in replacement for `FamilyTreeGraph` that gives you **three view modes** (Radial, Timeline, Tree) with proper interactions: click-to-recentre, depth slider, time-axis zoom, three tree layouts, search, profile modal, animated dark mode, SVG export.

## What's in this folder

```
production/
├── INTEGRATION.md            ← you are here
├── family-explorer.css        ← all styles (scoped under .family-explorer)
├── lib/
│   └── adjacency.ts           ← shared adjacency index + generation calculator
└── components/
    ├── common.tsx             ← Avatar, MemberCard, ProfileModal, SearchBox, ThemeToggle, Icons
    ├── RadialView.tsx
    ├── TimelineView.tsx
    ├── TreeView.tsx           ← 3 toggleable layouts (Pyramid / Ancestors / Hourglass)
    └── FamilyExplorer.tsx     ← top-level wrapper — this is what you mount
```

Total ≈ 1700 LOC, no extra runtime dependencies beyond what you already use (React 19, Next 16, Firebase). React-Flow and Dagre are NOT needed for these views.

## Drop-in steps (copy/paste safe)

### 1. Copy files into your codebase

```bash
# from this folder
cp lib/adjacency.ts      family_tree/src/lib/familyExplorer/adjacency.ts
cp family-explorer.css   family_tree/src/components/familyExplorer/family-explorer.css
cp components/*.tsx      family_tree/src/components/familyExplorer/
```

Adjust paths to taste. The components reference `@/types/tree` and use a relative import `../lib/adjacency` — keep `adjacency.ts` one folder above `components/` or update the imports.

### 2. Extend the `Relationship` type

The prototype supports divorces. Add a single optional field to `src/types/tree.ts`:

```ts
export interface Relationship {
  id: string;
  fromId: string;
  toId: string;
  type: RelationshipType;
  status?: 'current' | 'divorced';   // ← add
}
```

No migration needed — `undefined` is treated as `'current'`. Existing Firestore docs keep working.

If you want a real "Mark divorced" UI in the future, add a select to `AddRelationshipDialog.tsx`. For now the prototype data path is fine.

### 3. Load fonts + CSS in your root layout

`src/app/layout.tsx`:

```tsx
import './globals.css';
import '@/components/familyExplorer/family-explorer.css';   // ← add

// Fonts via next/font (preferred) or a <link> in <head>:
// - "Public Sans"        (UI)
// - "Instrument Serif"   (display, italic — used for headings + names in modal)
// - "JetBrains Mono"     (mono — used for dates + small labels)
```

If you prefer your existing font stack: edit the `--fe-display / --fe-ui / --fe-mono` vars at the top of `family-explorer.css`. The visual identity will adapt.

### 4. Replace `FamilyTreeGraph` in the dashboard

`src/app/dashboard/page.tsx`:

```diff
-import { FamilyTreeGraph } from '@/components/tree/FamilyTreeGraph';
+import { FamilyExplorer } from '@/components/familyExplorer/FamilyExplorer';

  // ...inside JSX...
- <FamilyTreeGraph
+ <FamilyExplorer
    members={members}
    relationships={relationships}
    loading={treeLoading}
    treeId={viewTreeId}
    focusNodeId={focusNodeId}
+   userId={user.uid}                            // tells the component which member is "You"
  />
```

The `userId` prop is what makes the "Me" auto-focus + the "You" badge work. The component looks for `members.find(m => m.associatedUserId === userId)` on mount.

### 5. (Optional) Hook the Profile modal back to your existing flows

The modal in `common.tsx` is a self-contained read-only summary with chips for partners/parents/children/siblings. If you want **Edit** to keep launching the existing `MemberDialog`, swap it in:

```diff
- import { ProfileModal } from './common';
+ import { MemberDialog } from '@/components/tree/MemberDialog';
+ // ...and replace <ProfileModal/> in FamilyExplorer with your dialog
```

Then your face-search, "Edit Member", and chat-driven focus flows keep working exactly as before — only the visualisation changes.

## How each fix maps to your three complaints

| Complaint | What I did |
|---|---|
| **Radial — clicking doesn't focus properly** | Stage is anchored to canvas centre `(left:50%; top:50%)`. Clicked person becomes the new focus and the layout animates to a sector-ring arrangement around them (parents top, partner right, children bottom, siblings left). A depth slider expands to grandparents / cousins / great-grandparents. There's also a toggle to switch between "Re-centre on click" and "Highlight only" modes. |
| **Timeline — no zoom in/out** | The time axis is continuous (px-per-year). Wheel / pinch zooms around the cursor, slider zooms explicitly, +/- buttons step. Tick density auto-adapts: decade ticks at low zoom → 5-year → yearly as you zoom in. Three render modes: Birth dot (default), Lifespan bar, Lifespan + life events. |
| **Tree — looks like a flowchart, not a family tree** | New SVG-based layout with three toggleable directions. Couples render as a single bordered pill with `♡` (or `⊘` for divorced) instead of two adjacent nodes joined by a line. Classic bracket drop-lines (vertical from couple → horizontal sibling bar → vertical to each child). Cross-marriages (e.g. someone whose two parents come from different families in the dataset) are deduplicated via a "primary parent" rule that prefers the bloodline parent over the in-law. |

## Implementation notes worth knowing

- **Adjacency is built once** via `useMemo` inside `FamilyExplorer` and passed to all three views. No re-walking the relationship array per render.
- **No Firestore writes** from this code. All state is local (focusId, view mode, zoom/pan). Persist `focusId` to localStorage if you want it to survive reloads — one line in `FamilyExplorer`.
- **Generation computation** propagates from blood parents first, then to spouses, so in-laws sit in their partner's generation row in Timeline (Sarah ends up in Gen 3 alongside Michael, not in Gen 1 with the great-grandparents).
- **Theme** lives in a context inside the explorer and is persisted to `localStorage` under `fe-theme`. Light/dark transition uses the View Transitions API (circular reveal from the toggle button) where supported, falls back to a plain swap on Firefox.
- **Export** writes an SVG by wrapping the live DOM in a `foreignObject`. Good enough for screenshots / "share my tree" use. If you need PNG, pipe the SVG to a canvas or use `html-to-image`.
- **Mobile** is the default — header collapses into a column, tabs widen, the radial overlay panels become a footer strip. Tested down to ~360px wide.

## Open follow-ups (not implemented — flag if you want them)

- Pinch-to-zoom on iOS Safari for the Tree canvas (current wheel-zoom logic works on trackpads; touch needs `gesturechange` handlers).
- Persist `focusId` + last `view` to URL hash so users can deep-link.
- Collapse / expand sub-trees in Tree view (state is in place — just needs a UI hook).
- Real PNG export (currently SVG only).
- Marriage dates on `Relationship` (would unlock proper marriage markers on the Timeline's "events" mode).

Ping back with what you'd like next.
