// Connector lines that draw themselves in (design's .link-draw / ft-draw): a
// long dash slides its offset to 0. `dash` MUST exceed the longest path or the
// single-value dasharray leaves a gap that clips wide connectors (the broken
// links on large trees) — so callers drive it off the diagram bounding box
// (width + height ≥ any M…L… path). Reanimated drives the SVG prop so it works
// on web + native. Restarts when `drawKey` changes; skipped (solid lines) when
// `animate` is off (motion off / large tree).
//
// Shared by Tree / Radial / Network. Each line may carry its own `color` and
// `opacity`; `dashed` lines (ex-partner spokes) keep a real 5,4 dash pattern —
// that can't share strokeDasharray with the draw trick, so they FADE in on the
// same progress instead.
import { useEffect } from 'react';
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

export function DrawLines({ lines, color, colorFor, dash, animate, drawKey, strokeWidth = 1.5, delay = 0 }: {
  lines: DrawLine[]; color: string;
  // combined view: per-line family tint (falls back to `color`)
  colorFor?: (ownerId?: string) => string | undefined;
  dash: number; animate: boolean; drawKey: string; strokeWidth?: number;
  // hold the redraw this long (radial waits for nodes to glide into place first)
  delay?: number;
}) {
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) { p.value = 1; return; }
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: 900, easing: REasing.bezier(0.16, 1, 0.3, 1) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawKey, animate]);
  const drawProps = useAnimatedProps(() => ({ strokeDashoffset: dash * (1 - p.value) }));
  const fadeProps = useAnimatedProps(() => ({ opacity: p.value }));

  const strokeOf = (l: DrawLine) => l.color ?? colorFor?.(l.ownerId) ?? color;
  const solid = lines.filter((l) => !l.dashed);
  const dashed = lines.filter((l) => l.dashed);

  return (
    <>
      {solid.map((l, i) => (
        <RnPath key={i} d={l.d} fill="none" stroke={strokeOf(l)} strokeWidth={strokeWidth} opacity={l.opacity ?? 0.5}
          strokeLinecap="round" strokeDasharray={dash} animatedProps={drawProps} />
      ))}
      {dashed.map((l, i) => (
        // Static-opacity G × animated path opacity — animating a G directly
        // leaks reanimated's `collapsable` prop onto the DOM <g> on web.
        <G key={`d${i}`} opacity={l.opacity ?? 0.5}>
          <RnPath d={l.d} fill="none" stroke={strokeOf(l)} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray="5,4" animatedProps={fadeProps} />
        </G>
      ))}
    </>
  );
}

// The OUTGOING set of lines during a relayout (radial depth/focus change): the
// snapshot fades to nothing while the nodes glide, then unmounts. Same
// static-G × animated-path-opacity trick as the dashed lines above.
export function FadeOutLines({ lines, color, strokeWidth = 1.5 }: {
  lines: DrawLine[]; color: string; strokeWidth?: number;
}) {
  const p = useSharedValue(1);
  useEffect(() => {
    p.value = withTiming(0, { duration: 420, easing: REasing.out(REasing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fade = useAnimatedProps(() => ({ opacity: p.value }));
  return (
    <>
      {lines.map((l, i) => (
        <G key={i} opacity={l.opacity ?? 0.5}>
          <RnPath d={l.d} fill="none" stroke={l.color ?? color} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={l.dashed ? '5,4' : undefined} animatedProps={fade} />
        </G>
      ))}
    </>
  );
}
