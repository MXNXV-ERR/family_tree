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
//
// SKY OBJECTS: the `stars` setting is a density dial for BOTH modes — dark gets
// stars (circles + 4/5-point shapes), meteors, a comet, satellites, one moon,
// Saturn and a wandering nebula; light gets one sun with rays, drifting clouds,
// planes, balloons and bird flocks. Rare movers use the RESPAWN pattern (see
// useSpawn): each pass re-randomizes position/speed and waits a random gap, so
// the sky never repeats. All animation is useNativeDriver; the JS thread only
// wakes to re-randomize a leaf component between passes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
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
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Star { x: number; y: number; r: number; gold: boolean }
interface ShapedStar { x: number; y: number; r: number; five: boolean; gold: boolean }

// --- line-art path helpers (inspiration/night_sky_elements.jpg) ---------------
// 4-point sparkle: concave diamond.
function sparklePath(cx: number, cy: number, r: number): string {
  const p = r * 0.22;
  return `M ${cx} ${cy - r} Q ${cx + p} ${cy - p} ${cx + r} ${cy} Q ${cx + p} ${cy + p} ${cx} ${cy + r} Q ${cx - p} ${cy + p} ${cx - r} ${cy} Q ${cx - p} ${cy - p} ${cx} ${cy - r} Z`;
}
// 5-point star polygon.
function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}
// Spiral swirl (nebula), ~2.5 turns growing to rMax.
function spiralPath(cx: number, cy: number, rMax: number): string {
  const steps = 44;
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * Math.PI * 5;
    const r = t * rMax;
    parts.push(`${i === 0 ? 'M' : 'L'} ${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r * 0.8).toFixed(1)}`);
  }
  return parts.join(' ');
}

// --- lunar phase ---------------------------------------------------------------
// 0 = new, 0.5 = full; days since a known new moon (2000-01-06 18:14 UTC) mod
// the synodic month. Good to within a few hours — plenty for a 15px moon.
const SYNODIC_DAYS = 29.530588853;
function lunarPhase(d: Date): number {
  const days = (d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  return ((days / SYNODIC_DAYS) % 1 + 1) % 1;
}
// Lit-region path: bright-limb semicircle out, elliptical terminator back. The
// terminator's x-radius collapses through 0 (quarter) and flips side, which is
// exactly what the two arc flags below encode.
function moonPhasePath(cx: number, cy: number, R: number, phase: number): string {
  const ct = Math.cos(2 * Math.PI * phase);
  const rt = Math.abs(R * ct).toFixed(2);
  const waxing = phase <= 0.5;
  const limbSweep = waxing ? 1 : 0;                 // lit limb: right when waxing, left when waning
  const termSweep = (ct > 0) === waxing ? 0 : 1;    // crescent hugs the limb, gibbous bulges past centre
  return `M ${cx} ${cy - R} A ${R} ${R} 0 0 ${limbSweep} ${cx} ${cy + R} A ${rt} ${R} 0 0 ${termSweep} ${cx} ${cy - R} Z`;
}
const circlePathD = (cx: number, cy: number, r: number) =>
  `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;

// --- respawn engine ------------------------------------------------------------
// Runs one pass (0→1 over cfg.dur), then re-randomizes the config and waits a
// random gap before the next pass — rare objects keep SPAWNING at fresh spots
// instead of looping a fixed track. State lives here in the leaf, so a respawn
// re-renders only the object itself, never the starfield.
function useSpawn<TCfg extends { dur: number }>(
  randomize: () => TCfg, gapMin: number, gapMax: number,
  easing: (v: number) => number = Easing.linear,
) {
  const p = useRef(new Animated.Value(0)).current;
  const [cfg, setCfg] = useState<TCfg>(randomize);
  const first = useRef(true);
  useEffect(() => {
    let alive = true;
    // first pass starts sooner so a fresh mount isn't an empty sky
    const delay = first.current ? Math.random() * gapMin : rand(gapMin, gapMax);
    first.current = false;
    p.setValue(0);
    const timer = setTimeout(() => {
      if (!alive) return;
      Animated.timing(p, { toValue: 1, duration: cfg.dur, easing, useNativeDriver: true })
        .start(({ finished }) => { if (finished && alive) setCfg(randomize()); });
    }, delay);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);
  return { p, cfg };
}

// --- dark-mode movers ------------------------------------------------------------

// Meteor streak with a bright head; respawns at a random spot/angle each pass.
function Meteor({ width, height, big }: { width: number; height: number; big?: boolean }) {
  const { p, cfg } = useSpawn(
    () => big
      ? { x0: rand(0.02, 0.3), y0: rand(0.05, 0.3), angle: rand(18, 34), len: rand(0.6, 0.95), dur: rand(2000, 2800), w: 140, h: 3 }
      : { x0: rand(0.02, 0.75), y0: rand(0.03, 0.45), angle: rand(15, 55), len: rand(0.2, 0.45), dur: rand(750, 1250), w: 72, h: 2 },
    big ? 35000 : 2000, big ? 90000 : 10000, Easing.out(Easing.quad),
  );
  const radA = (cfg.angle * Math.PI) / 180;
  const L = cfg.len * width;
  const tx = p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(radA) * L] });
  const ty = p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(radA) * L] });
  const op = p.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 0.75, 0] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: cfg.x0 * width, top: cfg.y0 * height,
      opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${cfg.angle}deg` }],
    }}>
      <View style={{ width: cfg.w, height: cfg.h, borderRadius: cfg.h / 2, backgroundColor: 'rgba(255,255,255,0.8)' }} />
      <View style={{ position: 'absolute', right: -2, top: -1, width: cfg.h + 2, height: cfg.h + 2, borderRadius: (cfg.h + 2) / 2, backgroundColor: '#ffffff' }} />
    </Animated.View>
  );
}

// Tiny blinking satellite crossing the whole sky; respawns on a new track.
function Satellite({ width, height }: { width: number; height: number }) {
  const { p, cfg } = useSpawn(
    () => ({ y0: rand(0.08, 0.55), yDrift: rand(-0.06, 0.06), dir: Math.random() < 0.5 ? 1 : -1, dur: rand(26000, 44000) }),
    8000, 40000,
  );
  const blink = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const tw = Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(blink, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    tw.start();
    return () => tw.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pad = 30;
  const tx = p.interpolate({ inputRange: [0, 1], outputRange: cfg.dir > 0 ? [-pad, width + pad] : [width + pad, -pad] });
  const ty = p.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.yDrift * height] });
  const vis = p.interpolate({ inputRange: [0, 0.01, 0.99, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: cfg.y0 * height, opacity: vis, transform: [{ translateX: tx }, { translateY: ty }] }}>
      <Animated.View style={{ width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: 'rgba(255,255,255,0.9)', opacity: blink }} />
    </Animated.View>
  );
}

// Wandering spiral galaxy: two arms + a bright core, slowly SPINNING while it
// fades in, lingers, fades out, then respawns somewhere else.
function Nebula({ width, height }: { width: number; height: number }) {
  const { p, cfg } = useSpawn(
    () => ({ x0: rand(0.1, 0.8), y0: rand(0.1, 0.6), r: rand(28, 48), dur: rand(24000, 34000), spin: Math.random() < 0.5 ? 1 : -1 }),
    8000, 30000, Easing.inOut(Easing.sin),
  );
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(rot, { toValue: 1, duration: 90000, easing: Easing.linear, useNativeDriver: true }));
    l.start();
    return () => l.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const spinDeg = rot.interpolate({ inputRange: [0, 1], outputRange: cfg.spin > 0 ? ['0deg', '360deg'] : ['360deg', '0deg'] });
  const op = p.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.18, 0.18, 0] });
  const S = cfg.r * 2 + 24;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: cfg.x0 * width - S / 2, top: cfg.y0 * height - S / 2, opacity: op }}>
      <Animated.View style={{ width: S, height: S, transform: [{ rotate: spinDeg }] }}>
        <Svg width={S} height={S}>
          <Defs>
            <RadialGradient id="nebGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#b9a7ff" stopOpacity={0.5} />
              <Stop offset="1" stopColor="#b9a7ff" stopOpacity={0} />
          </RadialGradient>
          </Defs>
          <Circle cx={S / 2} cy={S / 2} r={cfg.r + 10} fill="url(#nebGlow)" />
          <Circle cx={S / 2} cy={S / 2} r={3} fill="#e6dfff" opacity={0.7} />
          <Path d={spiralPath(S / 2, S / 2, cfg.r)} stroke="#cfc6ff" strokeWidth={0.9} fill="none" opacity={0.7} />
          {/* second arm — same spiral rotated half a turn */}
          <G transform={`rotate(180 ${S / 2} ${S / 2})`}>
            <Path d={spiralPath(S / 2, S / 2, cfg.r)} stroke="#cfc6ff" strokeWidth={0.8} fill="none" opacity={0.45} />
          </G>
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

// Exactly one moon — TODAY'S real lunar phase (two-arc terminator path), a
// faint earthshine disc behind it, and maria clipped to the lit shape. Static
// (no pulse); the skyBody parallax plane nudges it slightly between views.
function Moon({ width, height }: { width: number; height: number }) {
  const phase = useMemo(() => lunarPhase(new Date()), []);
  // sits below the desktop toolbar row (top ~0.10 put it under the buttons)
  const S = 100;
  const cx = S / 2, cy = S / 2, R = 19;
  const nearNew = phase < 0.02 || phase > 0.98;
  const nearFull = Math.abs(phase - 0.5) < 0.02;
  const litD = nearNew ? null : nearFull ? circlePathD(cx, cy, R) : moonPhasePath(cx, cy, R, phase);
  const mr = R / 14; // maria layout was tuned at R=14
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: width * 0.84 - S / 2, top: height * 0.22 - S / 2 }}>
      <Svg width={S} height={S}>
        <Defs>
          <RadialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#efe9ff" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#efe9ff" stopOpacity={0} />
          </RadialGradient>
          {litD ? <ClipPath id="moonLit"><Path d={litD} /></ClipPath> : null}
        </Defs>
        <Circle cx={cx} cy={cy} r={S / 2} fill="url(#moonGlow)" />
        {/* earthshine: the whole disc barely-there behind the lit part */}
        <Circle cx={cx} cy={cy} r={R} fill="#e9e4f6" opacity={nearNew ? 0.12 : 0.09} />
        {litD ? <Path d={litD} fill="#e9e4f6" opacity={0.88} /> : null}
        {/* maria — visible only where the moon is lit */}
        {litD ? (
          <G clipPath="url(#moonLit)" opacity={0.2}>
            <Circle cx={cx - 4.5 * mr} cy={cy - 3 * mr} r={3.4 * mr} fill="#9d94c0" />
            <Circle cx={cx + 3.5 * mr} cy={cy + 1.5 * mr} r={2.6 * mr} fill="#9d94c0" />
            <Circle cx={cx - 1 * mr} cy={cy + 6.5 * mr} r={1.8 * mr} fill="#9d94c0" />
            <Circle cx={cx + 6.5 * mr} cy={cy - 5.5 * mr} r={1.4 * mr} fill="#9d94c0" />
          </G>
        ) : null}
      </Svg>
    </View>
  );
}

// --- shared / light-mode movers ---------------------------------------------------

// Barely-there mote drifting slowly upward with a light sideways sway; loops
// forever. Doubles as the light-mode "daysky" motion in warm ink.
const MOTES = [
  { x0: 0.12, y0: 0.78, size: 3, rise: 70, sway: 10, dur: 19000, phase: 0 },
  { x0: 0.34, y0: 0.55, size: 4, rise: 55, sway: -12, dur: 23000, phase: 5000 },
  { x0: 0.58, y0: 0.86, size: 3, rise: 80, sway: 8, dur: 17000, phase: 9000 },
  { x0: 0.81, y0: 0.62, size: 5, rise: 60, sway: -9, dur: 26000, phase: 13000 },
  { x0: 0.22, y0: 0.34, size: 3, rise: 50, sway: 11, dur: 21000, phase: 3000 },
  { x0: 0.70, y0: 0.28, size: 4, rise: 58, sway: -10, dur: 24000, phase: 11000 },
  { x0: 0.47, y0: 0.70, size: 6, rise: 66, sway: 9, dur: 28000, phase: 7000 },
];
function DriftMote({ cfg, width, height, color, peak = 0.14 }: {
  cfg: typeof MOTES[number]; width: number; height: number; color: string; peak?: number;
}) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.sequence([
      Animated.delay(cfg.phase),
      Animated.loop(Animated.timing(p, { toValue: 1, duration: cfg.dur, easing: Easing.linear, useNativeDriver: true })),
    ]);
    run.start();
    return () => run.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ty = p.interpolate({ inputRange: [0, 1], outputRange: [0, -cfg.rise] });
  const tx = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, cfg.sway, -cfg.sway * 0.4] });
  const op = p.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, peak, peak, 0] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: cfg.x0 * width, top: cfg.y0 * height, opacity: op,
      width: cfg.size, height: cfg.size, borderRadius: cfg.size / 2, backgroundColor: color,
      transform: [{ translateX: tx }, { translateY: ty }],
    }} />
  );
}

// Real constellation stick figures (points normalized to a unit box, segments
// index into pts — real figures branch, they aren't a single polyline).
const CONSTELLATIONS: { pts: [number, number][]; segs: [number, number][] }[] = [
  { // Orion — shoulders, slanted belt, feet
    pts: [[0.30, 0.05], [0.72, 0.10], [0.42, 0.45], [0.50, 0.50], [0.58, 0.55], [0.28, 0.92], [0.76, 0.88]],
    segs: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
  },
  { // Big Dipper (Ursa Major) — bowl + bent handle
    pts: [[0.95, 0.30], [0.88, 0.55], [0.64, 0.58], [0.66, 0.32], [0.46, 0.36], [0.28, 0.28], [0.05, 0.15]],
    segs: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  { // Cassiopeia — the W
    pts: [[0.05, 0.55], [0.27, 0.20], [0.50, 0.48], [0.73, 0.15], [0.95, 0.38]],
    segs: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  { // Cygnus — the Northern Cross
    pts: [[0.50, 0.05], [0.50, 0.45], [0.50, 0.95], [0.08, 0.62], [0.92, 0.28]],
    segs: [[0, 1], [1, 2], [1, 3], [1, 4]],
  },
  { // Scorpius — head pair + curling tail hook
    pts: [[0.10, 0.10], [0.04, 0.28], [0.16, 0.22], [0.30, 0.35], [0.42, 0.52], [0.48, 0.72], [0.60, 0.86], [0.78, 0.88], [0.88, 0.74]],
    segs: [[0, 2], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]],
  },
  { // Lyra — Vega + the little parallelogram
    pts: [[0.50, 0.05], [0.35, 0.30], [0.65, 0.35], [0.30, 0.75], [0.60, 0.80]],
    segs: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]],
  },
  { // Leo — the sickle + hindquarter triangle
    pts: [[0.15, 0.25], [0.25, 0.10], [0.40, 0.08], [0.50, 0.20], [0.45, 0.40], [0.30, 0.45], [0.75, 0.35], [0.95, 0.50], [0.70, 0.60]],
    segs: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6], [6, 7], [7, 8], [8, 4]],
  },
  { // Gemini — the twin stick figures
    pts: [[0.30, 0.08], [0.55, 0.05], [0.25, 0.35], [0.50, 0.32], [0.20, 0.65], [0.45, 0.62], [0.15, 0.90], [0.40, 0.92]],
    segs: [[0, 2], [2, 4], [4, 6], [1, 3], [3, 5], [5, 7], [2, 3]],
  },
  { // Aquila — Altair diamond + tail
    pts: [[0.50, 0.10], [0.25, 0.40], [0.75, 0.35], [0.50, 0.55], [0.50, 0.90]],
    segs: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]],
  },
  { // Pegasus — the Great Square + neck
    pts: [[0.20, 0.20], [0.60, 0.15], [0.65, 0.55], [0.25, 0.60], [0.80, 0.05], [0.95, 0.30]],
    segs: [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4], [4, 5]],
  },
  { // Ursa Minor — the Little Dipper
    pts: [[0.10, 0.10], [0.25, 0.25], [0.40, 0.35], [0.55, 0.45], [0.75, 0.40], [0.80, 0.60], [0.60, 0.65]],
    segs: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
];
// Every cycle one real constellation fades in at a random spot, its lines
// joining star-by-star, lingers, then melts back into the field. Each segment
// is its own tiny Svg inside an Animated.View — native-driver View opacity,
// no animated SVG props (web `collapsable` leak).
function Constellation({ width, height, color, seed }: { width: number; height: number; color: string; seed: number }) {
  const { p, cfg } = useSpawn(
    () => ({
      ci: Math.floor(Math.random() * CONSTELLATIONS.length),
      x0: rand(0.08, 0.62), y0: rand(0.06, 0.5), s: rand(0.16, 0.26), dur: rand(13000, 18000),
    }),
    6000 + seed * 5000, 26000, Easing.linear,
  );
  const con = CONSTELLATIONS[cfg.ci];
  const box = cfg.s * Math.min(width, height) + 60;
  const px = con.pts.map(([x, y]) => [cfg.x0 * width + x * box, cfg.y0 * height + y * box]);
  const master = p.interpolate({ inputRange: [0, 0.1, 0.82, 1], outputRange: [0, 1, 1, 0] });
  const n = con.segs.length;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: master }]}>
      {/* stars first */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {px.map(([x, y], i) => (
          <Circle key={`p${i}`} cx={x} cy={y} r={1.8} fill={color} opacity={0.75} />
        ))}
      </Svg>
      {/* then the joins, one after another */}
      {con.segs.map(([a, b], i) => {
        const [x1, y1] = px[a];
        const [x2, y2] = px[b];
        const L = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
        const start = 0.1 + (i / n) * 0.4;
        const end = start + 0.4 / n;
        const segOp = p.interpolate({ inputRange: [0, start, end, 1], outputRange: [0, 0, 0.55, 0.55] });
        // grow the segment from its A end: scale a hairline View along the seg direction
        const angle = Math.atan2(y2 - y1, x2 - x1);
        return (
          <Animated.View key={`s${i}`} pointerEvents="none" style={{
            position: 'absolute', left: x1, top: y1, width: L, height: 1,
            backgroundColor: color, opacity: segOp,
            transform: [{ translateX: -L / 2 }, { rotate: `${angle}rad` }, { translateX: L / 2 }],
          }} />
        );
      })}
    </Animated.View>
  );
}

// One sun with god rays (inspiration/morning_sky.jpg) — soft disc + thin ray
// fan. Static (no breathe); the skyBody parallax plane nudges it between views.
function Sun({ width, height }: { width: number; height: number }) {
  const S = 220;
  const cx = S / 2, cy = S / 2;
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI * 2) / 10 + 0.25;
    return { x1: cx + Math.cos(a) * 30, y1: cy + Math.sin(a) * 30, x2: cx + Math.cos(a) * 48, y2: cy + Math.sin(a) * 48 };
  });
  return (
    // top 0.26 — high enough to read as sky, low enough to clear the desktop
    // toolbar + sub-bar rows that used to cover the disc
    <View pointerEvents="none" style={{ position: 'absolute', left: width * 0.80 - S / 2, top: height * 0.26 - S / 2 }}>
      <Svg width={S} height={S}>
        <Defs>
          <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#e8a54b" stopOpacity={0.20} />
            <Stop offset="0.5" stopColor="#e8a54b" stopOpacity={0.07} />
            <Stop offset="1" stopColor="#e8a54b" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={S / 2} fill="url(#sunGlow)" />
        <Circle cx={cx} cy={cy} r={17} fill="#e8a54b" opacity={0.22} />
        <Circle cx={cx} cy={cy} r={22} fill="none" stroke="#c99a52" strokeWidth={0.8} opacity={0.25} />
        {rays.map((r, i) => (
          <Line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="#c99a52" strokeWidth={1} opacity={0.20} />
        ))}
      </Svg>
    </View>
  );
}

// Light-mode ground band: two mountain ridges + a tree line in the same warm-ink
// silhouette language as the clouds. Static art; rides the mid parallax plane.
function Scenery({ width, height }: { width: number; height: number }) {
  const H = Math.max(120, Math.min(210, height * 0.21));
  const { farRidge, back, front, trees } = useMemo(() => {
    const rnd = mulberry32(4242);
    const ridge = (peaks: number, top: number, jitter: number) => {
      let d = `M 0 ${H} L 0 ${(top + rnd() * jitter).toFixed(1)}`;
      const n = peaks * 2;
      for (let i = 1; i <= n; i++) {
        const x = ((i / n) * width).toFixed(1);
        const y = (i % 2 === 1 ? top - rnd() * jitter * 1.6 : top + rnd() * jitter).toFixed(1);
        d += ` L ${x} ${y}`;
      }
      return `${d} L ${width} ${H} Z`;
    };
    const trees: { x: number; h: number; pine: boolean }[] = [];
    for (let i = 0; i < Math.round(width / 34); i++) {
      trees.push({ x: rnd() * width, h: 13 + rnd() * 19, pine: rnd() < 0.6 });
    }
    return {
      farRidge: ridge(3, H * 0.16, H * 0.18),
      back: ridge(5, H * 0.36, H * 0.22),
      front: ridge(7, H * 0.62, H * 0.18),
      trees,
    };
  }, [width, H]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, bottom: 0, width, height: H }}>
      <Svg width={width} height={H}>
        <Path d={farRidge} fill="rgba(120,100,60,0.08)" />
        <Path d={back} fill="rgba(120,100,60,0.13)" />
        <Path d={front} fill="rgba(110,92,55,0.18)" />
        {trees.map((t, i) => t.pine ? (
          // pine: two stacked triangles
          <G key={i} opacity={0.3}>
            <Path d={`M ${t.x - t.h * 0.34} ${H} L ${t.x} ${H - t.h * 0.72} L ${t.x + t.h * 0.34} ${H} Z`} fill="rgba(96,78,44,1)" />
            <Path d={`M ${t.x - t.h * 0.26} ${H - t.h * 0.42} L ${t.x} ${H - t.h} L ${t.x + t.h * 0.26} ${H - t.h * 0.42} Z`} fill="rgba(96,78,44,1)" />
          </G>
        ) : (
          // deciduous: crown + trunk
          <G key={i} opacity={0.26}>
            <Circle cx={t.x} cy={H - t.h * 0.62} r={t.h * 0.4} fill="rgba(96,78,44,1)" />
            <Rect x={t.x - 0.8} y={H - t.h * 0.45} width={1.6} height={t.h * 0.45} fill="rgba(96,78,44,1)" />
          </G>
        ))}
      </Svg>
    </View>
  );
}

// Puffy cloud (three overlapping pills) drifting across the sky in a long loop.
const CLOUDS = [
  { y0: 0.10, scale: 1.0, dur: 95000, phase: 0, dir: 1 },
  { y0: 0.26, scale: 0.7, dur: 120000, phase: 22000, dir: 1 },
  { y0: 0.06, scale: 1.25, dur: 130000, phase: 48000, dir: -1 },
  { y0: 0.38, scale: 0.55, dur: 105000, phase: 70000, dir: 1 },
  { y0: 0.18, scale: 0.85, dur: 88000, phase: 36000, dir: -1 },
  { y0: 0.32, scale: 0.9, dur: 112000, phase: 12000, dir: -1 },
  { y0: 0.14, scale: 0.6, dur: 98000, phase: 55000, dir: 1 },
  { y0: 0.44, scale: 1.1, dur: 125000, phase: 30000, dir: 1 },
  { y0: 0.02, scale: 0.75, dur: 92000, phase: 64000, dir: -1 },
  { y0: 0.22, scale: 1.35, dur: 140000, phase: 8000, dir: 1 },
  { y0: 0.50, scale: 0.5, dur: 100000, phase: 42000, dir: -1 },
  { y0: 0.08, scale: 0.95, dur: 118000, phase: 18000, dir: 1 },
  { y0: 0.36, scale: 0.65, dur: 108000, phase: 26000, dir: -1 },
  { y0: 0.12, scale: 1.15, dur: 132000, phase: 50000, dir: 1 },
  { y0: 0.28, scale: 0.8, dur: 96000, phase: 4000, dir: 1 },
  { y0: 0.55, scale: 0.6, dur: 122000, phase: 60000, dir: -1 },
];
function DriftCloud({ cfg, width, height }: { cfg: typeof CLOUDS[number]; width: number; height: number }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.sequence([
      Animated.delay(cfg.phase % 20000), // long phases collapse — clouds should be around early
      Animated.loop(Animated.timing(p, { toValue: 1, duration: cfg.dur, easing: Easing.linear, useNativeDriver: true })),
    ]);
    run.start();
    return () => run.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const W = 150 * cfg.scale;
  const tx = p.interpolate({ inputRange: [0, 1], outputRange: cfg.dir > 0 ? [-W, width + W] : [width + W, -W] });
  const op = p.interpolate({ inputRange: [0, 0.06, 0.94, 1], outputRange: [0, 1, 1, 0] });
  const ink = 'rgba(120,100,60,0.1)';
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: cfg.y0 * height, opacity: op, transform: [{ translateX: tx }] }}>
      <View style={{ width: W, height: 34 * cfg.scale }}>
        <View style={{ position: 'absolute', left: 0, top: 12 * cfg.scale, width: 62 * cfg.scale, height: 20 * cfg.scale, borderRadius: 12 * cfg.scale, backgroundColor: ink }} />
        <View style={{ position: 'absolute', left: 38 * cfg.scale, top: 0, width: 72 * cfg.scale, height: 27 * cfg.scale, borderRadius: 15 * cfg.scale, backgroundColor: ink }} />
        <View style={{ position: 'absolute', left: 88 * cfg.scale, top: 13 * cfg.scale, width: 55 * cfg.scale, height: 18 * cfg.scale, borderRadius: 10 * cfg.scale, backgroundColor: ink }} />
      </View>
    </Animated.View>
  );
}

// Tiny plane with a short contrail; respawns on a new track each crossing.
function Plane({ width, height }: { width: number; height: number }) {
  const { p, cfg } = useSpawn(
    () => ({ y0: rand(0.06, 0.4), dir: Math.random() < 0.5 ? 1 : -1, dur: rand(28000, 45000) }),
    15000, 60000,
  );
  const pad = 60;
  const tx = p.interpolate({ inputRange: [0, 1], outputRange: cfg.dir > 0 ? [-pad, width + pad] : [width + pad, -pad] });
  const vis = p.interpolate({ inputRange: [0, 0.02, 0.98, 1], outputRange: [0, 1, 1, 0] });
  const ink = 'rgba(100,84,52,0.35)';
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: cfg.y0 * height, opacity: vis, transform: [{ translateX: tx }, { scaleX: cfg.dir }] }}>
      {/* contrail behind the dart */}
      <View style={{ position: 'absolute', right: 10, top: 4, width: 38, height: 1, backgroundColor: 'rgba(120,100,60,0.14)' }} />
      <Svg width={12} height={9}>
        <Path d="M 0 4.5 L 12 2 L 7 4.5 L 12 7 Z" fill={ink} />
      </Svg>
    </Animated.View>
  );
}

// Hot-air balloon rising slowly with a gentle sway; respawns at a new x.
function Balloon({ width, height }: { width: number; height: number }) {
  const { p, cfg } = useSpawn(
    () => ({ x0: rand(0.08, 0.9), sway: rand(-18, 18), dur: rand(45000, 70000), warm: Math.random() < 0.5 }),
    20000, 70000,
  );
  const ty = p.interpolate({ inputRange: [0, 1], outputRange: [0, -(height + 120)] });
  const tx = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, cfg.sway, -cfg.sway * 0.5] });
  const op = p.interpolate({ inputRange: [0, 0.05, 0.9, 1], outputRange: [0, 0.2, 0.2, 0] });
  const tint = cfg.warm ? 'rgba(160,90,60,1)' : 'rgba(120,100,60,1)';
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: cfg.x0 * width, top: height + 20, opacity: op, transform: [{ translateX: tx }, { translateY: ty }], alignItems: 'center' }}>
      <View style={{ width: 10, height: 11, borderRadius: 5.5, backgroundColor: tint }} />
      <View style={{ width: 1, height: 4, backgroundColor: tint }} />
      <View style={{ width: 4.5, height: 3, borderRadius: 1, backgroundColor: tint }} />
    </Animated.View>
  );
}

// Small flock of "~" birds with a soft wing-flap, crossing the sky; respawns.
function Birds({ width, height }: { width: number; height: number }) {
  const { p, cfg } = useSpawn(
    () => ({
      y0: rand(0.08, 0.35), dir: Math.random() < 0.5 ? 1 : -1, dur: rand(25000, 35000),
      offs: Array.from({ length: 2 + Math.floor(Math.random() * 2) }, (_, i) => ({ dx: i * rand(14, 22), dy: (i % 2 === 0 ? 1 : -1) * rand(3, 8) })),
    }),
    12000, 45000,
  );
  const flap = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(flap, { toValue: 0.7, duration: 320, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(flap, { toValue: 1.15, duration: 320, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pad = 70;
  const tx = p.interpolate({ inputRange: [0, 1], outputRange: cfg.dir > 0 ? [-pad, width + pad] : [width + pad, -pad] });
  const vis = p.interpolate({ inputRange: [0, 0.02, 0.98, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: cfg.y0 * height, opacity: vis, transform: [{ translateX: tx }, { scaleX: cfg.dir }] }}>
      {cfg.offs.map((o, i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: o.dx, top: o.dy, transform: [{ scaleY: flap }] }}>
          <Svg width={13} height={6}>
            <Path d="M 0 4.5 Q 3 0.5 6.5 4.5 Q 10 0.5 13 4.5" stroke="rgba(90,75,50,0.4)" strokeWidth={1.1} fill="none" />
          </Svg>
        </Animated.View>
      ))}
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
  const showDay = mode === 'light' && stars > 0;
  const [aur1, aur2] = AURORA_PRESETS[aurora as AuroraKey] ?? AURORA_PRESETS.violet;

  // Density dial: 1.0 at the default of 140; scales object counts in both modes.
  const density = stars / 140;
  const countOf = (base: number, max: number) => (stars <= 0 ? 0 : Math.max(1, Math.min(max, Math.round(base * density))));

  const OWs = width * STRIP;      // star strip width
  const OHs = height * 1.4;       // vertical margin for the zoom pulse
  const AW = width * 1.4;         // aurora width (centred)

  // Two depth layers across the strip, plus a few SHAPED stars (4-point sparkles
  // and 5-point stars — the line-art look) on the near layer. The `stars`
  // setting is a PER-VIEWPORT density: the strip is STRIP× wide, so the counts
  // scale by STRIP to keep every filmstrip region as dense as the slider says.
  const { far, near, shaped, woven } = useMemo(() => {
    const rnd = mulberry32(1337);
    const far: Star[] = [];
    const near: Star[] = [];
    const shaped: ShapedStar[] = [];
    const n = Math.min(Math.round(stars * STRIP), 2000);
    for (let i = 0; i < n; i++) {
      const isNear = rnd() < 0.4;
      const s: Star = { x: rnd() * OWs, y: rnd() * OHs, r: isNear ? 0.8 + rnd() * 0.9 : 0.4 + rnd() * 0.5, gold: rnd() < 0.1 };
      (isNear ? near : far).push(s);
    }
    const nShaped = Math.min(Math.round(n * 0.05), 48);
    for (let i = 0; i < nShaped; i++) {
      shaped.push({ x: rnd() * OWs, y: rnd() * OHs, r: 2.5 + rnd() * 3.5, five: rnd() < 0.45, gold: rnd() < 0.25 });
    }
    // Constellations woven INTO the strip (they pan with the stars, so each
    // view slot shows a different piece of sky): spread across the strip, one
    // random real figure each, drawn as faint permanent joins + brighter dots.
    const woven: { lines: [number, number, number, number][]; dots: [number, number][] }[] = [];
    const nWoven = stars >= 60 ? 5 : 0;
    for (let i = 0; i < nWoven; i++) {
      const fig = CONSTELLATIONS[Math.floor(rnd() * CONSTELLATIONS.length)];
      const box = 110 + rnd() * 70;
      const cx = ((i + 0.2 + rnd() * 0.6) / nWoven) * OWs;
      const cy = (0.06 + rnd() * 0.4) * OHs;
      const px = fig.pts.map(([x, y]) => [cx + x * box, cy + y * box] as [number, number]);
      woven.push({
        lines: fig.segs.map(([a, b]) => [px[a][0], px[a][1], px[b][0], px[b][1]] as [number, number, number, number]),
        dots: px,
      });
    }
    return { far, near, shaped, woven };
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

  // More planes, slowest → fastest: SKY-BODY (sun/moon, near-static drift),
  // MID (day movers: clouds/balloons/birds/plane), SKY (night movers: meteors,
  // satellites, nebula, spotlight constellations, motes), SCENERY (light-mode
  // ground — closest to the viewer, so it pans hardest, starfield-style).
  // Every mover plane gets a widened coordinate space so the pan never
  // uncovers a bare edge.
  const BODY_F = 0.05, MID_F = 0.16, SKY_F = 0.22, SCENERY_F = 0.45;
  const planeX = (f: number) => am ? am.pan.interpolate({ inputRange: [0, VIEWS], outputRange: [0, -travel * f], extrapolate: 'clamp' }) : 0;
  const bodyTf = am ? { transform: [{ translateX: planeX(BODY_F) }] } : null;
  const midTf = am ? { transform: [{ translateX: planeX(MID_F) }] } : null;
  const skyTf = am ? { transform: [{ translateX: planeX(SKY_F) }] } : null;
  const sceneryTf = am ? { transform: [{ translateX: planeX(SCENERY_F) }] } : null;
  const midW = width + travel * MID_F;
  const skyW = width + travel * SKY_F;
  const scenW = width + travel * SCENERY_F;
  const planeBox = (w: number) => ({ position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: w });

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
              {/* far-layer scenery: one Saturn (parallax rides the far strip) */}
              {stars >= 60 ? (
                <G opacity={0.5} transform={`rotate(-18 ${OWs * 0.31} ${OHs * 0.2})`}>
                  <Circle cx={OWs * 0.31} cy={OHs * 0.2} r={5} fill="#cfc6ff" fillOpacity={0.6} />
                  <Ellipse cx={OWs * 0.31} cy={OHs * 0.2} rx={10.5} ry={3.2} stroke="#cfc6ff" strokeWidth={0.8} fill="none" />
                </G>
              ) : null}
            </Svg>
          </Animated.View>
          <Animated.View style={[starBox, { opacity: twNear }, nearTf]}>
            <Svg width={OWs} height={OHs}>
              {near.map((s, j) => (
                <Circle key={j} cx={s.x} cy={s.y} r={s.r} fill={s.gold ? c.gold : '#ffffff'} fillOpacity={0.9} />
              ))}
              {/* shaped feature stars — 4-point sparkles + 5-point stars */}
              {shaped.map((s, j) => (
                <Path key={`sh${j}`} d={s.five ? starPath(s.x, s.y, s.r) : sparklePath(s.x, s.y, s.r)}
                  fill={s.gold ? c.gold : '#ffffff'} fillOpacity={0.75} />
              ))}
              {/* woven constellations — permanent faint figures riding the strip */}
              {woven.map((w, j) => (
                <G key={`cn${j}`}>
                  {w.lines.map(([x1, y1, x2, y2], k) => (
                    <Line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cfc6ff" strokeWidth={0.7} strokeOpacity={0.16} />
                  ))}
                  {w.dots.map(([x, y], k) => (
                    <Circle key={`d${k}`} cx={x} cy={y} r={1.6} fill="#ffffff" fillOpacity={0.55} />
                  ))}
                </G>
              ))}
            </Svg>
          </Animated.View>
        </View>
      )}

      {/* night sky objects — dark mode; the moon stays even with motion off,
          riding the near-static sky-body plane */}
      {showStars ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, bodyTf]}>
          <Moon width={width} height={height} />
        </Animated.View>
      ) : null}
      {showStars && motion ? (
        <Animated.View pointerEvents="none" style={[planeBox(skyW), skyTf]}>
          {Array.from({ length: countOf(2, 3) }, (_, i) => <Meteor key={`m${i}`} width={skyW} height={height} />)}
          {stars >= 40 ? <Meteor big width={skyW} height={height} /> : null}
          {Array.from({ length: countOf(2, 3) }, (_, i) => <Satellite key={`s${i}`} width={skyW} height={height} />)}
          {MOTES.slice(0, countOf(4, 6)).map((cfg, i) => <DriftMote key={`dm${i}`} cfg={cfg} width={skyW} height={height} color="#ffffff" peak={0.13} />)}
          {stars >= 80 ? <Constellation width={skyW} height={height} color="#e8e2ff" seed={0} /> : null}
          {stars >= 180 ? <Constellation width={skyW} height={height} color="#e8e2ff" seed={1} /> : null}
          {stars >= 100 ? <Nebula width={skyW} height={height} /> : null}
        </Animated.View>
      ) : null}

      {/* daysky — light mode. Sun on the near-static sky-body plane; scenery +
          clouds/planes/balloons/birds on the MID plane so they slide as a group
          between views. Scenery + sun stay even with motion off. */}
      {showDay ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, bodyTf]}>
          <Sun width={width} height={height} />
        </Animated.View>
      ) : null}
      {showDay ? (
        <Animated.View pointerEvents="none" style={[planeBox(midW), midTf]}>
          {motion ? (
            <>
              {CLOUDS.slice(0, countOf(10, 16)).map((cfg, i) => <DriftCloud key={`c${i}`} cfg={cfg} width={midW} height={height} />)}
              {Array.from({ length: countOf(1, 2) }, (_, i) => <Plane key={`p${i}`} width={midW} height={height} />)}
              {Array.from({ length: countOf(3, 5) }, (_, i) => <Balloon key={`b${i}`} width={midW} height={height} />)}
              {Array.from({ length: countOf(1, 2) }, (_, i) => <Birds key={`f${i}`} width={midW} height={height} />)}
              {MOTES.slice(0, countOf(5, 7)).map((cfg, i) => <DriftMote key={`lm${i}`} cfg={cfg} width={midW} height={height} color="rgba(96,78,44,1)" peak={0.12} />)}
            </>
          ) : null}
        </Animated.View>
      ) : null}
      {/* ground scenery on its own FAST plane — closest layer, starfield-style
          pan between views; shown even with motion off */}
      {showDay ? (
        <Animated.View pointerEvents="none" style={[planeBox(scenW), sceneryTf]}>
          <Scenery width={scenW} height={height} />
        </Animated.View>
      ) : null}
    </View>
  );
}
