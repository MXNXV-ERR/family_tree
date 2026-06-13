// Visualizer screen (Phase 4). Hosts the three views (Tree default / Radial /
// Timeline) with a top switcher. Focus person drives the radial + ancestor/
// hourglass layouts; tapping a node's profile button navigates to /profile.
import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useTheme, radius } from '../src/theme/theme';
import { Icon } from '../src/ui/Icon';
import { buildAdjacency } from '../src/shared/adjacency';
import { TreeView } from '../src/viz/TreeView';
import { RadialView } from '../src/viz/RadialView';
import { TimelineView } from '../src/viz/TimelineView';
import type { Member } from '../src/shared/types';

type ViewKind = 'tree' | 'radial' | 'timeline';

export default function VizScreen() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { activeTreeId } = useFamily();
  const { members, relationships, loading } = useFamilyTree(activeTreeId);
  const router = useRouter();
  const [view, setView] = useState<ViewKind>('tree');
  const [focusId, setFocusId] = useState<string>('');

  const meId = useMemo(() => members.find((m) => m.associatedUserId === user?.uid)?.id, [members, user]);
  const adjacency = useMemo(() => buildAdjacency(members, relationships), [members, relationships]);

  useEffect(() => {
    if (!focusId && members.length) setFocusId(meId ?? members[0].id);
  }, [members, meId, focusId]);

  const openProfile = (m: Member) => router.push({ pathname: '/profile', params: { id: m.id } });

  if (loading || !focusId) {
    return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.accent} /></View>;
  }

  const shared = { members, relationships, adjacency, focusId, meId, setFocusId, onOpenProfile: openProfile };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, gap: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Icon name="back" size={20} color={c.accent} /></Pressable>
        <View style={[styles.switch, { backgroundColor: c.paper, borderColor: c.line }]}>
          {(['tree', 'radial', 'timeline'] as ViewKind[]).map((v) => {
            const on = view === v;
            return (
              <Pressable key={v} onPress={() => setView(v)} style={[styles.switchBtn, on && { backgroundColor: c.accentSoft }]}>
                <Text style={{ color: on ? c.accent : c.inkSoft, fontWeight: '700', fontSize: 13, textTransform: 'capitalize' }}>{v}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {view === 'tree' && <TreeView {...shared} />}
        {view === 'radial' && <RadialView {...shared} />}
        {view === 'timeline' && <TimelineView {...shared} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  switch: { flex: 1, flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, padding: 3, gap: 3 },
  switchBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
});
