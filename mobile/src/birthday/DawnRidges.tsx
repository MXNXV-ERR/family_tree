// Light mode — a dawn range, not an inverted sky (SPEC §8).
//
// Ground gradient + four parallax ridges occupying the bottom ~470px of the
// frame, with one sun glow behind the tallest peak (drawn by BirthdaySky, which
// pins the celebrant's node inside it). Dark mode NEVER gets a ridge — this
// component is only mounted from the light branch.
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSettings } from '../theme/SettingsContext';
import { hashId, type SkyFrame } from '../shared/birthday';

const RIDGE_COLORS = ['#b9c6de', '#93a5c7', '#6d7fa6', '#4f6088'];

// A ridge line built from a fixed seed, so the range is the same every open.
function ridgePath(frame: SkyFrame, band: number, seed: string): string {
  const top = frame.h - 470 + band * 88;     // back ridge highest, front lowest
  const amp = 74 - band * 12;
  const steps = 7;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (frame.w / steps) * i;
    const r = (hashId(seed + ':' + i) % 1000) / 1000;
    // the tallest peak sits near the sun glow (just left of centre)
    const peak = Math.exp(-Math.pow((x - frame.w * 0.54) / (frame.w * 0.3), 2));
    pts.push([x, top + amp * (0.35 + r * 0.65) - amp * 0.9 * peak]);
  }
  let d = `M0 ${frame.h} L0 ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const mx = (px + x) / 2;
    d += ` Q${mx} ${py} ${x} ${y}`;
  }
  d += ` L${frame.w} ${frame.h} Z`;
  return d;
}

export function DawnRidges({ frame }: { frame: SkyFrame }) {
  const { motion } = useSettings();
  const drift = useRef(new Animated.Value(0)).current;

  // A very slow parallax breath — the back ridges move least.
  useEffect(() => {
    if (!motion) { drift.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 22000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 22000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [motion]);

  const paths = useMemo(
    () => RIDGE_COLORS.map((_, i) => ridgePath(frame, i, 'ridge' + i)),
    [frame.w, frame.h],
  );

  return (
    <>
      <LinearGradient
        colors={['#dbe4f6', '#e6e9f4', '#f6e8de']}
        locations={[0, 0.46, 1]}
        style={{ position: 'absolute', left: 0, top: 0, width: frame.w, height: frame.h }}
      />
      {paths.map((d, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute', left: 0, top: 0,
            transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, (i + 1) * 3] }) }],
          }}>
          <Svg width={frame.w} height={frame.h}>
            <Path d={d} fill={RIDGE_COLORS[i]} />
          </Svg>
        </Animated.View>
      ))}
    </>
  );
}
