// Add Link route. /link opens the picker; /link?a=ID preselects person A.
import { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { addRelationships } from '../src/firebase/firestore';
import { LinkForm } from '../src/components/LinkForm';
import { useTheme } from '../src/theme/theme';
import type { Relationship } from '../src/shared/types';
import type { LinkKind } from '../src/shared/relationshipActions';

export default function LinkRoute() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { members, relationships, loading } = useFamilyTree(user?.uid);
  const router = useRouter();
  const { a, kind } = useLocalSearchParams<{ a?: string; kind?: string }>();
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  async function handleSubmit(edges: Omit<Relationship, 'id'>[]) {
    if (!user) return;
    setSaving(true);
    try {
      await addRelationships(user.uid, edges);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <LinkForm
      members={members}
      relationships={relationships}
      presetAId={a}
      presetKind={kind as LinkKind | undefined}
      saving={saving}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
    />
  );
}
