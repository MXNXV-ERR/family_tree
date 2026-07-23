// Event icon rendering + picker. An event's icon is either a built-in line icon
// (iconKind 'glyph') or an emoji (iconKind 'emoji'). This is the one deliberate
// exception to the house rule "no emoji in UI" (ui/Icon.tsx) — the user asked to
// set emoji as event icons.
import { View, Text, Pressable, TextInput, Platform } from 'react-native';
import { useTheme, radius } from '../theme/theme';
import { Icon, type IconName } from '../ui/Icon';

// Render an event's chosen icon at a given size/colour.
export function EventGlyph({ icon, iconKind, size = 16, color, stroke = 2 }: {
  icon?: string; iconKind?: 'glyph' | 'emoji'; size?: number; color?: string; stroke?: number;
}) {
  if (iconKind === 'emoji' && icon) {
    return <Text style={{ fontSize: size, lineHeight: size + 3, textAlign: 'center' }}>{icon}</Text>;
  }
  // Icon returns null for an unknown name, so a stale value degrades gracefully.
  return <Icon name={(icon as IconName) || 'calendar'} size={size} stroke={stroke} color={color} />;
}

// Curated built-in icons that read well as event markers.
const GLYPHS: IconName[] = [
  'calendar', 'cake', 'ring', 'heart', 'flower', 'sparkles', 'home',
  'briefcase', 'globe', 'camera', 'pin', 'tree', 'quote', 'users',
];
const EMOJIS = ['🎂', '💍', '❤️', '🎉', '🎓', '🏠', '✈️', '🌸', '⭐', '👶', '💼', '🕯️', '🎈', '🍼'];

// Pick a built-in glyph or an emoji for an event. Controlled: value/onChange
// carry { icon, iconKind }.
export function EventIconPicker({ value, onChange }: {
  value: { icon?: string; iconKind?: 'glyph' | 'emoji' };
  onChange: (v: { icon?: string; iconKind?: 'glyph' | 'emoji' }) => void;
}) {
  const { c } = useTheme();
  const kind = value.iconKind ?? 'glyph';
  const selGlyph = kind === 'glyph' ? (value.icon ?? 'calendar') : null;
  const selEmoji = kind === 'emoji' ? (value.icon ?? '') : '';

  const cell = (on: boolean) => ({
    width: 40, height: 40, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const,
    borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.paper,
  });

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {GLYPHS.map((g) => {
          const on = selGlyph === g;
          return (
            <Pressable key={g} onPress={() => onChange({ icon: g, iconKind: 'glyph' })} style={cell(on)}>
              <Icon name={g} size={18} color={on ? c.accent : c.inkSoft} />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {EMOJIS.map((e) => {
          const on = selEmoji === e;
          return (
            <Pressable key={e} onPress={() => onChange({ icon: e, iconKind: 'emoji' })} style={cell(on)}>
              <Text style={{ fontSize: 20 }}>{e}</Text>
            </Pressable>
          );
        })}
      </View>
      {/* Type any emoji of your own (native: emoji keyboard · web: OS emoji picker). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={selEmoji}
          onChangeText={(t) => { const g = t.trim(); onChange(g ? { icon: g, iconKind: 'emoji' } : { icon: undefined, iconKind: undefined }); }}
          placeholder="Or type your own emoji…" placeholderTextColor={c.mute} maxLength={12}
          style={{ flex: 1, height: 44, paddingHorizontal: 12, fontSize: 18, borderRadius: radius.md, borderWidth: 1.5, borderColor: selEmoji ? c.accent : c.line, backgroundColor: c.paper, color: c.ink, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }}
        />
        {selEmoji ? (
          <View style={{ width: 44, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>{selEmoji}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
