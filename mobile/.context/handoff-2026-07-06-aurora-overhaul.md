# Handoff — "Aurora × Constellation" visual overhaul (2026-07-06)

Branch `fable_react`. Full visual re-skin from the Claude Design bundle
`Family Tree Prototype.dc.html` (imported via the design MCP). No features removed —
this was a theme/fonts/background overhaul plus three new interactions.

## What changed & why

### Theme + type system
- `src/theme/theme.ts` — replaced both palettes with the design's deep violet-black
  set (`bg #080611`, `accent #a78bff`→`accent2 #cf6bd0`, gold `#ffce6b`). Added
  `gold/gold2/goldInk` + `cardMInk/cardFInk/cardOInk` tokens; `genderTint` uses them.
  New **accent picker** (violet/teal/gold) via `makePalette(mode, accentKey)` +
  `ACCENT_SWATCHES`; `ThemeCtx` gained `accent`/`setAccent`.
- `src/theme/ThemeProvider.tsx` — persists `accent` (`ft.accent`) alongside mode;
  builds `c` from `makePalette`.
- Fonts swapped to **Spectral (upright serif, NO italics per brief) + Hanken Grotesk**
  + Spline Sans Mono. `fonts.ts` loads them; `font.serifItalic*` now map to upright
  Spectral so old call sites lose italics automatically. Packages added:
  `@expo-google-fonts/spectral`, `@expo-google-fonts/hanken-grotesk`.

### Persistent aurora + constellation background (fixes tab "black/white flash")
- NEW `src/ui/AmbientBackground.tsx` — SVG radial aurora blobs (opacity = `glow`
  setting) + a twinkling star field (count = `stars`, dark-mode only; 3 phase-offset
  Animated layers). Also pins the web document/root bg dark.
- `app/_layout.tsx` — mounts `AmbientBackground` ONCE behind a transparent `Stack`;
  all screen roots made transparent (bulk edit) so the sky persists across navigation.
- **Root-cause fix for the white/grey background on web:** expo-router themes its
  navigation scene container from the system color scheme; the light `DefaultTheme`
  paints an opaque `rgb(242,242,242)` OVER the ambient. Fixed with a transparent nav
  theme: `<ThemeProvider value={navTheme}>` (from `expo-router`) around the Stack,
  `navTheme.colors.background/card = 'transparent'`. This was the key fix — spent a
  while chasing it via DOM before finding the source.

### Background parallax on tab changes (new)
- NEW `src/ui/AmbientMotion.tsx` — `AmbientMotionProvider` + `useAmbientMotion()`
  exposing `panX`/`scale` Animated values + `nudgeView(dir)` (horizontal star pan) and
  `nudgeLayout(dir)` (star zoom). Provider wraps NavShell in `_layout`.
- Wired: `app/tree.tsx` + `DesktopWorkspace` view switch → `nudgeView`;
  `TreeView` layout switch (Pyramid/Ancestors/Hourglass) → `nudgeLayout`.
- `AmbientBackground` applies full parallax to stars, gentler to aurora (depth).

### Generations slider (new) — `src/viz/TreeView.tsx`
- Pyramid only: a "Generations" slider limits visible generations counted from the
  OLDEST (top row = gen 0). Layout is computed full-height; nodes/lines/couple-pills
  are filtered by `genOf(y) < genCap`. Raising the limit REMOUNTS the next generation
  so its `NodePop` entrance replays → generations "gracefully appear".

### Reveal-speed slider (new)
- `SettingsContext` gained `revealSpeed` (0.5–2.5×, default 1). `NodePop`
  (`ui/primitives.tsx`) scales its duration/delay by it. Slider lives in the Settings
  → Ambience section next to Stars/Glow/Accent.

### Other
- Tighter siblings: `treeLayout.ts` `SIB_GAP 28→12`, card dims `NODE_W 126 / NODE_H 60 /
  COUPLE_GAP 14`. Marriage couple pill now gold.
- Button placement (user-confirmed): mobile bottom nav already `Home·Scan·Tree⊕·AI·Me`
  (kept); desktop view order → **Tree-first**; toolbar icons → Members·Calendar·Export·
  Scan·Settings; Ask AI + Add kept.
- Viz node cards (`TreeView`/`RadialView`) now use `font.*` families + gender-tinted
  initials instead of `fontWeight` synthesis.
- Ambience settings: `stars`/`glow` added to `SettingsContext`; `SettingsPanel` gained
  the Ambience card (sliders via a measured `FullSlider`).

## Verify
`npx tsc --noEmit` clean. `npx expo start --web --port 8082`, log in
(`jatin75b@gmail.com` / `password`). Confirmed via Playwright: 0 console errors;
persistent stars/aurora on every screen (no flash); tree-first desktop; tighter
siblings; generations slider filters (2/5 → oldest 2 gens) and reveals with animation.
NOTE: the fix hinged on the expo-router nav theme — if the bg ever goes light again,
check `navTheme` in `app/_layout.tsx` first.
