// Add/Edit member route. /member adds; /member?id=xxx edits that member.
import { useState } from 'react';
import { View, Text, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { addMember, updateMember, deleteMember, deleteRelationship } from '../src/firebase/firestore';
import { splitId } from '../src/firebase/masters';
import { MemberForm } from '../src/components/MemberForm';
import { canEditMember, canAddMember, canDeleteMember } from '../src/shared/permissions';
import { useTheme } from '../src/theme/theme';
import type { Member } from '../src/shared/types';

export default function MemberRoute() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { activeTreeId, activeFamily, families } = useFamily();
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  // A master (combined) view passes a namespaced `treeId:localId`; route the
  // edit to the ORIGIN tree instead of the active one.
  const split = rawId ? splitId(rawId) : null;
  const treeId = split ? split.treeId : activeTreeId;
  const memberId = split ? split.localId : rawId;
  const { members, relationships, loading } = useFamilyTree(treeId);
  const [saving, setSaving] = useState(false);

  const initial = memberId ? members.find((m) => m.id === memberId) : undefined;
  const role = split ? families.find((f) => f.id === treeId)?.role : activeFamily?.role;
  const allowed = memberId ? canEditMember(role, initial, user?.uid) : canAddMember(role);

  if (loading && memberId) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (memberId && !initial) {
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
    if (!treeId) return;
    setSaving(true);
    try {
      if (memberId) await updateMember(treeId, memberId, data);
      else await addMember(treeId, data);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!treeId || !memberId) return;
    setSaving(true);
    try {
      // Cascade: remove every relationship edge touching this member first.
      const edges = relationships.filter((r) => r.fromId === memberId || r.toId === memberId);
      await Promise.all(edges.map((r) => deleteRelationship(treeId, r.id)));
      await deleteMember(treeId, memberId);
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
      onDelete={memberId && canDeleteMember(role) ? confirmDelete : undefined}
    />
  );
}
