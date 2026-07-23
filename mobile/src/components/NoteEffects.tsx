// Celebratory note effects — a one-shot burst (NoteEffect) that plays when a note
// opens/replays, plus a subtle looping background layer (NoteAmbient) that drifts
// behind the note while it's open (like the ambient stars/clouds). Built on RN
// Animated (no new deps; same particle-loop idea as ui/AmbientBackground). Motion-
// gated, pointerEvents:none. Sizes to its own container via onLayout so it fits the
// full-screen note overlay AND the narrower desktop drawer.
import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { useSettings } from '../theme/SettingsContext';
import type { NoteEffectKind } from '../shared/types';

const COLORS = ['#ff6b8a', '#ffd166', '#8f8bff', '#5fd0b0', '#ff9f68', '#6fb1ff'];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

// Representative glyph per effect (for emoji-rain + the ambient layer).
const GLYPH: Record<string, string> = {
  confetti: '🎊', hearts: '❤️', sparkles: '✨', stars: '⭐', fireworks: '🎆',
  balloons: '🎈', snow: '❄️', bubbles: '🫧', petals: '🌸', emojiRain: '🎉',
  glitter: '✨', ribbons: '🎗️', wings: '🕊️',
};
const FALLING = new Set(['snow', 'petals', 'confetti', 'ribbons']);

// ---------------- one-shot particles ----------------
function Confetto({ W, H, color }: { W: number; H: number; color: string }) {
  const p = useRef(new Animated.Value(0)).current;
  const cfg = useRef({ x: rand(0.04, 0.96) * W, delay: rand(0, 450), dur: rand(1400, 2500), drift: rand(-40, 40), spins: rand(2, 6), w: rand(6, 10), h: rand(9, 15) }).current;
  useEffect(() => { Animated.timing(p, { toValue: 1, duration: cfg.dur, delay: cfg.delay, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(); }, []);
  return <Animated.View style={{ position: 'absolute', left: cfg.x, top: 0, width: cfg.w, height: cfg.h, borderRadius: 2, backgroundColor: color, opacity: p.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-30, H * 0.95] }) }, { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.drift] }) }, { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${cfg.spins * 360}deg`] }) }] }} />;
}
function Ribbon({ W, H, color }: { W: number; H: number; color: string }) {
  const p = useRef(new Animated.Value(0)).current;
  const cfg = useRef({ x: rand(0.05, 0.95) * W, delay: rand(0, 500), dur: rand(1800, 2800), sway: rand(30, 60), len: rand(18, 30) }).current;
  useEffect(() => { Animated.timing(p, { toValue: 1, duration: cfg.dur, delay: cfg.delay, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(); }, []);
  return <Animated.View style={{ position: 'absolute', left: cfg.x, top: 0, width: 4, height: cfg.len, borderRadius: 2, backgroundColor: color, opacity: p.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-30, H] }) }, { translateX: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, cfg.sway, -cfg.sway] }) }, { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '220deg'] }) }] }} />;
}
function Riser({ W, H, glyph, size, drift, dur }: { W: number; H: number; glyph: string; size: [number, number]; drift: number; dur: [number, number] }) {
  const p = useRef(new Animated.Value(0)).current;
  const cfg = useRef({ x: rand(0.08, 0.92) * W, delay: rand(0, 700), dur: rand(dur[0], dur[1]), drift: rand(-drift, drift), size: rand(size[0], size[1]) }).current;
  useEffect(() => { Animated.timing(p, { toValue: 1, duration: cfg.dur, delay: cfg.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, []);
  return <Animated.Text style={{ position: 'absolute', left: cfg.x, top: 0, fontSize: cfg.size, opacity: p.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [H * 0.9, H * 0.05] }) }, { translateX: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, cfg.drift, 0] }) }, { scale: p.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.3, 1, 1] }) }] }}>{glyph}</Animated.Text>;
}
function Faller({ W, H, glyph, size, sway, dur, spin }: { W: number; H: number; glyph: string; size: [number, number]; sway: number; dur: [number, number]; spin?: boolean }) {
  const p = useRef(new Animated.Value(0)).current;
  const cfg = useRef({ x: rand(0.04, 0.96) * W, delay: rand(0, 800), dur: rand(dur[0], dur[1]), sway: rand(sway * 0.5, sway), size: rand(size[0], size[1]) }).current;
  useEffect(() => { Animated.timing(p, { toValue: 1, duration: cfg.dur, delay: cfg.delay, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(); }, []);
  return <Animated.Text style={{ position: 'absolute', left: cfg.x, top: 0, fontSize: cfg.size, opacity: p.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-30, H] }) }, { translateX: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, cfg.sway, -cfg.sway] }) }, ...(spin ? [{ rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '260deg'] }) }] : [])] }}>{glyph}</Animated.Text>;
}
function Glint({ W, H, size }: { W: number; H: number; size: [number, number] }) {
  const p = useRef(new Animated.Value(0)).current;
  const cfg = useRef({ x: rand(0.04, 0.94) * W, y: rand(0.08, 0.86) * H, delay: rand(0, 1000), dur: rand(600, 1100), size: rand(size[0], size[1]) }).current;
  useEffect(() => { Animated.timing(p, { toValue: 1, duration: cfg.dur, delay: cfg.delay, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(); }, []);
  return <Animated.Text style={{ position: 'absolute', left: cfg.x, top: cfg.y, fontSize: cfg.size, opacity: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }), transform: [{ scale: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }) }, { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] }}>✨</Animated.Text>;
}
function ShootingStar({ W, H }: { W: number; H: number }) {
  const p = useRef(new Animated.Value(0)).current;
  const cfg = useRef({ x: rand(0.05, 0.7) * W, y: rand(0.04, 0.42) * H, delay: rand(0, 1500), dur: rand(700, 1100), len: rand(0.3, 0.55) * Math.max(W, 260), ang: rand(20, 40) }).current;
  useEffect(() => { Animated.timing(p, { toValue: 1, duration: cfg.dur, delay: cfg.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, []);
  const radA = (cfg.ang * Math.PI) / 180;
  return (
    <Animated.View style={{ position: 'absolute', left: cfg.x, top: cfg.y, opacity: p.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.85, 0] }), transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(radA) * cfg.len] }) }, { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(radA) * cfg.len] }) }, { rotate: `${cfg.ang}deg` }] }}>
      <View style={{ width: 60, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.85)' }} />
      <View style={{ position: 'absolute', right: -2, top: -1, width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' }} />
    </Animated.View>
  );
}
function Firework({ W, H, color }: { W: number; H: number; color?: string }) {
  const p = useRef(new Animated.Value(0)).current;
  const cfg = useRef({ cx: rand(0.2, 0.8) * W, cy: rand(0.18, 0.6) * H, delay: rand(0, 700), dur: rand(900, 1300) }).current;
  useEffect(() => { Animated.timing(p, { toValue: 1, duration: cfg.dur, delay: cfg.delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, []);
  const N = 16;
  return <>{range(N).map((i) => { const a = (i / N) * Math.PI * 2; const r = rand(50, 92); return <Animated.View key={i} style={{ position: 'absolute', left: cfg.cx, top: cfg.cy, width: 6, height: 6, borderRadius: 3, backgroundColor: color || COLORS[i % COLORS.length], opacity: p.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 0.7, 0] }), transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * r] }) }, { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * r] }) }] }} />; })}</>;
}
function Flyer({ W, H }: { W: number; H: number }) {
  const p = useRef(new Animated.Value(0)).current;
  const flap = useRef(new Animated.Value(0)).current;
  const cfg = useRef({ y: rand(0.15, 0.75) * H, dir: Math.random() < 0.5 ? 1 : -1, delay: rand(0, 900), dur: rand(2600, 4200), bob: rand(14, 30), size: rand(20, 30) }).current;
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: cfg.dur, delay: cfg.delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([Animated.timing(flap, { toValue: 1, duration: 260, useNativeDriver: true }), Animated.timing(flap, { toValue: 0, duration: 260, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, []);
  const tx = p.interpolate({ inputRange: [0, 1], outputRange: cfg.dir > 0 ? [-60, W + 60] : [W + 60, -60] });
  const ty = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -cfg.bob, 0] });
  const wing = flap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: cfg.y, opacity: p.interpolate({ inputRange: [0, 0.06, 0.94, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateX: tx }, { translateY: ty }, { scaleX: cfg.dir }], flexDirection: 'row' }}>
      <Animated.Text style={{ fontSize: cfg.size, transform: [{ scaleY: wing }] }}>🪽</Animated.Text>
      <Animated.Text style={{ fontSize: cfg.size, transform: [{ scaleY: wing }, { scaleX: -1 }] }}>🪽</Animated.Text>
    </Animated.View>
  );
}

function Particles({ effect, color, emoji, W, H }: { effect: NoteEffectKind; color?: string; emoji?: string; W: number; H: number }) {
  switch (effect) {
    case 'confetti': return <>{range(42).map((i) => <Confetto key={i} W={W} H={H} color={color && i % 4 === 0 ? color : COLORS[i % COLORS.length]} />)}</>;
    case 'ribbons': return <>{range(28).map((i) => <Ribbon key={i} W={W} H={H} color={COLORS[i % COLORS.length]} />)}</>;
    case 'hearts': return <>{range(16).map((i) => <Riser key={i} W={W} H={H} glyph="❤️" size={[16, 30]} drift={34} dur={[1800, 2900]} />)}</>;
    case 'balloons': return <>{range(12).map((i) => <Riser key={i} W={W} H={H} glyph={['🎈', '🎈', '🎈'][i % 3]} size={[26, 40]} drift={20} dur={[2600, 4200]} />)}</>;
    case 'bubbles': return <>{range(18).map((i) => <Riser key={i} W={W} H={H} glyph="🫧" size={[16, 30]} drift={26} dur={[2200, 3600]} />)}</>;
    case 'snow': return <>{range(26).map((i) => <Faller key={i} W={W} H={H} glyph="❄️" size={[12, 22]} sway={30} dur={[2600, 4200]} />)}</>;
    case 'petals': return <>{range(22).map((i) => <Faller key={i} W={W} H={H} glyph="🌸" size={[14, 24]} sway={40} dur={[2400, 3800]} spin />)}</>;
    case 'emojiRain': return <>{range(24).map((i) => <Faller key={i} W={W} H={H} glyph={emoji || '🎉'} size={[18, 30]} sway={26} dur={[1800, 3000]} />)}</>;
    case 'sparkles': return <>{range(22).map((i) => <Glint key={i} W={W} H={H} size={[12, 24]} />)}</>;
    case 'glitter': return <>{range(40).map((i) => <Glint key={i} W={W} H={H} size={[7, 14]} />)}</>;
    case 'stars': return <>{range(6).map((i) => <ShootingStar key={i} W={W} H={H} />)}</>;
    case 'fireworks': return <>{range(3).map((i) => <Firework key={i} W={W} H={H} color={color} />)}</>;
    case 'wings': return <>{range(5).map((i) => <Flyer key={i} W={W} H={H} />)}</>;
    default: return null;
  }
}

export function NoteEffect({ effect, color, emoji, playKey }: { effect?: NoteEffectKind | string; color?: string; emoji?: string; playKey: number }) {
  const { motion } = useSettings();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  if (!motion || !effect || effect === 'none') return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
      onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (width && height) setSize({ w: width, h: height }); }}>
      {size ? <Particles key={playKey} effect={effect as NoteEffectKind} color={color} emoji={emoji} W={size.w} H={size.h} /> : null}
    </View>
  );
}

// ---------------- looping background layer ----------------
// One glyph that drifts across, then RESPAWNS with a fresh random config (speed,
// position, peak opacity, idle gap) forever — so the background field never
// settles and its intensity wanders randomly over time.
const ambientCfg = (W: number, H: number) => ({ x: rand(0.03, 0.97) * W, dur: rand(7000, 15000), gap: rand(0, 2800), sway: rand(14, 46), size: rand(13, 28), peak: rand(0.13, 0.42) });
function Drifter({ W, H, glyph, falling, seed }: { W: number; H: number; glyph: string; falling: boolean; seed: number }) {
  const p = useRef(new Animated.Value(0)).current;
  const [cfg, setCfg] = useState(() => ({ ...ambientCfg(W, H), gap: (seed * 500) % 3000 }));
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const run = () => {
      if (!alive.current) return;
      const nc = ambientCfg(W, H);
      setCfg(nc);
      p.setValue(0);
      Animated.timing(p, { toValue: 1, duration: nc.dur, delay: nc.gap, easing: Easing.linear, useNativeDriver: true })
        .start(({ finished }) => { if (finished && alive.current) run(); });
    };
    run();
    return () => { alive.current = false; p.stopAnimation(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H]);
  const ty = falling
    ? p.interpolate({ inputRange: [0, 1], outputRange: [-40, H + 40] })
    : p.interpolate({ inputRange: [0, 1], outputRange: [H + 40, -40] });
  return <Animated.Text style={{ position: 'absolute', left: cfg.x, top: 0, fontSize: cfg.size, opacity: p.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, cfg.peak, cfg.peak, 0] }), transform: [{ translateY: ty }, { translateX: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, cfg.sway, -cfg.sway] }) }] }}>{glyph}</Animated.Text>;
}

// Subtle, continuous drift of the effect's glyph behind the note (like the sky).
export function NoteAmbient({ effect, emoji }: { effect?: NoteEffectKind | string; emoji?: string }) {
  const { motion } = useSettings();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  if (!motion || !effect || effect === 'none') return null;
  const glyph = effect === 'emojiRain' ? (emoji || GLYPH.emojiRain) : (GLYPH[effect as string] || '✨');
  const falling = FALLING.has(effect as string);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
      onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (width && height) setSize({ w: width, h: height }); }}>
      {size ? range(10).map((i) => <Drifter key={i} W={size.w} H={size.h} glyph={glyph} falling={falling} seed={i} />) : null}
    </View>
  );
}
