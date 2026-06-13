---
name: mobile-ui-gotchas
description: Two recurring mobile UI gotchas — Android edge-to-edge safe area, and glass-over-content legibility
metadata:
  type: feedback
---

User builds the Expo app to match `figma files/family-tree-reimagined/` pixel + motion fidelity. Two structural traps that bit us:

1. **Android edge-to-edge** — RN 0.85 draws content under the notch/camera by default. The app had NO safe-area handling. Fix lives in `app/_layout.tsx`: `SafeAreaProvider` + a themed `SafeAreaView` (`edges=['top','bottom','left','right']`) wrapping the `Stack`. With that as the single source of truth, per-screen top paddings should be SMALL (home header `12`, MemberForm `14`) — large hardcoded values (was 54/52) double-gap.

2. **Glass-on legibility** — when the "Glass surfaces" setting is ON, `GlassSurface` is translucent (`glassBg` ~0.55). Over the busy home content, overlay panels (BottomSheet, web chat sheet) become unreadable. Fix: render an OPAQUE themed base (`mode==='dark' ? '#13131d' : '#fbf8f1'`) BEHIND the GlassSurface in the sheet, so text reads against a solid surface while the blur rim stays.

**Why:** both are invisible on the Playwright web build (insets = 0 on web; glass reads fine over the dark phone-frame bg in the design). Only show on real Android / with glass toggled on.

**How to apply:** verify these on-device or with glass ON, not just the default web screenshot. Animate react-native-svg via reanimated `useAnimatedProps` (not RN `Animated` on SVG props — that throws a DOM-attribute warning on web). See [[family-tree-design-bundle]].
