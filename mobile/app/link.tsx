// Add Link route. /link opens the picker; /link?a=ID preselects person A.
import { useState } from 'react';
import { View, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { addRelationships } from '../src/firebase/firestore';
import { splitId } from '../src/firebase/masters';
import { LinkForm } from '../src/components/LinkForm';
import { canEditRelationship } from '../src/shared/permissions';
import { useTheme } from '../src/theme/theme';
import type { Relationship } from '../src/shared/types';
import type { LinkKind } from '../src/shared/relationshipActions';

export default function LinkRoute() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { activeTreeId, activeFamily, families } = useFamily();
  const router = useRouter();
  const { a: rawA, kind } = useLocalSearchParams<{ a?: string; kind?: string }>();
  // Master (combined) view passes a namespaced `treeId:localId` for person A;
  // add the link inside that person's ORIGIN tree.
  const split = rawA ? splitId(rawA) : null;
  const treeId = split ? split.treeId : activeTreeId;
  const presetA = split ? split.localId : rawA;
  const role = split ? families.find((f) => f.id === treeId)?.role : activeFamily?.role;
  const { members, relationships, loading } = useFamilyTree(treeId);
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  async function handleSubmit(edges: Omit<Relationship, 'id'>[]) {
    if (!treeId) return;
    // Depth-1 rule: a normal member may only create links that touch their own
    // node. Owner/admin may link anyone. (Also enforced by the Firestore rules.)
    const ok = edges.every((e) => canEditRelationship(role, e.fromId, e.toId, members, user?.uid));
    if (!ok) {
      const msg = 'You can only add relationships that involve you. Ask an admin to link other people.';
      if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.alert(msg); }
      else Alert.alert('Not allowed', msg);
      return;
    }
    setSaving(true);
    try {
      await addRelationships(treeId, edges);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <LinkForm
      members={members}
      relationships={relationships}
      presetAId={presetA}
      presetKind={kind as LinkKind | undefined}
      saving={saving}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
    />
  );
}
