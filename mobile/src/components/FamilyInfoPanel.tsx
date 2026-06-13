// Family-info panel (the design's FamilyInfoPanel). Shows the active family's
// monogram, summary, stat cards, metadata (region/established/owner/invite) and
// the people who have access. Subscribes to the tree doc + membership docs.
// Shared by the mobile family sheet and the desktop drawer.
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTheme, font, radius } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { Avatar } from '../ui/primitives';
import { Icon, type IconName } from '../ui/Icon';
import { SheetHead } from './panelChrome';
import { subscribeFamilyDoc, subscribeCollaborators } from '../firebase/families';
import { computeGenerations } from '../shared/adjacency';
import type { FamilyTree, Collaborator, Member, Relationship } from '../shared/types';

export function FamilyInfoPanel({ treeId, family, members, relationships, onClose }: {
  treeId: string;
  family: FamilyTree | null;
  members: Member[];
  relationships: Relationship[];
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [doc, setDoc] = useState<FamilyTree | null>(family);
  const [collabs, setCollabs] = useState<Collaborator[]>([]);

  useEffect(() => {
    const u1 = subscribeFamilyDoc(treeId, (f) => f && setDoc(f));
    const u2 = subscribeCollaborators(treeId, setCollabs);
    return () => { u1(); u2(); };
  }, [treeId]);

  const fam = doc ?? family;
  const color = fam?.color ?? c.accent;
  const mono = fam?.mono ?? (fam?.name?.[0]?.toUpperCase() ?? 'F');

  const gens = useMemo(() => {
    if (!members.length) return 0;
    return Math.max(...computeGenerations(members, relationships).values()) + 1;
  }, [members, relationships]);
  const couples = Math.round(relationships.filter((r) => r.type === 'spouse').length / 2);
  const stats: [string, number][] = [['Members', members.length], ['Generations', gens], ['Couples', couples]];

  const ownerEmail = collabs.find((x) => x.role === 'owner')?.email || fam?.ownerUid || '—';
  const meta: [IconName, string, string | undefined][] = [
    ['pin', 'Region', fam?.region],
    ['cake', 'Established', fam?.established],
    ['user', 'Owner', ownerEmail],
    ['link', 'Invite code', fam?.inviteCode],
  ];

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="info" title="Family info" sub={fam?.name} onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16 }}>
        {/* identity */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper, borderWidth: 1.5, borderColor: color }}>
            <Text style={{ color, fontFamily: font.serif, fontSize: 28 }}>{mono}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: c.ink, fontFamily: font.serif, fontSize: 24 }}>{fam?.name ?? 'Family'}</Text>
            {fam?.kind ? (
              <View style={{ alignSelf: 'flex-start', marginTop: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.accentSoft }}>
                <Text style={{ color: c.accent, fontFamily: font.sansBold, fontSize: 11.5 }}>{fam.kind}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {fam?.summary ? <Text style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 14.5, lineHeight: 22 }}>{fam.summary}</Text> : null}

        {/* stats */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {stats.map(([lb, v]) => (
            <GlassSurface key={lb} rounded={radius.lg} style={{ flex: 1 }}>
              <View style={{ padding: 13 }}>
                <Text style={{ color: c.ink, fontFamily: font.serif, fontSize: 26, lineHeight: 28 }}>{v}</Text>
                <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 }}>{lb}</Text>
              </View>
            </GlassSurface>
          ))}
        </View>

        {/* metadata */}
        <GlassSurface rounded={radius.lg}>
          <View style={{ paddingHorizontal: 16 }}>
            {meta.filter((r) => r[2]).map((r, i, a) => (
              <View key={r[1]} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, borderBottomWidth: i < a.length - 1 ? 1 : 0, borderColor: c.lineSoft }}>
                <Icon name={r[0]} size={18} color={c.mute} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>{r[1]}</Text>
                  <Text style={{ color: r[1] === 'Invite code' ? c.accent : c.ink, fontFamily: r[1] === 'Invite code' ? font.monoSemi : font.sansMed, fontSize: 14.5, marginTop: 2 }}>{r[2]}</Text>
                </View>
              </View>
            ))}
          </View>
        </GlassSurface>

        {/* collaborators */}
        <View>
          <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.7, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2 }}>
            {collabs.length} {collabs.length === 1 ? 'person has' : 'people have'} access
          </Text>
          <View style={{ gap: 8 }}>
            {collabs.map((cl) => {
              const m = members.find((x) => x.associatedUserId === cl.uid) || { id: cl.uid, name: cl.email || 'Member', gender: 'other' as const };
              return (
                <GlassSurface key={cl.uid} rounded={radius.md}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11 }}>
                    <Avatar m={m} size={38} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 14 }}>{m.name}</Text>
                      {cl.email ? <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.sans, fontSize: 11.5 }}>{cl.email}</Text> : null}
                    </View>
                    <View style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: cl.role === 'owner' ? c.accentSoft : c.paper, borderWidth: cl.role === 'owner' ? 0 : 1, borderColor: c.line }}>
                      <Text style={{ color: cl.role === 'owner' ? c.accent : c.inkSoft, fontFamily: font.sansSemi, fontSize: 12, textTransform: 'capitalize' }}>{cl.role}</Text>
                    </View>
                  </View>
                </GlassSurface>
              );
            })}
            {collabs.length === 0 ? (
              <GlassSurface rounded={radius.md}><Text style={{ color: c.mute, fontFamily: font.sans, padding: 16, textAlign: 'center' }}>Just you so far.</Text></GlassSurface>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
