# Flaws round: viewport dvh · radial order+reflow · couple-pill lines · sky objects · panel polish (2026-07-09, fable_react)

## What changed & why

Driven by screenshots in `flaws/` + user asks.

1. **Web viewport (mobile cut-off fix)** — `app/_layout.tsx`: root `minHeight:'100vh'` → `'100dvh'`. Mobile Chrome's 100vh is the LARGE viewport (URL bar hidden) and expo-router's injected CSS has `body{overflow:hidden}`, so every bottom-anchored element (chat input, radial legend, focus bar, home nav) sat below the fold. dvh tracks the URL bar; unsupported browsers fall back to `#root{height:100%}`.
2. **BottomSheet** (`src/components/BottomSheet.tsx`) — height capped at `winH - 48`; grab handle now a PanResponder drag zone: swipe down >80px or fast flick dismisses, else springs back.
3. **Tree couple-pill connectors** (`src/shared/treeLayout.ts` + `TreeView.tsx`) — new exported `PILL_PAD = 6` (the pill's overhang beyond the cards). All three layouts (pyramid/layered/hourglass) now start the outgoing drop at `meY + NODE_H + PILL_PAD` and end incoming drops at `nextRowY - PILL_PAD` when the end node is a couple; `layoutInverted` grew a `focusTopPad` param so the hourglass ancestor drop stops at the focus pill border. Lines no longer pierce the gold border or run through the spouse gap.
4. **Radial nodes-before-lines** (`src/viz/RadialView.tsx`) — spokes are now grouped by target ring and rendered as one `DrawLines` per ring with delay `base(620 relayout / 0 first-mount) + min(lastIdxInRing*18, 340) + 220 + depth*90`, all divided by `revealSpeed`. Mirrors the MorphNode entrance stagger so a ring's cards are visibly in before its lines draw, cascading inner→outer.
5. **Radial per-depth reflow** (`src/shared/radialLayout.ts`) — `arc()` replaced by `weightedArc()`: each node's angular slice is proportional to its subtree weight (descendant count within the current neighborhood, accumulated deepest-first via viaId). Weights change with the depth slider, so inner rings re-solve and MorphNodes glide — the tree-view generations-slider feel — while the focus stays pinned at 0,0. Equal weights reproduce the old spacing exactly (slot-centre math), then `relaxRing` de-overlaps as before.
6. **Ambient sky** (`src/ui/AmbientBackground.tsx`) — shooters 3→6 (gaps 3.6–9s + phase offsets), plus: rare big `COMET` (140×3 streak, ~64s cycle), 2 `Satellite` crossers (2.5px dot, 32/42s traverse, blink), 4 `DriftMote`s, and a `ConstellationShimmer` (self-drawn 4-dot cluster joins with hairlines every ~26s). Light mode gets its own layer gated by new `showDay` (`mode==='light' && stars>0`): 7 warm-ink motes + 2 faint ink streaks + 1 ink satellite. All RN Animated, useNativeDriver, gated by `motion`.
7. **Collapsible legend** (`src/viz/vizChrome.tsx` `CollapsibleLegend`) — tap header to collapse to an info chip; starts collapsed under 900px width. Used by RadialView (relationship legend) + TimelineView (events legend).
8. **PanelScroll** (`src/components/panelChrome.tsx`) — bounded (`flex:1`) ScrollView wrapper with SVG top/bottom edge fades + default `paddingBottom:28`. Swapped into Settings/UserProfile/FamilyInfo/FamilyPicker/Members/Calendar/Events/Export/FamilyPhotoFlow/DesktopProfile panels — fixes the desktop drawer bottom clipping.
9. **Chat keyboard inset** (`src/ui/useViewportInset.ts` + `ChatPanel.tsx`) — web-only visualViewport listener; composer row pads up by the keyboard overlap (dvh does NOT track the keyboard).

## Verify

`npx tsc --noEmit` clean. `scripts/shot-flaws.mjs` (Playwright, needs `npx expo start --web --port 8082`): sky object counts, radial focus anchor across depth change, legend collapse, settings drawer Sign-out reachable, mobile 390×740 root height == innerHeight, chat input inside viewport. Frame captures `fl-radial-f0..4.png` show nodes landing before lines. True URL-bar behavior needs a real phone — dvh verified only by root-height assertion.

## Round 2 (same day): themed sky · sibling age-order · tree line cascade

1. **Sky rework** (`AmbientBackground.tsx`): `stars` slider is now a BOTH-modes density dial (label mode-swaps: "Star density"/"Cloud density", key unchanged). Dark adds shaped stars (4/5-point paths, ~5% of field), one Saturn on the far strip (`stars>=60`), a wandering fade-in/out `Nebula` (`stars>=100`), exactly one `Moon` (crescent path + glow pulse, shown even with motion off). Light mode: ink satellite + ink streaks REMOVED; added one `Sun` with god rays (static-friendly), `DriftCloud`s, respawning `Plane`/`Balloon`/`Birds` flocks + warm motes. Rare movers (meteors, comet, satellites, plane, balloon, birds, nebula) use the **`useSpawn` respawn pattern** — each pass re-randomizes position/speed/gap, so nothing loops a fixed track; state lives in leaf components (starfield never re-renders), all `useNativeDriver`. Perf: fine — verified respawn randomness + 0 console errors.
2. **Sibling age order**: `Member.birthOrder?: number` + `compareByAge` in `adjacency.ts` (**year always wins**; birthOrder only orders the undated). Applied in `treeLayout` (makeKidsOf + layered layer sorts), `radialLayout` (sector/byVia groups now age-sorted), `TimelineView`, `exportData` generation chart. New `SiblingOrderSheet` (`src/components/`): whole family grouped by generation, up/down within a generation only, Save stamps `birthOrder = 1..n per generation` via `bulkUpdateMembers`. Entry: "Order" button on the Siblings group in `app/profile.tsx` (BottomSheet) and `DesktopProfile` (drawer `type:'order'` in DesktopWorkspace).
3. **Tree line cascade** (`TreeView.tsx`): connectors grouped by start-row (`floor(firstMoveY/ROW_H)`), one `DrawLines` per row, delay `(mounted?560:120)+row*110)/revealSpeed` — parent rows draw before children after the generations slider (mirrors radial's ring cascade). `drawKey` now includes `genLimit`; the `lineFade` dip only runs for big trees (`!animate`).
4. **Gotcha**: react-native-svg `rotation`+`originX/originY` props leak a dash-case `transform-origin` DOM attr on web (React error toast). Use a standard `transform={"rotate(a x y)"}` string instead (Moon/Saturn).

Verify: `scripts/shot-sky.mjs` (needs web on 8082) — dark/light inventories, respawn randomness (meteor positions differ across 9s), settings labels, tree cascade frames, order-sheet opens. All passing, 0 console errors.

## Notes / gotchas

- RN-web passes `'100dvh'` through untouched; browsers without dvh drop the declaration (fallback = #root height:100%).
- Any new ambient mover: follow the `phase`+`gap` Animated.loop pattern, gate on `motion` and `showStars`/`showDay`.
- `PILL_PAD` is the single source of truth for pill overhang — TreeView geometry imports it.
- `exportData.ts` uses `layoutPyramid` lines (no pills drawn there): exported SVG connectors now stop 6px short of couples — cosmetic, invisible at export scale.
