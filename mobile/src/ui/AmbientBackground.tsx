// Persistent "Aurora × Constellation" backdrop. Mounted ONCE behind the router
// (app/_layout.tsx), so it never remounts on navigation — screens are transparent
// and slide/fade over this fixed sky.
//
// The STAR field is a wide horizontal filmstrip (4.5× the viewport). Each of the 4
// top-level views maps to an absolute slot on it, and AmbientMotion pans `viewPos`
// there — so switching views slides to a fresh, never-repeating region and stays
// (no snap-back = no "reload"). Two depth layers (FAR slow / NEAR fast) give real
// parallax; a web motion blur fires while moving. The AURORA stays viewport-centred
// (only the layout-zoom pulse scales it).
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme, AURORA_PRESETS, type AuroraKey } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { useAmbientMotion } from './AmbientMotion';

const STRIP = 6;     // star-field width as a multiple of the viewport (4 views + slack)
const MARGIN = 0.75; // viewports of star-covered slack on EACH side of the pan range —
                     // the first/last views showed the strip's bare edge, especially
                     // zoomed out (persistent star zoom bottoms at 0.9)
const VIEWS = 3;     // max view index (0..3)

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star { x: number; y: number; r: number; gold: boolean }

// A few slow, sparse shooting stars: each is a thin rotated streak with a
// bright head that arcs across part of the sky, fades, then waits out a long
// gap before looping (Animated.loop resets the value each iteration). Screen-
// fixed (not on the filmstrip) — a meteor isn't parallax scenery.
const SHOOTERS = [
  { x0: 0.16, y0: 0.10, angle: 36, len: 0.34, dur: 950, gap: 8200 },
  { x0: 0.60, y0: 0.05, angle: 24, len: 0.42, dur: 1150, gap: 12600 },
  { x0: 0.34, y0: 0.32, angle: 46, len: 0.26, dur: 820, gap: 15400 },
];

function ShootingStar({ cfg, width, height }: { cfg: typeof SHOOTERS[number]; width: number; height: number }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(cfg.gap),
      Animated.timing(p, { toValue: 1, duration: cfg.dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rad = (cfg.angle * Math.PI) / 180;
  const L = cfg.len * width;
  const tx = p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * L] });
  const ty = p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * L] });
  const op = p.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 0.75, 0] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: cfg.x0 * width, top: cfg.y0 * height,
      opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${cfg.angle}deg` }],
    }}>
      <View style={{ width: 72, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.8)' }} />
      <View style={{ position: 'absolute', right: -2, top: -1, width: 4, height: 4, borderRadius: 2, backgroundColor: '#ffffff' }} />
    </Animated.View>
  );
}

export function AmbientBackground() {
  const { c, mode } = useTheme();
  const { stars, glow, motion, aurora } = useSettings();
  const am = useAmbientMotion();
  const { width, height } = useWindowDimensions();

  const glowOpacity = Math.max(0, Math.min(1, glow / 100));
  const showStars = mode === 'dark' && stars > 0;
  const [aur1, aur2] = AURORA_PRESETS[aurora as AuroraKey] ?? AURORA_PRESETS.violet;

  const OWs = width * STRIP;      // star strip width
  const OHs = height * 1.4;       // vertical margin for the zoom pulse
  const AW = width * 1.4;         // aurora width (centred)

  // Two depth layers across the strip. Stars are kept small (dim points of light).
  // The `stars` setting is a PER-VIEWPORT density: the strip is STRIP× wide, so
  // the generated count scales by STRIP to keep every filmstrip region as dense
  // as the slider says.
  const { far, near } = useMemo(() => {
    const rnd = mulberry32(1337);
    const far: Star[] = [];
    const near: Star[] = [];
    const n = Math.min(Math.round(stars * STRIP), 2000);
    for (let i = 0; i < n; i++) {
      const isNear = rnd() < 0.4;
      const s: Star = { x: rnd() * OWs, y: rnd() * OHs, r: isNear ? 0.8 + rnd() * 0.9 : 0.4 + rnd() * 0.5, gold: rnd() < 0.1 };
      (isNear ? near : far).push(s);
    }
    return { far, near };
  }, [stars, OWs, OHs]);

  // Twinkle (two phase-offset opacity loops).
  const twFar = useRef(new Animated.Value(0.6)).current;
  const twNear = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    if (!showStars || !motion) { twFar.setValue(1); twNear.setValue(1); return; }
    const mk = (v: Animated.Value, dur: number) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.4, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
    const a = mk(twFar, 2600);
    const b = mk(twNear, 1900);
    a.start(); b.start();
    return () => { a.stop(); b.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStars, motion]);

  // Web-only motion blur while the parallax is in flight (driven by the blur pulse).
  const blurRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !am) return;
    const id = am.blur.addListener(({ value }) => {
      const el = blurRef.current as unknown as HTMLElement | null;
      if (!el || !el.style) return;
      const px = value * 5;
      el.style.filter = px > 0.15 ? `blur(${px.toFixed(2)}px)` : 'none';
    });
    return () => am.blur.removeListener(id);
  }, [am]);

  // Web: paint the document + mount node dark and full-height (short screens /
  // transparent nav would otherwise show the light RNW body).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    html.style.height = '100%';
    html.style.backgroundColor = c.bg;
    body.style.height = '100%';
    body.style.backgroundColor = c.bg;
    const root = document.getElementById('root');
    if (root) { root.style.minHeight = '100%'; root.style.backgroundColor = c.bg; }
  }, [c.bg]);

  const R = Math.max(AW, OHs) * 0.7;
  const starBox = { position: 'absolute' as const, left: -width * MARGIN, top: -height * 0.2, width: OWs, height: OHs };
  const auroraBox = { position: 'absolute' as const, left: -width * 0.2, top: -height * 0.2, width: AW, height: OHs };

  // Filmstrip pan: near = full travel, far = 0.55× (parallax). `pan` is the sum
  // of the view slot and the tree-layout sub-slot, so layout tabs slide the same
  // strip. Zoom (persistent am.scale) hits near stars hardest, far less, aurora
  // least — depth again.
  const travel = OWs - width - 2 * width * MARGIN; // pan range, margins excluded
  const nearX = am ? am.pan.interpolate({ inputRange: [0, VIEWS], outputRange: [0, -travel], extrapolate: 'clamp' }) : 0;
  const farX = am ? am.pan.interpolate({ inputRange: [0, VIEWS], outputRange: [0, -travel * 0.55], extrapolate: 'clamp' }) : 0;
  const nearTf = am ? { transform: [{ translateX: nearX }, { scale: am.scale }] } : null;
  const farTf = am ? { transform: [{ translateX: farX }, { scale: am.scale.interpolate({ inputRange: [0.9, 1.15], outputRange: [0.96, 1.06] }) }] } : null;
  const auroraTf = am ? { transform: [{ scale: am.scale.interpolate({ inputRange: [0.9, 1.15], outputRange: [0.97, 1.04] }) }] } : null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, overflow: 'hidden' }]}>
      {/* Aurora blobs (viewport-centred; zoom only) */}
      <Animated.View style={[auroraBox, { opacity: glowOpacity }, auroraTf]}>
        <Svg width={AW} height={OHs}>
          <Defs>
            <RadialGradient id="aur1" cx={AW * 0.16} cy={OHs * 0.1} r={R} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={aur1} stopOpacity={0.34} />
              <Stop offset="0.7" stopColor={aur1} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="aur2" cx={AW * 0.84} cy={OHs * 0.9} r={R} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={aur2} stopOpacity={0.26} />
              <Stop offset="0.7" stopColor={aur2} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={AW} height={OHs} fill="url(#aur1)" />
          <Rect x={0} y={0} width={AW} height={OHs} fill="url(#aur2)" />
        </Svg>
      </Animated.View>

      {/* Star filmstrip — two depth layers inside a blur wrapper (web motion blur) */}
      {showStars && (
        <View ref={blurRef} style={StyleSheet.absoluteFill}>
          <Animated.View style={[starBox, { opacity: twFar }, farTf]}>
            <Svg width={OWs} height={OHs}>
              {far.map((s, j) => (
                <Circle key={j} cx={s.x} cy={s.y} r={s.r} fill={s.gold ? c.gold : '#cfc6ff'} fillOpacity={0.65} />
              ))}
            </Svg>
          </Animated.View>
          <Animated.View style={[starBox, { opacity: twNear }, nearTf]}>
            <Svg width={OWs} height={OHs}>
              {near.map((s, j) => (
                <Circle key={j} cx={s.x} cy={s.y} r={s.r} fill={s.gold ? c.gold : '#ffffff'} fillOpacity={0.9} />
              ))}
            </Svg>
          </Animated.View>
        </View>
      )}

      {/* shooting stars — dark mode + motion only */}
      {showStars && motion
        ? SHOOTERS.map((cfg, i) => <ShootingStar key={i} cfg={cfg} width={width} height={height} />)
        : null}
    </View>
  );
}
