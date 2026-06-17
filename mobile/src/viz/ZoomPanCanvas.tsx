// Reusable pan + pinch-zoom canvas for the visualizations. Pan & pinch drive
// reanimated shared values; children render inside a transformed View. A tap on
// empty canvas calls onTapEmpty (used to dismiss the timeline/radial tooltip).
import { type ReactNode, useImperativeHandle, forwardRef, useRef, useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing } from 'react-native-reanimated';

// Eased pan/zoom — replaces the default linear 300ms so recenter & zoom glide.
const EASE = { duration: 420, easing: Easing.out(Easing.cubic) };

export interface CanvasHandle {
  reset: (scale?: number, tx?: number, ty?: number) => void;
  zoomBy: (factor: number) => void;
}

export const ZoomPanCanvas = forwardRef<CanvasHandle, {
  children: ReactNode;
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  onTapEmpty?: () => void;
  style?: any;
}>(function ZoomPanCanvas({ children, minScale = 0.2, maxScale = 3, initialScale = 1, onTapEmpty, style }, ref) {
  const scale = useSharedValue(initialScale);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    reset(s = initialScale, x = 0, y = 0) {
      scale.value = withTiming(s, EASE);
      tx.value = withTiming(x, EASE);
      ty.value = withTiming(y, EASE);
    },
    zoomBy(factor: number) {
      scale.value = withTiming(Math.max(minScale, Math.min(maxScale, scale.value * factor)), EASE);
    },
  }));

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => { startX.value = tx.value; startY.value = ty.value; })
    .onUpdate((e) => { tx.value = startX.value + e.translationX; ty.value = startY.value + e.translationY; });

  const pinch = Gesture.Pinch()
    .onStart(() => { startScale.value = scale.value; })
    .onUpdate((e) => { scale.value = Math.max(minScale, Math.min(maxScale, startScale.value * e.scale)); });

  const tap = Gesture.Tap().maxDuration(250).onEnd(() => { if (onTapEmpty) runOnJS(onTapEmpty)(); });

  const gesture = Gesture.Simultaneous(pan, pinch, tap);

  // Desktop: scroll-wheel zoom (center-anchored, like the zoom buttons). RNW
  // doesn't surface onWheel as a prop, so attach a passive:false DOM listener.
  const hostRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = hostRef.current as unknown as HTMLElement | null;
    if (!el || !el.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      scale.value = Math.max(minScale, Math.min(maxScale, scale.value * factor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [minScale, maxScale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // Content is centred in the canvas; RN scales transforms around the view's
  // centre, so centring makes pinch-zoom anchor on the middle of the diagram.
  return (
    <GestureDetector gesture={gesture}>
      <View ref={hostRef} style={[styles.canvas, style]}>
        <Animated.View style={animStyle}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  canvas: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
