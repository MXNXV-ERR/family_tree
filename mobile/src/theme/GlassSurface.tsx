// Reusable translucent "liquid glass" surface (requirement #9: glass everywhere).
// Wraps expo-blur BlurView with a themed border + tint. On web it uses a real
// backdrop-filter (blur + saturate) to match the design's `.glass`. Falls back
// to a solid paper surface when the user turns glass off in Settings.
import { Platform, View, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme, radius } from './theme';
import { useSettings } from './SettingsContext';
import type { ReactNode } from 'react';

export function GlassSurface({
  children,
  style,
  intensity = 50,
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
  const { glass } = useSettings();
  const border: ViewStyle = bordered ? { borderWidth: 1, borderColor: c.glassBrd } : {};

  // Glass disabled → solid card so the UI stays legible without translucency.
  if (!glass) {
    return (
      <View style={[{ backgroundColor: c.paper, borderRadius: rounded, overflow: 'hidden' }, bordered ? { borderWidth: 1, borderColor: c.line } : {}, style]}>
        {children}
      </View>
    );
  }

  // BlurView is unreliable on react-native-web; use a real backdrop-filter there.
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          {
            backgroundColor: c.glassBg,
            borderRadius: rounded,
            overflow: 'hidden',
            // matches `.glass { backdrop-filter: blur(20px) saturate(160%) }`
            backdropFilter: 'blur(20px) saturate(160%)',
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
