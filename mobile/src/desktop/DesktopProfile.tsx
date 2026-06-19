// Compact member profile for the desktop right-drawer. Reuses the tree
// adjacency already loaded by the workspace. Header + quick actions + info +
// relations + story, in one scroll (the full tabbed profile lives at /profile
// for mobile).
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { useTheme, font, radius } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { GlassSurface } from '../theme/GlassSurface';
import { Avatar, IconBtn } from '../ui/primitives';
import { Icon, type IconName } from '../ui/Icon';
import { lifespan } from '../shared/adjacency';
import type { Adjacency } from '../shared/adjacency';
import type { LinkKind } from '../shared/relationshipActions';

export function DesktopProfile({ adj, id, meId, canEdit = true, canAddRelative = true, canClaim = false, canSync = false, onClose, onEdit, onOpen, onAddRelative, onDeleteRelative, onClaim, onSync, onFocusInTree }: {
  adj: Adjacency; id: string; meId?: string; canEdit?: boolean; canAddRelative?: boolean; canClaim?: boolean; canSync?: boolean; onClose: () => void;
  onEdit: (id: string) => void; onOpen: (id: string) => void;
  onAddRelative: (kind?: LinkKind) => void; onDeleteRelative?: (kind: LinkKind, relatedId: string) => void;
  onClaim?: () => void; onSync?: () => void; onFocusInTree: (id: string) => void;
}) {
  const { c } = useTheme();
  const { years } = useSettings();
  const m = adj.get(id);
  if (!m) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.mute }}>Member not found</Text></View>;

  const info: [IconName, string, string | undefined, (() => void)?][] = [
    ['phone', 'Phone', m.phone, m.phone ? () => Linking.openURL(`tel:${m.phone}`) : undefined],
    ['mail', 'Email', m.email, m.email ? () => Linking.openURL(`mailto:${m.email}`) : undefined],
    ['pin', 'Address', m.address],
    ['globe', 'Current location', m.location],
    ['cake', 'Born', m.birthDate],
    ['pin', 'Place of birth', m.placeOfBirth],
    ['user', 'Maiden name', m.maidenName],
    ['briefcase', 'Occupation', m.occupation],
  ];
  const rows = info.filter((r) => r[2]);
  const relGroups: [string, string[], LinkKind][] = [
    ['Parents', adj.parents(m.id), 'child'],
    ['Partners', [...adj.currentSpouses(m.id), ...adj.exSpouses(m.id)], 'spouse'],
    ['Children', adj.children(m.id), 'parent'],
    ['Siblings', adj.siblings(m.id), 'sibling'],
  ];
  const story: [string, string | undefined][] = [['Favourite quote', m.favoriteQuote], ['About', m.about], ['Childhood', m.childhoodStories]];

  return (
    <View style={{ flex: 1 }}>
      {/* header bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.lineSoft }}>
        <IconBtn name="back" tone="glass" size={38} onPress={onClose} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {canEdit ? <IconBtn name="edit" tone="glass" size={38} onPress={() => onEdit(m.id)} /> : null}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }}>
        <View style={{ alignItems: 'center' }}>
          <Avatar m={m} size={92} ring={c.accent} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <Text style={{ color: c.ink, fontFamily: font.serif, fontSize: 26 }}>{m.name}</Text>
            {m.id === meId ? <View style={{ backgroundColor: c.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}><Text style={{ color: c.accentInk, fontFamily: font.sansHeavy, fontSize: 9 }}>YOU</Text></View> : null}
          </View>
          {years ? <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 12.5, marginTop: 4 }}>{lifespan(m)}</Text> : null}
          {m.occupation ? <Text style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 14.5, marginTop: 4 }}>{m.occupation}</Text> : null}
        </View>

        {/* quick actions */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(([['tree', 'In tree', () => onFocusInTree(m.id)],
            ...(canAddRelative ? [['link', 'Add relative', () => onAddRelative()]] as [IconName, string, () => void][] : []),
            ...(canClaim && onClaim ? [['user', 'This is me', onClaim]] as [IconName, string, () => void][] : []),
            ...(canSync && onSync ? [['copy', 'Sync me', onSync]] as [IconName, string, () => void][] : []),
            ...(canEdit ? [['edit', 'Edit', () => onEdit(m.id)]] as [IconName, string, () => void][] : []),
          ]) as [IconName, string, () => void][]).map(([ic, lb, fn]) => (
            <Pressable key={lb} onPress={fn} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <Icon name={ic} size={19} color={c.inkSoft} />
              <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 11.5 }}>{lb}</Text>
            </Pressable>
          ))}
        </View>

        {/* info */}
        {rows.length ? (
          <GlassSurface rounded={radius.lg}>
            <View style={{ paddingHorizontal: 16 }}>
              {rows.map((r, i) => (
                <View key={r[1]} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderColor: c.lineSoft }}>
                  <Icon name={r[0]} size={18} color={c.mute} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>{r[1]}</Text>
                    <Text style={{ color: c.ink, fontFamily: font.sansMed, fontSize: 14.5, marginTop: 2 }}>{r[2]}</Text>
                  </View>
                  {r[3] ? <Pressable onPress={r[3]} style={{ borderWidth: 1, borderColor: c.accent, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}><Text style={{ color: c.accent, fontFamily: font.sansBold, fontSize: 12 }}>Open</Text></Pressable> : null}
                </View>
              ))}
            </View>
          </GlassSurface>
        ) : null}

        {/* relations */}
        {relGroups.map(([title, ids, kind]) => (
          <GlassSurface key={title} rounded={radius.lg}>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ids.length ? 12 : 0 }}>
                <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase' }}>{title} · {ids.length}</Text>
                {canAddRelative ? <Pressable onPress={() => onAddRelative(kind)}><Text style={{ color: c.accent, fontFamily: font.sansBold, fontSize: 12.5 }}>+ Add</Text></Pressable> : null}
              </View>
              {ids.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {ids.map((rid) => { const p = adj.get(rid); if (!p) return null; const ex = title === 'Partners' && adj.exSpouses(m.id).includes(rid);
                    return (
                      <Pressable key={rid} onPress={() => onOpen(rid)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5, paddingRight: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line }}>
                        <Avatar m={p} size={28} />
                        <Text style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 13.5 }}>{p.name}</Text>
                        {ex ? <Text style={{ color: c.relEx, fontSize: 11 }}>ex</Text> : null}
                        {canAddRelative && onDeleteRelative ? (
                          <Pressable onPress={() => onDeleteRelative(kind, rid)} hitSlop={8} style={{ marginLeft: 2 }}>
                            <Icon name="close" size={14} color={c.mute} />
                          </Pressable>
                        ) : null}
                      </Pressable>
                    ); })}
                </View>
              ) : <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 13 }}>None recorded.</Text>}
            </View>
          </GlassSurface>
        ))}

        {/* story */}
        {story.filter((b) => b[1]).map(([label, val]) => (
          <GlassSurface key={label} rounded={radius.lg}>
            <View style={{ padding: 16 }}>
              <Text style={{ color: c.accent, fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>{label}</Text>
              <Text style={{ color: c.inkSoft, fontFamily: label === 'Favourite quote' ? font.serifItalic : font.sans, fontSize: label === 'Favourite quote' ? 17 : 14.5, lineHeight: 23 }}>
                {label === 'Favourite quote' ? `“${val}”` : val}
              </Text>
            </View>
          </GlassSurface>
        ))}
      </ScrollView>
    </View>
  );
}
