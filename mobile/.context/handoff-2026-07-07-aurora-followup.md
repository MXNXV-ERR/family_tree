# Handoff — Aurora follow-up: viz animations, ambient motion, master delete (2026-07-07)

Branch `fable_react` (uncommitted, on top of the 2026-07-06 aurora overhaul).
Plan: `~/.claude/plans/continue-center-views-cuddly-otter.md`.

## What changed

1. **Sibling gap on small trees** — `shared/treeLayout.ts`: `layoutPyramid` /
   `layoutLayered` take `sibGap = SIB_GAP(12)`; TreeView passes `maxGen <= 2 ? 28 : 12`
   to all three pyramid call sites (res + genLimit subset + `full` stage). Big trees
   byte-identical (default 12). Unit-verified via esbuild bundle: spacing 12/28 exact.

2. **Tree layout tabs PAN the sky (no zoom pulse)** — user said the old
   `nudgeLayout` scale pulse "read as a reload". `AmbientMotion` now has
   `layoutPos` + `setLayoutPos(frac)` (absolute sub-slot, mirrors `setViewIndex`),
   exposes `pan = Animated.add(viewPos, layoutPos)`; `AmbientBackground`
   interpolates `pan`. TreeView effect: `setLayoutPos(layoutIndex * 0.25)`.
   `nudgeLayout` is GONE. Verified: Hourglass → near/far tx −840/−462, persists.

3. **Persistent subtle star zoom on ALL zoom inputs** — `AmbientMotion.scale` is
   now a persistent level (`nudgeZoom(dir, mag)` steps ±0.04·mag, clamp 0.9–1.15,
   no blur; `resetZoom()` → 1). Wired INSIDE `ZoomPanCanvas` (zoomBy / pinch-end /
   wheel@0.4 mag; `reset()` → resetZoom) so every canvas view gets it free;
   TimelineView wires its px/yr `zoom()` + fit. Verified: 2 clicks → near 1.08 /
   far 1.032 (parallax), fit → 1.

4. **Star density ×4.5** — `stars` setting is now per-viewport density:
   `n = min(round(stars * STRIP), 1500)` (default 140 → 630 on the strip). Verified 630.

5. **Radial entrance like tree** — extracted `DrawLines` → `src/viz/DrawLines.tsx`
   extended with per-line `color`/`opacity`/`dashed` (dashed = real 5,4 dash, FADES in
   via shared progress inside a static-opacity `<G>`; can't share strokeDasharray with
   the draw trick). Radial spokes are now draw-in paths (`drawKey = focusId-depth`,
   guard ≤60 nodes) and cards stagger ring-by-ring (`MorphNode i` on depth-sorted order).

6. **Network center-on-load + entrance** — computes real `fit` from stage size,
   glides to the focus node like TreeView; edges render through `DrawLines`
   (per-line color + highlight opacity, `drawKey = net-<count>`).

7. **Timeline entrance** — every person row + events lane wrapped in `Rise i={idx}`.

8. **Master delete surfaced** — `app/master.tsx` toolbar (desktop + mobile) got a
   trash `ToolBtn` → confirm → `deleteMaster` → `/home`. `app/combine.tsx` doDelete
   now confirms on native too (`Alert.alert`; previously deleted instantly). Deletes
   only `masters/{id}` + `users/{uid}/masters/{id}` — family trees untouched.

## Gotcha fixed (pre-existing)

RN-Animated (`Animated.createAnimatedComponent`) on **react-native-svg** elements
leaks `collapsable: false` to the DOM on web (RNW `useAnimatedProps` injects it;
svg components don't strip it) → React non-boolean-attribute console error + red
toast. Radial's `Ring` (ACircle) triggered it. Fix: `CircleSansCollapsable` wrapper
strips the prop before `Circle`. Reanimated (used by DrawLines) does NOT have this
problem on web. If you animate another svg element with RN-Animated, wrap it the same way.

Also: `.expo/types/router.d.ts` was corrupted (duplicate tail from an interrupted
typegen) → tsc parse errors. Truncated to the valid declaration; regenerates on
`expo start`.

## Round 2 (same day) — radial anchor, bigger sky, shooting stars, glow colour

User feedback: radial depth change moved EVERY node (canvas reset + the `+C`
stage-centre offset changing with stage size), lines redrew instantly, strip
edges visible at first/last views, wanted shooting stars + a background-light
colour setting.

- **Radial is now centre-anchored**: spokes/cards use CENTRE-RELATIVE coords
  (no `+C`) riding a `<G x={C} y={C}>` / zero-size View anchored at the stage
  centre, and depth changes no longer touch the canvas (`reset` only on focus
  change). The focus card stays pixel-fixed through depth up/down at any
  zoom/pan (verified 701,494 → 701,494); only surrounding rings appear/move.
  `radialLayout` maths is depth-stable for existing rings, so nothing "spins".
- **Line choreography**: on depth/focus change the OLD spokes fade out
  (`FadeOutLines`, 420ms) while nodes glide, then the NEW spokes draw in after
  a 620ms `delay` (new DrawLines prop). First mount still draws immediately.
- **Starfield**: `STRIP` 4.5→6 with `MARGIN` 0.75 viewports of star-covered
  slack each side (travel excludes margins) — edges no longer visible at view
  0/3 even at the 0.9 zoom floor. Density auto-scales (140 → 840 stars, cap 2000).
- **Shooting stars**: 3 sparse looping streaks (`SHOOTERS` in
  AmbientBackground; RN Animated, screen-fixed, dark+motion only, 8–15s gaps).
- **Glow colour setting**: `AURORA_PRESETS` (violet/teal/gold/rose/sky) in
  `theme.ts`, `aurora` key in SettingsContext (default violet), swatch row in
  Settings → Ambience; AmbientBackground tints both blobs from it.

Verified via `scripts/shot-aurora3.mjs`: stars 840 OK · shooters mounted 3 OK ·
focus anchor exact through depth 1→4→1 while zoomed OK · spokes 6→34 OK ·
gold stops applied then restored OK · console errors none.

## Verify

`npx tsc --noEmit` clean. `npx expo start --web --port 8082` + new scripts:
- `scripts/shot-aurora2.mjs` — density 630 OK · layout-tab pan OK (persists, scale 1)
  · zoom nudge 1→1.08/1.032 OK · fit reset OK · radial draw-paths OK · shots in
  `scripts/shots/a2-*.png` · console errors none.
- `scripts/shot-master-delete.mjs` — trash on master screen OK, confirm copy OK,
  dismiss keeps master (never accepts — real data).
- `scripts/probe-collapsable.mjs` — per-view console sweep, all clean.
- Sibling gap: no ≤2-gen family in the account (Mehta 5 gens, Rao 4) — verified by
  bundling `treeLayout.ts` with esbuild and asserting spacing 12/28.
