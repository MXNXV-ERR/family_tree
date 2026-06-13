// Minimal horizontal slider (no extra deps) — RN core dropped its Slider, and
// the canvases already use gesture-handler so a plain PanResponder track keeps
// things simple and conflict-free. Matches the design's `.ft-range` look.
import { useRef } from 'react';
import { View, PanResponder, type LayoutChangeEvent } from 'react-native';
import { useTheme, radius } from '../theme/theme';

export function Slider({ value, min, max, step = 1, onChange, width = 120 }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; width?: number;
}) {
  const { c } = useTheme();
  const w = useRef(width);
  const cfg = useRef({ min, max, step, onChange });
  cfg.current = { min, max, step, onChange };

  const set = (x: number) => {
    const { min, max, step, onChange } = cfg.current;
    const t = Math.max(0, Math.min(1, x / Math.max(1, w.current)));
    const raw = min + t * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, snapped)));
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
    onPanResponderMove: (e) => set(e.nativeEvent.locationX),
  })).current;

  const pct = max > min ? (value - min) / (max - min) : 0;
  const THUMB = 15;
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => { w.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
      style={{ width, height: 26, justifyContent: 'center' }}
    >
      <View style={{ height: 4, borderRadius: radius.pill, backgroundColor: c.line }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, borderRadius: radius.pill, backgroundColor: c.accent }} />
      </View>
      <View style={{ position: 'absolute', left: pct * (width - THUMB), width: THUMB, height: THUMB, borderRadius: THUMB, backgroundColor: c.accent, borderWidth: 2, borderColor: c.bg }} />
    </View>
  );
}
