// Settings panel — the design's Settings sheet. Theme Dark/Light cards, the
// Display toggles (birth years, glass surfaces, motion) wired to SettingsContext,
// and sign out. Shared by the mobile settings sheet and the desktop drawer.
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTheme, font, radius } from '../theme/theme';
import { useSettings, type Settings, type TextSize } from '../theme/SettingsContext';
import { useAuth } from '../firebase/AuthContext';
import { GlassSurface } from '../theme/GlassSurface';
import { Icon, type IconName } from '../ui/Icon';
import { SheetHead, Toggle } from './panelChrome';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { c, mode, setMode } = useTheme();
  const s = useSettings();
  const { signOut } = useAuth();

  const themeCards: [typeof mode, IconName, string][] = [['dark', 'moon', 'Dark'], ['light', 'sun', 'Light']];
  type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
  const rows: [BoolKey, string, IconName][] = [
    ['years', 'Show birth years', 'cake'],
    ['glass', 'Glass surfaces', 'grid'],
    ['motion', 'Motion & animation', 'sparkles'],
  ];

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="settings" title="Settings" sub="Appearance & display" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 18 }}>
        {/* Theme */}
        <View>
          <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.7, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2 }}>Theme</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {themeCards.map(([k, ic, lb]) => {
              const on = mode === k;
              return (
                <Pressable key={k} onPress={() => setMode(k)} style={({ pressed }) => ({
                  flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: radius.lg,
                  backgroundColor: on ? c.accentSoft : c.paper, borderWidth: 1.5, borderColor: on ? c.accent : c.line,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}>
                  <Icon name={ic} size={24} color={on ? c.accent : c.inkSoft} />
                  <Text style={{ color: on ? c.accent : c.inkSoft, fontFamily: font.sansBold, fontSize: 14 }}>{lb}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Text size */}
        <View>
          <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.7, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2 }}>Text size</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['sm', 'md', 'lg', 'xl'] as TextSize[]).map((k, i) => {
              const on = s.textSize === k;
              const lbl = ['S', 'M', 'L', 'XL'][i];
              const fs = [13, 15, 17, 20][i];
              return (
                <Pressable key={k} onPress={() => s.setOption('textSize', k)} style={({ pressed }) => ({
                  flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md,
                  backgroundColor: on ? c.accentSoft : c.paper, borderWidth: 1.5, borderColor: on ? c.accent : c.line,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}>
                  <Text style={{ color: on ? c.accent : c.inkSoft, fontFamily: font.sansBold, fontSize: fs }}>{lbl}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Display */}
        <View>
          <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.7, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2 }}>Display</Text>
          <GlassSurface rounded={radius.lg}>
            <View style={{ paddingHorizontal: 16 }}>
              {rows.map(([k, lb, ic], i) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderColor: c.lineSoft }}>
                  <Icon name={ic} size={18} color={c.mute} />
                  <Text style={{ flex: 1, color: c.ink, fontFamily: font.sansMed, fontSize: 14.5 }}>{lb}</Text>
                  <Toggle on={s[k]} onPress={() => s.setOption(k, !s[k])} />
                </View>
              ))}
            </View>
          </GlassSurface>
        </View>

        <Pressable onPress={signOut} style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 15,
          borderRadius: radius.md, borderWidth: 1, borderColor: c.line, transform: [{ scale: pressed ? 0.98 : 1 }],
        })}>
          <Icon name="logout" size={18} color={c.inkSoft} />
          <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 14.5 }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
