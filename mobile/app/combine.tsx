// Combine families → a Master. Pick ≥2 families you belong to, let the app
// auto-suggest "same person" bridges (name/birth-date matches across trees),
// add cross-family marriages/parent links by hand, then save. Editing an
// existing master (?id=) prefills its families + bridges.
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useTheme, radius, font } from '../src/theme/theme';
import { Icon } from '../src/ui/Icon';
import { Avatar } from '../src/ui/primitives';
import { SheetHead } from '../src/components/panelChrome';
import {
  createMaster, updateMaster, deleteMaster, fetchTreeMembers, subscribeMaster, suggestBridges, treeSig,
} from '../src/firebase/masters';
import type { Member, BridgeLink, BridgeType, MasterFamily } from '../src/shared/types';

const rid = () => Math.random().toString(36).slice(2, 10);
const TYPE_LABEL: Record<BridgeType, string> = { same: 'Same person', spouse: 'Married', parent: 'Parent' };

export default function CombineScreen() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { families, masters } = useFamily();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id && id.length ? id : null;

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [links, setLinks] = useState<BridgeLink[]>([]);
  const [membersByTree, setMembersByTree] = useState<Record<string, Member[]>>({});
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [picker, setPicker] = useState<{ type: BridgeType; slot: 'a' | 'b'; a?: { treeId: string; memberId: string } } | null>(null);
  const [master, setMaster] = useState<MasterFamily | null>(null);

  // Prefill when editing an existing master.
  useEffect(() => {
    if (!editingId) return;
    const unsub = subscribeMaster(editingId, (m) => { setMaster(m); });
    return () => unsub();
  }, [editingId]);
  useEffect(() => {
    if (!master) return;
    setName((n) => n || master.name);
    setSelected((s) => (s.length ? s : master.memberTreeIds));
    setLinks((l) => (l.length ? l : master.links ?? []));
  }, [master]);

  // Load members for every selected tree (for suggestions + name lookups).
  useEffect(() => {
    const missing = selected.filter((t) => !membersByTree[t]);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const loaded: Record<string, Member[]> = {};
      for (const t of missing) {
        try { loaded[t] = await fetchTreeMembers(t); } catch { loaded[t] = []; }
      }
      if (!cancelled) setMembersByTree((prev) => ({ ...prev, ...loaded }));
    })();
    return () => { cancelled = true; };
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTree = (t: string) =>
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  const famName = (t: string) => families.find((f) => f.id === t)?.name ?? 'Family';
  const memberOf = (t: string, mid: string) => membersByTree[t]?.find((m) => m.id === mid);
  const nameOf = (t: string, mid: string) => memberOf(t, mid)?.name ?? '—';

  const hasLink = (a: { treeId: string; memberId: string }, b: { treeId: string; memberId: string }) =>
    links.some((l) =>
      (l.aTreeId === a.treeId && l.aMemberId === a.memberId && l.bTreeId === b.treeId && l.bMemberId === b.memberId) ||
      (l.aTreeId === b.treeId && l.aMemberId === b.memberId && l.bTreeId === a.treeId && l.bMemberId === a.memberId));

  const addLink = (link: Omit<BridgeLink, 'id'>) => setLinks((l) => [...l, { ...link, id: rid() }]);
  const removeLink = (linkId: string) => setLinks((l) => l.filter((x) => x.id !== linkId));

  const scan = () => {
    setScanning(true);
    const trees = selected.map((t) => ({ treeId: t, members: membersByTree[t] ?? [] }));
    // suggestBridges is pure/synchronous; the async wrapper just lets the
    // spinner paint for very large trees.
    setTimeout(() => {
      setScanned(true); setScanning(false);
      // stored implicitly via useMemo below; nothing else to set
    }, 0);
    void trees;
  };

  const suggestions = useMemo(() => {
    if (!scanned) return [];
    const trees = selected.map((t) => ({ treeId: t, members: membersByTree[t] ?? [] }));
    return suggestBridges(trees).filter((s) =>
      !hasLink({ treeId: s.aTreeId, memberId: s.aMember.id }, { treeId: s.bTreeId, memberId: s.bMember.id }));
  }, [scanned, selected, membersByTree, links]); // eslint-disable-line react-hooks/exhaustive-deps

  // Block combining the exact same set of families twice (order-independent).
  const dupMaster = useMemo(() => {
    if (selected.length < 2) return null;
    const sig = treeSig(selected);
    return masters.find((m) => m.sig === sig && m.masterId !== editingId) ?? null;
  }, [masters, selected, editingId]);

  const canSave = name.trim().length > 0 && selected.length >= 2 && !dupMaster;

  async function save() {
    if (!user || !canSave) return;
    setBusy(true);
    try {
      if (editingId) {
        await updateMaster(user.uid, editingId, { name: name.trim(), memberTreeIds: selected, links });
        router.replace({ pathname: '/master' as never, params: { id: editingId } });
      } else {
        const newId = await createMaster(user.uid, { name: name.trim(), memberTreeIds: selected, links, colorIndex: 0 });
        router.replace({ pathname: '/master' as never, params: { id: newId } });
      }
    } catch (e) {
      console.warn('save master', e);
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert('Could not save. Check your connection / that rules are deployed.');
    } finally { setBusy(false); }
  }

  async function doDelete() {
    if (!user || !editingId) return;
    const go = async () => { await deleteMaster(user.uid, editingId); router.replace('/home'); };
    const msg = 'Delete this combined family? The individual families are not affected.';
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm(msg)) void go(); }
    else Alert.alert('Delete combined view', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void go() },
    ]);
  }

  // Modal person picker: pick from a specific tree's members.
  const onPick = (treeId: string, memberId: string) => {
    if (!picker) return;
    if (picker.slot === 'a') { setPicker({ ...picker, slot: 'b', a: { treeId, memberId } }); return; }
    const a = picker.a!;
    const b = { treeId, memberId };
    if (a.treeId === b.treeId && a.memberId === b.memberId) { setPicker(null); return; }
    if (!hasLink(a, b)) {
      // For 'parent', the FIRST pick (a) is the child, the second (b) the parent.
      addLink({ type: picker.type, aTreeId: a.treeId, aMemberId: a.memberId, bTreeId: b.treeId, bMemberId: b.memberId, ...(picker.type === 'spouse' ? { status: 'current' } : {}) });
    }
    setPicker(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <SheetHead icon="users" title={editingId ? 'Manage combined family' : 'Combine families'}
        sub="Merge families you belong to into one view" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        {/* name */}
        <TextInput value={name} onChangeText={setName} placeholder="Name (e.g. Both sides)" placeholderTextColor={c.mute}
          style={{ height: 48, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.ink, fontFamily: font.sansMed, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : null) }} />

        {/* family selection */}
        <View style={{ gap: 8 }}>
          <Text style={label(c)}>FAMILIES ({selected.length} selected)</Text>
          {families.map((f) => {
            const on = selected.includes(f.id);
            const color = f.color ?? c.accent;
            return (
              <Pressable key={f.id} onPress={() => toggleTree(f.id)} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg,
                backgroundColor: on ? c.accentSoft : c.paper, borderWidth: 1.5, borderColor: on ? c.accent : c.line,
              }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper2, borderWidth: 1.5, borderColor: color }}>
                  <Text style={{ color, fontFamily: font.serif, fontSize: 18 }}>{f.mono ?? f.name[0]?.toUpperCase()}</Text>
                </View>
                <Text style={{ flex: 1, color: c.ink, fontFamily: font.sansSemi, fontSize: 15 }} numberOfLines={1}>{f.name}</Text>
                <View style={{ width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: c.line }}>
                  {on ? <Icon name="check" size={15} color={c.accentInk} /> : null}
                </View>
              </Pressable>
            );
          })}
          {families.length < 2 ? (
            <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12.5 }}>You need to belong to at least two families to combine them.</Text>
          ) : null}
        </View>

        {/* auto-suggest */}
        {selected.length >= 2 ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={label(c)}>SHARED PEOPLE</Text>
              <Pressable onPress={scan} disabled={scanning} hitSlop={8}>
                <Text style={{ color: c.accent, fontFamily: font.sansSemi, fontSize: 13 }}>{scanning ? 'Scanning…' : scanned ? 'Rescan' : 'Scan for matches'}</Text>
              </Pressable>
            </View>
            {scanned && !suggestions.length ? (
              <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12.5 }}>No new name/birth-date matches across these families.</Text>
            ) : null}
            {suggestions.map((s, i) => (
              <View key={i} style={{ padding: 11, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, gap: 8 }}>
                <Text style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 13.5 }} numberOfLines={2}>
                  {s.aMember.name} <Text style={{ color: c.mute }}>({famName(s.aTreeId)})</Text> ↔ {s.bMember.name} <Text style={{ color: c.mute }}>({famName(s.bTreeId)})</Text>
                </Text>
                <Text style={{ color: c.accent, fontFamily: font.mono, fontSize: 10.5 }}>{s.reason.toUpperCase()}</Text>
                <Pressable onPress={() => addLink({ type: 'same', aTreeId: s.aTreeId, aMemberId: s.aMember.id, bTreeId: s.bTreeId, bMemberId: s.bMember.id })}
                  style={{ alignSelf: 'flex-start', height: 34, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 12.5 }}>Link as same person</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {/* manual bridges + existing links */}
        {selected.length >= 2 ? (
          <View style={{ gap: 8 }}>
            <Text style={label(c)}>BRIDGES ({links.length})</Text>
            {links.map((l) => (
              <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.line }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 13 }} numberOfLines={1}>
                    {nameOf(l.aTreeId, l.aMemberId)} — {nameOf(l.bTreeId, l.bMemberId)}
                  </Text>
                  <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 10 }}>{TYPE_LABEL[l.type].toUpperCase()}</Text>
                </View>
                <Pressable onPress={() => removeLink(l.id)} hitSlop={8}><Icon name="close" size={16} color={c.mute} /></Pressable>
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(['spouse', 'parent', 'same'] as BridgeType[]).map((t) => (
                <Pressable key={t} onPress={() => setPicker({ type: t, slot: 'a' })}
                  style={{ height: 38, paddingHorizontal: 13, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="plus" size={15} color={c.accent} />
                  <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 12.5 }}>{TYPE_LABEL[t]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* save / delete */}
        {dupMaster ? (
          <Text style={{ color: c.amber, fontFamily: font.sansSemi, fontSize: 12.5 }}>
            These families are already combined as “{dupMaster.name}”. Pick a different set.
          </Text>
        ) : null}
        <Pressable onPress={save} disabled={!canSave || busy}
          style={{ height: 52, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: !canSave || busy ? 0.5 : 1 }}>
          {busy ? <ActivityIndicator color={c.accentInk} /> : <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>{editingId ? 'Save changes' : 'Create combined family'}</Text>}
        </Pressable>
        {editingId ? (
          <Pressable onPress={doDelete} style={{ height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.danger, fontFamily: font.sansSemi, fontSize: 14 }}>Delete combined family</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {picker ? (
        <Modal transparent animationType="fade" onRequestClose={() => setPicker(null)}>
          <PersonPicker
            c={c}
            title={picker.slot === 'a' ? (picker.type === 'parent' ? 'Pick the child' : 'Pick the first person') : (picker.type === 'parent' ? 'Pick the parent' : 'Pick the second person')}
            trees={selected.map((t) => ({ treeId: t, name: famName(t), members: membersByTree[t] ?? [] }))}
            onPick={onPick}
            onClose={() => setPicker(null)} />
        </Modal>
      ) : null}
    </View>
  );
}

function PersonPicker({ c, title, trees, onPick, onClose }: {
  c: ReturnType<typeof useTheme>['c'];
  title: string;
  trees: { treeId: string; name: string; members: Member[] }[];
  onPick: (treeId: string, memberId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
      <View style={{ backgroundColor: c.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '75%', paddingBottom: 20 }}>
        <SheetHead icon="users" title={title} sub="Tap the person" onClose={onClose} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <TextInput value={q} onChangeText={setQ} placeholder="Search…" placeholderTextColor={c.mute} autoFocus
            style={{ height: 44, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.ink, fontFamily: font.sansMed, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : null) }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 0, gap: 6 }}>
          {trees.map((t) => {
            const shown = ql ? t.members.filter((m) => m.name.toLowerCase().includes(ql)) : t.members;
            if (!shown.length) return null;
            return (
              <View key={t.treeId} style={{ gap: 6 }}>
                <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 6 }}>{t.name}</Text>
                {shown.map((m) => (
                  <Pressable key={m.id} onPress={() => onPick(t.treeId, m.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 9, borderRadius: radius.md, backgroundColor: pressed ? c.accentSoft : c.paper })}>
                    <Avatar m={m} size={34} />
                    <Text style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 14 }} numberOfLines={1}>{m.name}</Text>
                  </Pressable>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const label = (c: ReturnType<typeof useTheme>['c']) => ({
  color: c.mute, fontFamily: font.mono, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase' as const,
});
