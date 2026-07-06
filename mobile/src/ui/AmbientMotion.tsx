// Parallax bridge between the viz screens and the persistent AmbientBackground.
// The star field is a wide horizontal "filmstrip" (see AmbientBackground); each of
// the 4 top-level views maps to an ABSOLUTE slot on it. Switching views animates
// `viewPos` to that slot, so the sky slides to a fresh region and STAYS there —
// it never snaps back (that snap-back is what read as a reload). Switching the
// tree layout (Pyramid↔Ancestors↔Hourglass) pans the same way via `layoutPos`, a
// sub-slot offset added to `viewPos` — again absolute, so the sky only ever
// MOVES, it never "reloads". Canvas zooming (buttons / pinch / wheel) nudges a
// persistent `scale` a little in the zoom direction; fit eases it back to rest.
// A `blur` pulse drives a transient motion blur on the stars (web).
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';
import { useSettings } from '../theme/SettingsContext';

interface AmbientMotion {
  pan: Animated.AnimatedAddition<number>; // viewPos + layoutPos, in view-slot units
  scale: Animated.Value;    // persistent star zoom level (0.9–1.15, rest = 1)
  blur: Animated.Value;     // 0→1→0 motion-blur pulse (JS-driven for smooth listeners)
  setViewIndex: (i: number) => void;   // absolute top-level view slot (0..3)
  setLayoutPos: (frac: number) => void; // absolute sub-slot offset (tree layout tabs)
  nudgeZoom: (dir: number, mag?: number) => void; // small persistent zoom step
  resetZoom: () => void;    // ease the zoom level back to 1 (fit)
}

const Ctx = createContext<AmbientMotion | null>(null);
export const useAmbientMotion = () => useContext(Ctx);

const EASE = Easing.out(Easing.cubic);
const ZOOM_STEP = 0.04, ZOOM_MIN = 0.9, ZOOM_MAX = 1.15;

export function AmbientMotionProvider({ children }: { children: ReactNode }) {
  const { motion } = useSettings();
  const viewPos = useRef(new Animated.Value(0)).current;
  const layoutPos = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const blur = useRef(new Animated.Value(0)).current;
  const pan = useRef(Animated.add(viewPos, layoutPos)).current;
  const lastIndex = useRef(0);
  const lastLayout = useRef(0);
  // Animated.Value has no public sync getter — track the zoom target ourselves.
  const zoomTarget = useRef(1);

  const pulseBlur = () => {
    blur.stopAnimation();
    blur.setValue(1);
    Animated.timing(blur, { toValue: 0, duration: 720, easing: EASE, useNativeDriver: false }).start();
  };

  const setViewIndex = (i: number) => {
    if (i === lastIndex.current) return;
    lastIndex.current = i;
    if (!motion) { viewPos.setValue(i); return; }
    viewPos.stopAnimation();
    Animated.timing(viewPos, { toValue: i, duration: 720, easing: EASE, useNativeDriver: true }).start();
    pulseBlur();
  };
  const setLayoutPos = (frac: number) => {
    if (frac === lastLayout.current) return;
    lastLayout.current = frac;
    if (!motion) { layoutPos.setValue(frac); return; }
    layoutPos.stopAnimation();
    Animated.timing(layoutPos, { toValue: frac, duration: 720, easing: EASE, useNativeDriver: true }).start();
    pulseBlur();
  };
  const nudgeZoom = (dir: number, mag: number = 1) => {
    if (!motion || dir === 0) return;
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomTarget.current + Math.sign(dir) * ZOOM_STEP * mag));
    if (next === zoomTarget.current) return;
    zoomTarget.current = next;
    scale.stopAnimation();
    Animated.timing(scale, { toValue: next, duration: 600, easing: EASE, useNativeDriver: true }).start();
  };
  const resetZoom = () => {
    if (zoomTarget.current === 1) return;
    zoomTarget.current = 1;
    if (!motion) { scale.setValue(1); return; }
    scale.stopAnimation();
    Animated.timing(scale, { toValue: 1, duration: 600, easing: EASE, useNativeDriver: true }).start();
  };

  return <Ctx.Provider value={{ pan, scale, blur, setViewIndex, setLayoutPos, nudgeZoom, resetZoom }}>{children}</Ctx.Provider>;
}
