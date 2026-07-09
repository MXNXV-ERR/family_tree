// Reusable bottom-sheet host (Modal + scrim + slide-up glass container). Powers
// the mobile Settings / Family / People panels. The design's <Sheet/>.
import { useEffect, useRef, type ReactNode } from 'react';
import { Modal, Pressable, Animated, StyleSheet, useWindowDimensions, View, PanResponder } from 'react-native';
import { useTheme } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';

export function BottomSheet({ visible, onClose, heightRatio = 0.8, children }: {
  visible: boolean; onClose: () => void; heightRatio?: number; children: ReactNode;
}) {
  const { c } = useTheme();
  const { height: winH } = useWindowDimensions();
  const slide = useRef(new Animated.Value(0)).current;
  // Finger-follow offset while dragging the grab handle (swipe-down to dismiss).
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) dragY.setValue(0); // fresh open starts undragged
    Animated.timing(slide, { toValue: visible ? 1 : 0, duration: 320, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Cap below the window height so the sheet never kisses the very top edge
  // (winH is the VISIBLE viewport — useWindowDimensions tracks innerHeight on web).
  const sheetH = Math.min(Math.round(winH * heightRatio), winH - 48);
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [sheetH, 0] });

  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
    onPanResponderMove: (_e, g) => dragY.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 80 || g.vy > 0.8) onCloseRef.current();
      else Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start(),
  })).current;

  // Opaque themed base under the translucent glass so panel text stays legible
  // over the busy home content when glass surfaces are enabled.
  const base = c.mode === 'dark' ? '#13131d' : '#fbf8f1';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim ?? 'rgba(0,0,0,0.5)' }]} onPress={onClose} />
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: sheetH, transform: [{ translateY: Animated.add(translateY, dragY) }] }}>
        <View style={{ flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', backgroundColor: base }}>
          <GlassSurface rounded={0} intensity={70} style={{ flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', borderColor: c.glassBrd }}>
            {/* grab handle (design's bottom-sheet pill) — drag zone for swipe-dismiss */}
            <View {...pan.panHandlers} style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6, marginBottom: -6 }}>
              <View style={{ width: 38, height: 4, borderRadius: 99, backgroundColor: c.line }} />
            </View>
            {children}
          </GlassSurface>
        </View>
      </Animated.View>
    </Modal>
  );
}
