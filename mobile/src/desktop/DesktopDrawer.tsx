// Right-side detail drawer for the desktop workspace (the design's DeskDrawer).
// Scrim + a sliding glass panel. Mounts while animating out, then unmounts.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';

export function DesktopDrawer({ open, onClose, width = 460, children }: {
  open: boolean; onClose: () => void; width?: number; children: ReactNode;
}) {
  const { c } = useTheme();
  const [mounted, setMounted] = useState(open);
  const a = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(a, { toValue: open ? 1 : 0, duration: 300, useNativeDriver: true }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open]);

  if (!mounted) return null;
  const translateX = a.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: a }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width, transform: [{ translateX }] }}>
        <GlassSurface rounded={0} intensity={70} style={{ flex: 1, borderLeftWidth: 1, borderColor: c.glassBrd, overflow: 'hidden' }}>
          {children}
        </GlassSurface>
      </Animated.View>
    </View>
  );
}
