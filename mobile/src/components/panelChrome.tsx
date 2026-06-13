// Shared chrome for slide-in panels (mobile bottom-sheets + desktop right
// drawer): a titled header with an icon badge + close button, and the spring
// Toggle switch. Ported from the design's SheetHead / Toggle.
import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { Icon, type IconName } from '../ui/Icon';

export function SheetHead({ icon, title, sub, onClose }: {
  icon: IconName; title: string; sub?: string; onClose: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={21} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontFamily: font.sansBold, fontSize: 16.5 }}>{title}</Text>
        {sub ? <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12.5 }}>{sub}</Text> : null}
      </View>
      <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] })}>
        <Icon name="close" size={18} color={c.inkSoft} />
      </Pressable>
    </View>
  );
}

export function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: on ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [on]);
  const left = v.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });
  const bg = v.interpolate({ inputRange: [0, 1], outputRange: [c.line, c.accent] });
  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[styles.track, { backgroundColor: bg }]}>
        <Animated.View style={[styles.knob, { left }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 48, height: 28, borderRadius: radius.pill, justifyContent: 'center' },
  knob: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2.5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
});
