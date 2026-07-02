// Visualizer screen (Phase 4). Hosts the three views (Tree default / Radial /
// Timeline) with a top switcher. Focus person drives the radial + ancestor/
// hourglass layouts; tapping a node's profile button navigates to /profile.
import { useMemo, useState, useEffect } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useTheme, radius } from '../src/theme/theme';
import { Icon } from '../src/ui/Icon';
import { SegTabs, SlideSwap } from '../src/ui/primitives';
import { buildAdjacency } from '../src/shared/adjacency';
import { TreeView } from '../src/viz/TreeView';
import { RadialView } from '../src/viz/RadialView';
import { TimelineView } from '../src/viz/TimelineView';
import { NetworkView } from '../src/viz/NetworkView';
import type { Member } from '../src/shared/types';

type ViewKind = 'tree' | 'radial' | 'timeline' | 'network';

export default function VizScreen() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { activeTreeId } = useFamily();
  const { members, relationships, events, loading } = useFamilyTree(activeTreeId);
  const router = useRouter();
  const [view, setView] = useState<ViewKind>('tree');
  const [focusId, setFocusId] = useState<string>('');

  const meId = useMemo(() => members.find((m) => m.associatedUserId === user?.uid)?.id, [members, user]);
  const adjacency = useMemo(() => buildAdjacency(members, relationships), [members, relationships]);

  // A fresh session / family switch starts focused on YOU (your node), else a
  // sensible default node.
  useEffect(() => { setFocusId(''); }, [activeTreeId]);
  useEffect(() => {
    if (!focusId && members.length) setFocusId(meId ?? members[Math.floor(Math.random() * members.length)].id);
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
        <SegTabs<ViewKind>
          value={view} onChange={setView}
          options={[['tree', 'Tree'], ['radial', 'Radial'], ['timeline', 'Timeline'], ['network', 'Network']]}
          activeBg={c.accentSoft} activeColor={c.accent} rad={radius.md} pad={3} gap={3} padV={8} fontSize={13}
          style={{ flex: 1 }} />
      </View>

      <SlideSwap activeKey={view} index={['tree', 'radial', 'timeline', 'network'].indexOf(view)} style={{ flex: 1 }}>
        {view === 'tree' ? <TreeView {...shared} />
          : view === 'radial' ? <RadialView {...shared} />
          : view === 'timeline' ? <TimelineView {...shared} events={events} />
          : <NetworkView {...shared} />}
      </SlideSwap>
    </View>
  );
}
