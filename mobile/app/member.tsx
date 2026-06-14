// Add/Edit member route. /member adds; /member?id=xxx edits that member.
import { useState } from 'react';
import { View, Text, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { addMember, updateMember, deleteMember, deleteRelationship } from '../src/firebase/firestore';
import { MemberForm } from '../src/components/MemberForm';
import { canEditMember, canAddMember, canDeleteMember } from '../src/shared/permissions';
import { useTheme } from '../src/theme/theme';
import type { Member } from '../src/shared/types';

export default function MemberRoute() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { activeTreeId, activeFamily } = useFamily();
  const { members, relationships, loading } = useFamilyTree(activeTreeId);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [saving, setSaving] = useState(false);

  const initial = id ? members.find((m) => m.id === id) : undefined;
  const role = activeFamily?.role;
  const allowed = id ? canEditMember(role, initial, user?.uid) : canAddMember(role);

  if (loading && id) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (id && !initial) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.mute }}>Member not found.</Text>
      </View>
    );
  }

  if (!allowed) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', marginBottom: 6 }}>Not allowed</Text>
        <Text style={{ color: c.mute, textAlign: 'center' }}>You can only edit your own profile. Ask an admin to change this person’s details.</Text>
        <Text onPress={() => router.back()} style={{ color: c.accent, fontWeight: '700', marginTop: 18 }}>Go back</Text>
      </View>
    );
  }

  async function handleSubmit(data: Omit<Member, 'id'>) {
    if (!activeTreeId) return;
    setSaving(true);
    try {
      if (id) await updateMember(activeTreeId, id, data);
      else await addMember(activeTreeId, data);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!activeTreeId || !id) return;
    setSaving(true);
    try {
      // Cascade: remove every relationship edge touching this member first.
      const edges = relationships.filter((r) => r.fromId === id || r.toId === id);
      await Promise.all(edges.map((r) => deleteRelationship(activeTreeId, r.id)));
      await deleteMember(activeTreeId, id);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    const msg = `Delete ${initial?.name}? This also removes their relationship links. This can't be undone.`;
    if (Platform.OS === 'web') {
      // RN Alert has no buttons on web; use window.confirm.
      if (typeof window !== 'undefined' && window.confirm(msg)) doDelete();
      return;
    }
    Alert.alert('Delete member', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  }

  return (
    <MemberForm
      initial={initial}
      saving={saving}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
      onDelete={id && canDeleteMember(role) ? confirmDelete : undefined}
    />
  );
}
