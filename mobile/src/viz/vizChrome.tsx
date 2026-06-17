// Shared chrome for the visualizations: segmented view switcher (with proper
// tab spacing — req 11/12), floating zoom buttons, and a bottom focus bar that
// opens the selected member's profile. Restyled to the design bundle: line
// icons, Jakarta/mono type, accent-pill active segment.
import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { GlassSurface } from '../theme/GlassSurface';
import { Icon, type IconName } from '../ui/Icon';
import { Avatar, SegTabs } from '../ui/primitives';
import { lifespan } from '../shared/adjacency';
import type { Member } from '../shared/types';

export function VizSegment({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
      <SegTabs value={value} onChange={onChange} options={options} fontSize={12.5} />
    </View>
  );
}

export function ZoomButtons({ onIn, onOut, onFit }: { onIn: () => void; onOut: () => void; onFit: () => void }) {
  const { c } = useTheme();
  const btns: [IconName, () => void][] = [['plus', onIn], ['minus', onOut], ['target', onFit]];
  return (
    <View style={styles.zoom}>
      {btns.map(([name, fn], i) => (
        <Pressable key={i} onPress={fn} style={({ pressed }) => [styles.zoomBtn, { backgroundColor: c.paper, borderColor: c.line, transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
          <Icon name={name} size={18} color={c.inkSoft} />
        </Pressable>
      ))}
    </View>
  );
}

// Minimal imperative zoom handle a visualization exposes so a shared control
// (e.g. the desktop sub-bar) can drive whichever view is active.
export type ZoomApi = { in: () => void; out: () => void; fit: () => void };

// Inline −/+/fit cluster for the desktop sub-bar (drives the active view's api).
export function SubBarZoom({ api }: { api: ZoomApi | null }) {
  const { c } = useTheme();
  const btns: [IconName, () => void][] = [['minus', () => api?.out()], ['plus', () => api?.in()], ['target', () => api?.fit()]];
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {btns.map(([name, fn], i) => (
        <Pressable key={i} onPress={fn} disabled={!api} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, alignItems: 'center', justifyContent: 'center', opacity: api ? 1 : 0.5, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
          <Icon name={name} size={16} color={c.inkSoft} />
        </Pressable>
      ))}
    </View>
  );
}

export function FocusBar({ member, onOpen, onClose, extra }: {
  member: Member; onOpen: () => void; onClose: () => void; extra?: string;
}) {
  const { c } = useTheme();
  const { years, motion } = useSettings();
  // Slide up + fade in on mount (design: transform translateY(120%)→0).
  const v = useRef(new Animated.Value(motion ? 0 : 1)).current;
  useEffect(() => {
    if (!motion) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 350, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }).start();
  }, [member.id, motion]);
  return (
    <Animated.View style={[styles.focusWrap, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }) }] }]} pointerEvents="box-none">
      <GlassSurface rounded={radius.lg} style={{ overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }}>
          <Avatar m={member} size={38} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: c.ink, fontFamily: font.sansBold, fontSize: 14 }} numberOfLines={1}>{member.name}</Text>
            <Text style={{ color: extra ? c.teal : c.mute, fontFamily: extra ? font.sansSemi : font.mono, fontSize: 11.5 }} numberOfLines={1}>
              {extra ?? (years ? lifespan(member) : '')}
            </Text>
          </View>
          <Pressable onPress={onOpen} style={[styles.openBtn, { backgroundColor: c.accent }]}>
            <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 13 }}>Profile →</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10} style={{ paddingHorizontal: 6 }}>
            <Icon name="close" size={17} color={c.mute} />
          </Pressable>
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  zoom: { position: 'absolute', right: 12, top: 70, gap: 8 },
  zoomBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  focusWrap: { position: 'absolute', left: 12, right: 12, bottom: 16 },
  openBtn: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
});
