// Reusable bottom-sheet host (Modal + scrim + slide-up glass container). Powers
// the mobile Settings / Family / People panels. The design's <Sheet/>.
import { useEffect, useRef, type ReactNode } from 'react';
import { Modal, Pressable, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';

export function BottomSheet({ visible, onClose, heightRatio = 0.8, children }: {
  visible: boolean; onClose: () => void; heightRatio?: number; children: ReactNode;
}) {
  const { c } = useTheme();
  const { height: winH } = useWindowDimensions();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: visible ? 1 : 0, duration: 320, useNativeDriver: true }).start();
  }, [visible]);

  const sheetH = Math.round(winH * heightRatio);
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [sheetH, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim ?? 'rgba(0,0,0,0.5)' }]} onPress={onClose} />
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: sheetH, transform: [{ translateY }] }}>
        <GlassSurface rounded={0} intensity={70} style={{ flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', borderColor: c.glassBrd }}>
          {children}
        </GlassSurface>
      </Animated.View>
    </Modal>
  );
}
