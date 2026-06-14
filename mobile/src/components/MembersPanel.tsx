// Member directory panel — the family's people, searchable. Opened from the
// desktop workspace "people" button (which previously only showed collaborators,
// not the family members). Tap a row to open that member's profile.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Platform } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { Avatar } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { SheetHead } from './panelChrome';
import { lifespan } from '../shared/adjacency';
import type { Member } from '../shared/types';

export function MembersPanel({ members, meId, onOpenProfile, onOpenFamilyInfo, onClose }: {
  members: Member[];
  meId?: string;
  onOpenProfile: (m: Member) => void;
  onOpenFamilyInfo?: () => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, query]);

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="users" title="Members" sub={`${members.length} ${members.length === 1 ? 'person' : 'people'}`} onClose={onClose} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 46, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: radius.md }}>
          <Icon name="search" size={18} color={c.mute} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search members…" placeholderTextColor={c.mute}
            style={{ flex: 1, color: c.ink, fontFamily: font.sansMed, fontSize: 14.5, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Icon name="close" size={16} color={c.mute} /></Pressable> : null}
        </View>
        {onOpenFamilyInfo ? (
          <Pressable onPress={onOpenFamilyInfo} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, opacity: pressed ? 0.6 : 1 })}>
            <Icon name="info" size={15} color={c.accent} />
            <Text style={{ color: c.accent, fontFamily: font.sansSemi, fontSize: 13 }}>Family info & access</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 8 }}>
        {shown.map((m) => (
          <Pressable key={m.id} onPress={() => onOpenProfile(m)} style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, borderRadius: radius.md,
            backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, transform: [{ scale: pressed ? 0.98 : 1 }],
          })}>
            <Avatar m={m} size={42} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 14.5 }}>{m.name}</Text>
                {meId === m.id ? (
                  <View style={{ backgroundColor: c.accent, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 }}>
                    <Text style={{ color: c.accentInk, fontFamily: font.sansHeavy, fontSize: 8.5 }}>YOU</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.mono, fontSize: 11, marginTop: 2 }}>
                {[lifespan(m), m.occupation].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Icon name="chevR" size={17} color={c.faint} />
          </Pressable>
        ))}
        {shown.length === 0 ? (
          <GlassSurface><Text style={{ color: c.mute, fontFamily: font.sansMed, textAlign: 'center', padding: 24 }}>{query.trim() ? 'No matches found.' : 'No members yet.'}</Text></GlassSurface>
        ) : null}
      </ScrollView>
    </View>
  );
}
