// Jump-to-person search overlay (modal). Used by the mobile visualizer and the
// combined (master) view; the combined view passes colorOf/familyNameOf so each
// result carries its source-family dot and namesakes across families stay
// tellable. Picking a result is the caller's affair (focus, open profile, …).
import { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, StyleSheet, Platform } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/primitives';
import { lifespan } from '../shared/adjacency';
import type { Member } from '../shared/types';

export function SearchOverlay({ visible, members, colorOf, familyNameOf, onPick, onClose }: {
  visible: boolean; members: Member[];
  colorOf?: (id: string) => string | undefined;
  familyNameOf?: (id: string) => string | undefined;
  onPick: (m: Member) => void; onClose: () => void;
}) {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  useEffect(() => { if (!visible) setQuery(''); }, [visible]);
  const q = query.trim().toLowerCase();
  const matches = q ? members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 12) : [];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,6,0.5)' }]} />
      <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center', paddingTop: 90, paddingHorizontal: 16 }}>
        <View style={{ width: '100%', maxWidth: 520, borderRadius: radius.lg, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 52, borderBottomWidth: 1, borderColor: c.lineSoft }}>
            <Icon name="search" size={18} color={c.mute} />
            <TextInput
              value={query} onChangeText={setQuery} autoFocus placeholder="Find a person…" placeholderTextColor={c.mute}
              style={{ flex: 1, color: c.ink, fontFamily: font.sansMed, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
            <Pressable onPress={onClose} hitSlop={8}><Icon name="close" size={18} color={c.mute} /></Pressable>
          </View>
          {q ? (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }} contentContainerStyle={{ padding: 6 }}>
              {matches.length === 0 ? (
                <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 13.5, padding: 12 }}>No one matches “{query.trim()}”.</Text>
              ) : matches.map((m) => (
                <Pressable key={m.id} onPress={() => onPick(m)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: radius.sm, backgroundColor: pressed ? c.accentSoft : 'transparent' })}>
                  <Avatar m={m} size={34} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 13.5 }}>{m.name}</Text>
                    <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.mono, fontSize: 10.5 }}>{lifespan(m)}</Text>
                  </View>
                  {colorOf || familyNameOf ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colorOf?.(m.id) ?? c.faint }} />
                      <Text numberOfLines={1} style={{ color: c.inkSoft, fontFamily: font.sansMed, fontSize: 11.5, maxWidth: 120 }}>{familyNameOf?.(m.id) ?? ''}</Text>
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 13.5, padding: 14 }}>Type a name to jump to them.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
