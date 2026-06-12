// Reusable pan + pinch-zoom canvas for the visualizations. Pan & pinch drive
// reanimated shared values; children render inside a transformed View. A tap on
// empty canvas calls onTapEmpty (used to dismiss the timeline/radial tooltip).
import { type ReactNode, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';

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
      scale.value = withTiming(s);
      tx.value = withTiming(x);
      ty.value = withTiming(y);
    },
    zoomBy(factor: number) {
      scale.value = withTiming(Math.max(minScale, Math.min(maxScale, scale.value * factor)));
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

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // Content is centred in the canvas; RN scales transforms around the view's
  // centre, so centring makes pinch-zoom anchor on the middle of the diagram.
  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.canvas, style]}>
        <Animated.View style={animStyle}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  canvas: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
