// Shared visual primitives ported from the design bundle: Avatar (photo or
// gender-tinted initials), IconBtn, SectionLabel (mono caps), animated Counter,
// ThemeToggle (spring-rotating sun/moon).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, Image, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, radius, font, genderTint, type Palette } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { Icon, type IconName } from './Icon';
import { initials } from '../shared/adjacency';
import type { Member } from '../shared/types';

export function Avatar({ m, size = 40, ring, style }: {
  m?: Member; size?: number; ring?: string; style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const t = genderTint(c, m?.gender);
  return (
    <View style={[{
      width: size, height: size, borderRadius: size, flexShrink: 0,
      backgroundColor: t.bg, borderWidth: 1.5, borderColor: ring || t.brd,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }, style]}>
      {m?.photoUrl
        ? <Image source={{ uri: m.photoUrl }} style={{ width: '100%', height: '100%' }} />
        : <Text style={{ color: t.ink, fontFamily: font.sansBold, fontSize: size * 0.34, letterSpacing: 0.3 }}>{m ? initials(m.name) : '?'}</Text>}
    </View>
  );
}

export function IconBtn({ name, onPress, size = 42, icon = 20, tone = 'ghost', stroke = 1.7, style }: {
  name: IconName; onPress?: () => void; size?: number; icon?: number;
  tone?: 'ghost' | 'glass' | 'soft' | 'solid' | 'rose'; stroke?: number; style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const tones = {
    ghost: { bg: 'transparent', brd: c.line, col: c.inkSoft },
    glass: { bg: c.glassBg, brd: c.glassBrd, col: c.ink },
    soft: { bg: c.accentSoft, brd: 'transparent', col: c.accent },
    solid: { bg: c.accent, brd: c.accent, col: c.accentInk },
    rose: { bg: c.roseSoft, brd: 'transparent', col: c.rose },
  } as const;
  const t = tones[tone];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{
      width: size, height: size, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: t.bg, borderWidth: 1, borderColor: t.brd,
      transform: [{ scale: pressed ? 0.95 : 1 }],
    }, style]}>
      <Icon name={name} size={icon} stroke={stroke} color={t.col} />
    </Pressable>
  );
}

export function SectionLabel({ children, c, style }: { children: ReactNode; c: Palette; style?: object }) {
  return (
    <Text style={[{ fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.7, textTransform: 'uppercase', color: c.mute }, style]}>
      {children}
    </Text>
  );
}

// Animated number counter (eased count-up like the design's <Counter/>).
export function Counter({ value, dur = 900, style }: { value: number; dur?: number; style?: object }) {
  const { motion } = useSettings();
  const [n, setN] = useState(motion ? 0 : value);
  useEffect(() => {
    if (!motion) { setN(value); return; }
    let raf: number; let start: number | undefined;
    const tick = (t: number) => {
      if (start === undefined) start = t;
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, dur, motion]);
  return <Text style={style}>{n}</Text>;
}

// Theme toggle with the design's spring icon rotation.
export function ThemeToggle({ size = 42 }: { size?: number }) {
  const { c, mode, toggle } = useTheme();
  const spin = useRef(new Animated.Value(mode === 'dark' ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(spin, {
      toValue: mode === 'dark' ? 0 : 1,
      duration: 600,
      easing: Easing.elastic(1),
      useNativeDriver: true,
    }).start();
  }, [mode]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Pressable onPress={toggle} style={({ pressed }) => ({
      width: size, height: size, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.glassBg, borderWidth: 1, borderColor: c.glassBrd,
      transform: [{ scale: pressed ? 0.95 : 1 }],
    })}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Icon name={mode === 'dark' ? 'moon' : 'sun'} size={20} color={c.ink} />
      </Animated.View>
    </Pressable>
  );
}

// Staggered entrance wrapper — fades+rises children in (set i per child).
export function Rise({ children, i = 0, style }: { children: ReactNode; i?: number; style?: StyleProp<ViewStyle> }) {
  const { motion } = useSettings();
  const v = useRef(new Animated.Value(motion ? 0 : 1)).current;
  useEffect(() => {
    if (!motion) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 500, delay: Math.min(i, 16) * 55, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }).start();
  }, [motion]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

// Opacity-only entrance (design's .anim-fade). Re-fades when `trigger` changes —
// handy keyed on a tab id so switching tabs cross-fades the content.
export function Fade({ children, trigger, dur = 400, style }: { children: ReactNode; trigger?: unknown; dur?: number; style?: StyleProp<ViewStyle> }) {
  const { motion } = useSettings();
  const v = useRef(new Animated.Value(motion ? 0 : 1)).current;
  useEffect(() => {
    if (!motion) { v.setValue(1); return; }
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [trigger, motion]);
  return <Animated.View style={[{ opacity: v }, style]}>{children}</Animated.View>;
}

// Node entrance for the tree/radial — scale-pop in (design's .node-enter /
// ft-nodepop). Scale-only + fade so cards stay visible. Staggered by index.
export function NodePop({ children, i = 0, style }: { children: ReactNode; i?: number; style?: StyleProp<ViewStyle> }) {
  const { motion } = useSettings();
  const v = useRef(new Animated.Value(motion ? 0 : 1)).current;
  useEffect(() => {
    if (!motion) { v.setValue(1); return; }
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 420, delay: Math.min(i * 22, 500), easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }).start();
  }, [motion]);
  return (
    <Animated.View style={[{ opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

// Three bouncing dots — the design's AI "typing" indicator (ft-float on dots).
export function TypingDots({ color }: { color?: string }) {
  const { c } = useTheme();
  const { motion } = useSettings();
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    if (!motion) return;
    const loops = dots.map((v, idx) =>
      Animated.loop(Animated.sequence([
        Animated.delay(idx * 150),
        Animated.timing(v, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [motion]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingVertical: 4 }}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={{
          width: 6, height: 6, borderRadius: 3, backgroundColor: color ?? c.mute,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
        }} />
      ))}
    </View>
  );
}
