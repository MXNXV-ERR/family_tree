# Round 3: true line draw-on + glow · radial endpoints · order UX · phase moon + sky planes (2026-07-09, fable_react)

## What changed & why

### Viz lines (`src/viz/DrawLines.tsx` — rewritten)
1. **Per-line dash = real draw-on.** Root cause of "line just appears": every path shared a diagram-sized `strokeDasharray` (stageW+stageH ≈ 3-6k), so a 200px connector finished its dashoffset reveal in the first ~5% of the 900ms tween. Now each line is its own `DrawPath` child with `strokeDasharray = pathLength(d)` (new exported `pathLength()` — M/L exact, C/Q flattened), 800ms `bezier(0.33,1,0.68,1)` — lines visibly draw tip-to-tail. `dash` prop deleted from DrawLines; all call sites (Tree/Radial/Network) updated.
2. **Per-offspring stagger.** New `stagger` prop: line *i* in a group waits `min(i*stagger, 480)`. Tree rows pass 70ms, radial rings 45ms (÷revealSpeed) — each child's connector joins a beat after its sibling's.
3. **Glow everywhere.** Every solid line paints twice: wide faint underlay (`strokeWidth*3.4`, `opacity*0.35`) + crisp stroke, both riding the same draw progress. Dashed (ex) lines + `FadeOutLines` glow via nested static-opacity `<G>` (collapsable-leak-safe). Node glow: tree cards shadow in border colour (was #000), radial cards shadow in relationship colour (was focus-only), network avatars glow, timeline bars/dots get an SVG underlay copy.
4. **Cap raised**: `animate` now `lines ≤ 300` (was nodes ≤ 60) in all three views; big-tree fallback (instant + lineFade dip) retained. Row/ring cascade delays capped (`min(row*110,660)`, `min(d*90,450)`).

### Radial (`src/viz/RadialView.tsx`)
5. **Spokes meet cards, not the ring.** Endpoints were node centres (= exactly ring radius, card drawn on top). Both ends now inset along the spoke by an ellipse approximation of the card rect (halfW 84/75/58 + 4, halfH 38); skipped when cards nearly touch (dist < rFrom+rTo+12).

### Selection regressions
6. **Tree FocusBar fix**: `ZoomPanCanvas` tap fires `onTapEmpty` on card taps too; TreeView lacked the `lastCardPress` 350ms guard Radial/Network had → selection cleared instantly, "Profile →" bar never showed. Guard added (`TreeView.tsx`).
7. **Radial default selection**: already works — SlideSwap unmounts inactive views, remount re-seeds `selId` from focusId (`RadialView.tsx:71`). Verified by roundtrip test, no change.

### Order UX
8. **`src/components/AgeOrderList.tsx` (new)**: `useAgeOrder()` hook (snapshot/move/dirty/buildChanges/reset/markSaved) + `AgeOrderGroups` pure list — extracted from SiblingOrderSheet.
9. **SiblingOrderSheet**: thin shell; **Save is a pinned footer below PanelScroll** (was last scroll child — desktop drawer clipped it). `PanelScroll` (panelChrome) got `minHeight:0` on wrapper + ScrollView (RNW min-height:auto flex footgun: nested flex:1 ScrollView expanded to content height, GlassSurface overflow:hidden clipped the tail). contentStyle uses explicit paddings (shorthand `padding:16` was clobbering the default `paddingBottom:28`).
10. **MasterEditGrid**: new **Details | Age order** SegTabs; order tab embeds `AgeOrderGroups` (maxWidth 640, own ScrollView). One "Save all" merges staged cell edits + birthOrder diffs by member id into a single `bulkUpdateMembers` batch; Discard resets both. New `relationships` prop — hosts updated (`app/masteredit.tsx` destructures relationships; DesktopWorkspace passes it).

### Ambient sky (`src/ui/AmbientBackground.tsx`)
11. **Moon**: real lunar phase (synodic days from 2000-01-06 epoch; `moonPhasePath` = bright-limb arc + elliptical terminator, flags encode crescent/gibbous + waxing/waning), earthshine disc, 4 maria clipped to the lit shape (`ClipPath`), bigger (S=100, R=19) and lower (`top 0.22`) so desktop toolbar buttons don't overlap. Static — pulse removed.
12. **Nebula**: 2-arm spiral galaxy + core, slow 90s rotation (Animated rotate on wrapper View, spin direction random per respawn).
13. **Constellations**: 5 real figures (Orion, Big Dipper, Cassiopeia, Cygnus, Scorpius) as normalized pts + branching segs; each cycle picks one at a random spot, dots fade in, lines join sequentially (per-seg Views — no animated SVG props). Second instance at stars≥180.
14. **Light scenery**: `Scenery` — two seeded ridge paths + ~w/46 pine/deciduous silhouettes, bottom band (≤150px), warm ink. Shows even with motion off.
15. **New parallax planes**: `midTf` (0.16×travel) carries scenery + clouds/planes/balloons/birds/motes in a widened `midW` coordinate space; `bodyTf` (0.05) carries sun/moon — near-static drift between views. Sun breathe removed (static).
16. **Counts**: meteors 4-6 → **2-3**, clouds 3-5 → **7-12** (CLOUDS grew to 12 configs), balloons 1-2 → **3-5** (slightly bigger/brighter).

## Verify
`npx tsc --noEmit` clean. `scripts/shot-sky.mjs` (counts updated) + new `scripts/shot-round3.mjs` (needs `npx expo start --web --port 8082`): all OK, 0 console errors — dark/light inventories (moon path + maria, nebula arms, constellation segs, ridges/trees, balloons), FocusBar on tree tap + persistence, radial FocusBar on entry + after roundtrip, order-sheet Save inside viewport (bottom=868/900), master-edit Age-order tab. Screenshots `r3-*.png` eyeballed: radial spokes stop at card edges, glow reads well in dark, scenery correct in light.

## Round 3b (same day): the ONE bug behind three flaws + sky planes

User flaws (`flaws/*.png`, localhost:8081, 70-person family): profile FocusBar invisible after selecting, radial legend clipped at bottom, "no background in light mode". **Single root cause: `ZoomPanCanvas`'s stage child is laid out UNSCALED (RN transforms are visual only), and on web the `flex:1` canvas grew to stage size (min-height:auto), stretching the page past the viewport — every bottom-anchored element (FocusBar, CollapsibleLegend, light-mode scenery band at the bottom of the ambient absoluteFill) fell below the fold.** Small families (35-person Mehta test data) didn't overflow, which is why Playwright missed it. Fix: `minHeight:0, minWidth:0` on `ZoomPanCanvas` canvas style. Regression guard in `shot-round3.mjs`: root/body scrollHeight must equal innerHeight at max radial depth.

Also this round (all in `AmbientBackground.tsx`):
- **Woven constellations**: 5 real figures seeded INTO the near star strip (pan with stars, permanent faint joins + brighter dots) — `woven` in the star memo; CONSTELLATIONS grew to 11 figures (added Lyra, Leo, Gemini, Aquila, Pegasus, Ursa Minor). Spotlight cycler kept (2 instances by density).
- **Plane ladder** (slow→fast): BODY 0.05 (sun/moon) · MID 0.16 (clouds/balloons/birds/plane/motes) · SKY 0.22 (meteors/satellites/nebula/spotlight constellations) · SCENERY 0.45 (ground — closest, pans hardest). Each mover plane gets widened coordinate space (`planeBox(w)`).
- **Scenery bolder**: 3 ridges (0.08/0.13/0.18 fills), band up to 210px, trees every ~34px at 0.26-0.3 opacity. Sun moved down (top 0.26) — was hidden behind the desktop toolbar. Clouds: ink 0.07→0.1, `countOf(10,16)`, 16 configs.

## Gotchas
- `DrawLines` no longer takes `dash` — pass nothing; per-line length computed internally. Reuse `pathLength()` if you need it.
- Any new glow on SVG: duplicate-stroke underlay, NEVER SVG filters (native) and never animate a `<G>` (web collapsable leak).
- `useAgeOrder` snapshot ignores live updates while open by design; `markSaved()` re-stamps so a still-open editor diffs cleanly.
- Constellation segments are rotated 1px Views (translateX∘rotate∘translateX to pivot at the A-end) — native-driver friendly.
