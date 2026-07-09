// Connector lines that draw themselves in (design's .link-draw / ft-draw):
// each path gets a dasharray equal to ITS OWN length and slides the offset to
// 0, so every line visibly draws tip-to-tail across the full duration. (The
// old shared diagram-sized dash meant a 200px line finished inside the first
// ~5% of the tween — lines "just appeared".) Reanimated drives the SVG prop so
// it works on web + native. Restarts when `drawKey` changes; skipped (solid
// lines) when `animate` is off (motion off / very large graph).
//
// Every solid line is painted twice: a wide faint GLOW pass underneath and the
// crisp stroke on top — both share the draw progress, so the glow draws in
// with the line. `stagger` offsets the lines within one group so e.g. each
// offspring's connector joins a beat after its elder sibling's.
//
// Shared by Tree / Radial / Network. `dashed` lines (ex-partner spokes) keep a
// real 5,4 dash pattern — that can't share strokeDasharray with the draw
// trick, so they FADE in on the same progress instead. Fades use a
// static-opacity G × animated path opacity: animating a G directly leaks
// reanimated's `collapsable` prop onto the DOM <g> on web.
import { useEffect, useMemo } from 'react';
import { Path, G } from 'react-native-svg';
import Reanimated, { useSharedValue, useAnimatedProps, withTiming, withDelay, Easing as REasing } from 'react-native-reanimated';

const RnPath = Reanimated.createAnimatedComponent(Path);

export interface DrawLine {
  d: string;
  ownerId?: string;   // combined view: which family's connector this is
  color?: string;     // per-line stroke (falls back to colorFor → color)
  opacity?: number;   // per-line opacity (default 0.5)
  dashed?: boolean;   // real dash pattern → fades in instead of dash-drawing
}

const GLOW_W = 3.4;     // glow stroke width = strokeWidth * GLOW_W
const GLOW_OP = 0.35;   // glow opacity = line opacity * GLOW_OP
const STAGGER_CAP = 480; // per-group stagger never delays a line more than this

// Approximate path length: straight segments summed exactly, C/Q flattened in
// 8 steps — feeds the per-line dasharray.
export function pathLength(d: string): number {
  const tokens = d.match(/[MLCQZz]|-?[\d.]+/g);
  if (!tokens) return 0;
  let i = 0, len = 0, x = 0, y = 0, sx = 0, sy = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i++];
    if (t === 'M') { x = num(); y = num(); sx = x; sy = y; }
    else if (t === 'L') { const nx = num(), ny = num(); len += Math.hypot(nx - x, ny - y); x = nx; y = ny; }
    else if (t === 'Q' || t === 'C') {
      const pts = Array.from({ length: t === 'Q' ? 4 : 6 }, num);
      let px = x, py = y;
      for (let s = 1; s <= 8; s++) {
        const u = s / 8, v = 1 - u;
        let bx: number, by: number;
        if (t === 'Q') {
          bx = v * v * x + 2 * v * u * pts[0] + u * u * pts[2];
          by = v * v * y + 2 * v * u * pts[1] + u * u * pts[3];
        } else {
          bx = v ** 3 * x + 3 * v * v * u * pts[0] + 3 * v * u * u * pts[2] + u ** 3 * pts[4];
          by = v ** 3 * y + 3 * v * v * u * pts[1] + 3 * v * u * u * pts[3] + u ** 3 * pts[5];
        }
        len += Math.hypot(bx - px, by - py); px = bx; py = by;
      }
      x = pts[pts.length - 2]; y = pts[pts.length - 1];
    } else if (t === 'Z' || t === 'z') { len += Math.hypot(sx - x, sy - y); x = sx; y = sy; }
  }
  return len;
}

function DrawPath({ d, stroke, strokeWidth, opacity, animate, drawKey, delay, glow }: {
  d: string; stroke: string; strokeWidth: number; opacity: number;
  animate: boolean; drawKey: string; delay: number; glow: boolean;
}) {
  const len = useMemo(() => Math.max(1, Math.ceil(pathLength(d)) + 2), [d]);
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) { p.value = 1; return; }
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: 800, easing: REasing.bezier(0.33, 1, 0.68, 1) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawKey, animate]);
  const glowProps = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value) }));
  const drawProps = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value) }));
  return (
    <>
      {glow ? (
        <RnPath d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth * GLOW_W} opacity={opacity * GLOW_OP}
          strokeLinecap="round" strokeDasharray={len} animatedProps={glowProps} />
      ) : null}
      <RnPath d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} opacity={opacity}
        strokeLinecap="round" strokeDasharray={len} animatedProps={drawProps} />
    </>
  );
}

function DashedFadePath({ d, stroke, strokeWidth, opacity, animate, drawKey, delay, glow }: {
  d: string; stroke: string; strokeWidth: number; opacity: number;
  animate: boolean; drawKey: string; delay: number; glow: boolean;
}) {
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) { p.value = 1; return; }
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: 800, easing: REasing.bezier(0.33, 1, 0.68, 1) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawKey, animate]);
  const fadeProps = useAnimatedProps(() => ({ opacity: p.value }));
  const glowFadeProps = useAnimatedProps(() => ({ opacity: p.value }));
  return (
    <G opacity={opacity}>
      {glow ? (
        <G opacity={GLOW_OP}>
          <RnPath d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth * GLOW_W}
            strokeLinecap="round" strokeDasharray="5,4" animatedProps={glowFadeProps} />
        </G>
      ) : null}
      <RnPath d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray="5,4" animatedProps={fadeProps} />
    </G>
  );
}

export function DrawLines({ lines, color, colorFor, animate, drawKey, strokeWidth = 1.5, delay = 0, stagger = 0, glow = true }: {
  lines: DrawLine[]; color: string;
  // combined view: per-line family tint (falls back to `color`)
  colorFor?: (ownerId?: string) => string | undefined;
  animate: boolean; drawKey: string; strokeWidth?: number;
  // hold the redraw this long (radial waits for nodes to glide into place first)
  delay?: number;
  // extra per-line delay within this group — offspring join one after another
  stagger?: number;
  glow?: boolean;
}) {
  const strokeOf = (l: DrawLine) => l.color ?? colorFor?.(l.ownerId) ?? color;
  const solid = lines.filter((l) => !l.dashed);
  const dashed = lines.filter((l) => l.dashed);
  return (
    <>
      {solid.map((l, i) => (
        <DrawPath key={i} d={l.d} stroke={strokeOf(l)} strokeWidth={strokeWidth} opacity={l.opacity ?? 0.5}
          animate={animate} drawKey={drawKey} delay={delay + Math.min(i * stagger, STAGGER_CAP)} glow={glow} />
      ))}
      {dashed.map((l, i) => (
        <DashedFadePath key={`d${i}`} d={l.d} stroke={strokeOf(l)} strokeWidth={strokeWidth} opacity={l.opacity ?? 0.5}
          animate={animate} drawKey={drawKey} delay={delay + Math.min((solid.length + i) * stagger, STAGGER_CAP)} glow={glow} />
      ))}
    </>
  );
}

// The OUTGOING set of lines during a relayout (radial depth/focus change): the
// snapshot fades to nothing while the nodes glide, then unmounts. Same
// static-G × animated-path-opacity trick as the dashed lines above; the glow
// underlay fades with its line.
export function FadeOutLines({ lines, color, strokeWidth = 1.5 }: {
  lines: DrawLine[]; color: string; strokeWidth?: number;
}) {
  const p = useSharedValue(1);
  useEffect(() => {
    p.value = withTiming(0, { duration: 420, easing: REasing.out(REasing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fade = useAnimatedProps(() => ({ opacity: p.value }));
  const glowFade = useAnimatedProps(() => ({ opacity: p.value }));
  return (
    <>
      {lines.map((l, i) => (
        <G key={i} opacity={l.opacity ?? 0.5}>
          <G opacity={GLOW_OP}>
            <RnPath d={l.d} fill="none" stroke={l.color ?? color} strokeWidth={strokeWidth * GLOW_W}
              strokeLinecap="round" strokeDasharray={l.dashed ? '5,4' : undefined} animatedProps={glowFade} />
          </G>
          <RnPath d={l.d} fill="none" stroke={l.color ?? color} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={l.dashed ? '5,4' : undefined} animatedProps={fade} />
        </G>
      ))}
    </>
  );
}
