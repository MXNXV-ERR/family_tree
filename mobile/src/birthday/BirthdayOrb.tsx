// The orb (SPEC §4 "Giving" step 1). Floats over the bottom nav for the whole
// fourteen-day window: 62px glass, gold border, a 3.6s bob, two breathing rings
// offset 1.8s, a gold shimmer sweep every 7s and a sparkle every 8s.
//
// Payload depends on who is looking. The celebrant sees who wrote (one sender →
// her avatar, several → stacked); everyone else sees the celebrant they're about
// to write to.
//
// Badge: at ≤2 senders it is a gold pill of TICKS, one per wish (max five then
// "+") — never a number beside a single face, which reads as a count of people.
// At ≥3 senders it becomes the numeric violet badge.
//
// Before the day, the celebrant's OWN orb goes calm and grey with a day
// countdown: no breathing, no sparkle, no badge — it must not leak a count.
import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, Platform } from 'react-native';
import { useTheme, font } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { Avatar } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import type { Member } from '../shared/types';

export function BirthdayOrb({
  faces, wishCount, senderCount, daysUntil, calm, onPress, bottom = 104,
}: {
  /** Who to show inside the orb — senders (celebrant's view) or the celebrant. */
  faces: Member[];
  wishCount: number;
  senderCount: number;
  /** Days until the birthday; 0 on the day. */
  daysUntil: number;
  /** The celebrant's own pre-day orb: grey, still, countdown, no badge. */
  calm?: boolean;
  onPress: () => void;
  bottom?: number;
}) {
  const { c } = useTheme();
  const { motion } = useSettings();

  const bob = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const shim = useRef(new Animated.Value(0)).current;
  const spark = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!motion || calm) return;
    const breathe = (v: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 3600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      breathe(ring1, 0),
      breathe(ring2, 1800),
      Animated.loop(Animated.sequence([
        Animated.timing(shim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(5600),
        Animated.timing(shim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.delay(8000),
        Animated.timing(spark, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(spark, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [motion, calm]);

  const ringStyle = (v: Animated.Value) => ({
    position: 'absolute' as const, left: -6, top: -6, right: -6, bottom: -6,
    borderRadius: 40, borderWidth: 1.5, borderColor: c.gold,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.5] }) }],
  });

  const ticks = Math.min(wishCount, 5);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute', right: 20, bottom,
        transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }],
      }}>
      {!calm ? (
        <>
          <Animated.View pointerEvents="none" style={ringStyle(ring1)} />
          <Animated.View pointerEvents="none" style={ringStyle(ring2)} />
        </>
      ) : null}

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={calm ? `${daysUntil} days to your birthday` : 'Open birthday wishes'}
        style={({ pressed }) => ({
          width: 62, height: 62, borderRadius: 31,
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          backgroundColor: calm ? 'rgba(30,24,48,0.6)' : 'rgba(30,24,48,0.72)',
          borderWidth: 1.5, borderColor: calm ? 'rgba(190,170,255,0.28)' : c.gold,
          transform: [{ scale: pressed ? 0.94 : 1 }],
          ...(calm ? null : { shadowColor: c.gold, shadowOpacity: 0.4, shadowRadius: 26, shadowOffset: { width: 0, height: 10 }, elevation: 10 }),
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(18px) saturate(160%)' } as any : null),
        })}>
        {calm ? (
          // no count, no name — just how long until the day
          <Text style={{ color: c.mute, fontFamily: font.serif, fontSize: 20 }}>{daysUntil}d</Text>
        ) : faces.length === 0 ? (
          <Icon name="cake" size={26} color={c.gold} />
        ) : faces.length === 1 ? (
          <Avatar m={faces[0]} size={38} ring={c.gold} />
        ) : (
          <View style={{ flexDirection: 'row' }}>
            {faces.slice(0, 3).map((m, i) => (
              <View key={m.id} style={{ marginLeft: i ? -9 : 0 }}>
                <Avatar m={m} size={30} ring={c.gold} />
              </View>
            ))}
          </View>
        )}

        {/* gold shimmer sweep */}
        {!calm && motion ? (
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: -20, bottom: -20, width: 26,
            backgroundColor: 'rgba(255,206,107,0.5)',
            opacity: shim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.75, 0.75, 0] }),
            transform: [
              { translateX: shim.interpolate({ inputRange: [0, 1], outputRange: [-34, 70] }) },
              { rotate: '18deg' },
            ],
          }} />
        ) : null}
      </Pressable>

      {/* sparkle */}
      {!calm && motion ? (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', left: -4, top: -2,
          opacity: spark,
          transform: [{ scale: spark.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
        }}>
          <Icon name="sparkles" size={16} color={c.gold} />
        </Animated.View>
      ) : null}

      {/* badge — ticks while names still fit, a number once they don't */}
      {!calm && wishCount > 0 ? (
        senderCount <= 2 ? (
          <View pointerEvents="none" style={{
            position: 'absolute', top: -6, right: -4,
            flexDirection: 'row', alignItems: 'center', gap: 3,
            paddingHorizontal: 6, height: 16, borderRadius: 8,
            backgroundColor: c.gold,
          }}>
            {Array.from({ length: ticks }).map((_, i) => (
              <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.goldInk }} />
            ))}
            {wishCount > 5 ? <Text style={{ color: c.goldInk, fontFamily: font.sansHeavy, fontSize: 9 }}>+</Text> : null}
          </View>
        ) : (
          <View pointerEvents="none" style={{
            position: 'absolute', top: -6, right: -4,
            minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
            alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent,
          }}>
            <Text style={{ color: c.accentInk, fontFamily: font.sansHeavy, fontSize: 10 }}>{wishCount > 99 ? '99+' : wishCount}</Text>
          </View>
        )
      ) : null}
    </Animated.View>
  );
}
