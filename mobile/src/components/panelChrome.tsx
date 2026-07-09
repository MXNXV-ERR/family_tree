// Shared chrome for slide-in panels (mobile bottom-sheets + desktop right
// drawer): a titled header with an icon badge + close button, the spring
// Toggle switch, and PanelScroll (bounded ScrollView + scroll-edge fades).
// Ported from the design's SheetHead / Toggle.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, Animated, StyleSheet, ScrollView, type NativeSyntheticEvent, type NativeScrollEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
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

function EdgeFade({ position, color }: { position: 'top' | 'bottom'; color: string }) {
  const H = 26;
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, height: H }, position === 'top' ? { top: 0 } : { bottom: 0 }]}>
      <Svg width="100%" height={H}>
        <Defs>
          <LinearGradient id={`pf-${position}`} x1="0" y1={position === 'top' ? '0' : '1'} x2="0" y2={position === 'top' ? '1' : '0'}>
            <Stop offset="0" stopColor={color} stopOpacity={0.9} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={H} fill={`url(#pf-${position})`} />
      </Svg>
    </View>
  );
}

// Panel body scroller: bounded (flex:1) so long content actually scrolls inside
// drawers/sheets instead of clipping, with soft edge fades hinting there's more
// to scroll in that direction.
export function PanelScroll({ children, contentStyle }: { children: ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [offY, setOffY] = useState(0);
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setOffY(e.nativeEvent.contentOffset.y);
  const base = c.mode === 'dark' ? '#13131d' : '#fbf8f1'; // matches the sheet/drawer opaque base
  const showTop = offY > 4;
  const showBottom = contentH - viewH - offY > 4;
  return (
    // minHeight:0 — RNW flex items default to min-height:auto, so a flex:1
    // ScrollView nested in a bounded drawer can expand to content height and
    // get clipped instead of scrolling (Save buttons off the bottom).
    <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={[{ paddingBottom: 28 }, contentStyle]}
        onScroll={onScroll} scrollEventThrottle={32}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContentH(h)}>
        {children}
      </ScrollView>
      {showTop ? <EdgeFade position="top" color={base} /> : null}
      {showBottom ? <EdgeFade position="bottom" color={base} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: 48, height: 28, borderRadius: radius.pill, justifyContent: 'center' },
  knob: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2.5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
});
