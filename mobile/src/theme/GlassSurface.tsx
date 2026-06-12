// Reusable translucent "liquid glass" surface (requirement #9: glass everywhere).
// Wraps expo-blur BlurView with a themed border + tint. Falls back to a
// semi-opaque View on web where BlurView support is limited.
import { Platform, View, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme, radius } from './theme';
import type { ReactNode } from 'react';

export function GlassSurface({
  children,
  style,
  intensity = 40,
  rounded = radius.lg,
  bordered = true,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  rounded?: number;
  bordered?: boolean;
}) {
  const { c } = useTheme();
  const border: ViewStyle = bordered
    ? { borderWidth: 1, borderColor: c.line }
    : {};

  // BlurView is unreliable on react-native-web; use a translucent View there.
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          {
            backgroundColor: c.glassBg,
            borderRadius: rounded,
            overflow: 'hidden',
            backdropFilter: 'blur(18px)',
          },
          border,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={c.glassTint === 'dark' ? 'dark' : 'light'}
      style={[{ borderRadius: rounded, overflow: 'hidden' }, border, style]}
    >
      {children}
    </BlurView>
  );
}
