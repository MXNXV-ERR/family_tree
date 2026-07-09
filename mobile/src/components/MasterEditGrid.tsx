// Master edit grid — a spreadsheet-style view to edit every member's fields at
// once, plus an "Age order" tab (the same generation-grouped reorder list as
// the profile Order sheet). Owner/admin only. Both tabs stage in memory and
// commit together on "Save all" (one chunked batch via bulkUpdateMembers).
// No add/delete here — those stay in the normal member flows.
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, ActivityIndicator } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { Icon } from '../ui/Icon';
import { SegTabs } from '../ui/primitives';
import { AgeOrderGroups, useAgeOrder } from './AgeOrderList';
import { bulkUpdateMembers } from '../firebase/firestore';
import type { Member, Relationship } from '../shared/types';

type Col = { key: keyof Member; label: string; w: number; kind?: 'gender' };
const COLS: Col[] = [
  { key: 'name', label: 'Name', w: 168 },
  { key: 'gender', label: 'Gender', w: 100, kind: 'gender' },
  { key: 'birthDate', label: 'Born', w: 120 },
  { key: 'deathDate', label: 'Died', w: 120 },
  { key: 'phone', label: 'Phone', w: 150 },
  { key: 'email', label: 'Email', w: 190 },
  { key: 'location', label: 'Location', w: 150 },
  { key: 'occupation', label: 'Occupation', w: 160 },
  { key: 'maidenName', label: 'Maiden name', w: 150 },
  { key: 'placeOfBirth', label: 'Place of birth', w: 160 },
];
const IDX_W = 44;
const ROW_H = 46;
const GENDERS: Member['gender'][] = ['male', 'female', 'other'];

export function MasterEditGrid({ treeId, members, relationships, canManage, onClose }: {
  treeId: string; members: Member[]; relationships: Relationship[]; canManage: boolean; onClose: () => void;
}) {
  const { c } = useTheme();
  const [staged, setStaged] = useState<Record<string, Partial<Member>>>({});
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'details' | 'order'>('details');
  const order = useAgeOrder(members, relationships);

  const totalW = useMemo(() => IDX_W + COLS.reduce((s, col) => s + col.w, 0), []);
  const orderChanges = order.dirty ? order.buildChanges() : [];
  const dirtyCount = new Set([...Object.keys(staged), ...orderChanges.map((ch) => ch.id)]).size;

  const val = (m: Member, key: keyof Member): string => {
    const s = staged[m.id];
    const v = s && key in s ? (s as any)[key] : (m as any)[key];
    return v == null ? '' : String(v);
  };
  const setCell = (id: string, key: keyof Member, v: any) =>
    setStaged((s) => ({ ...s, [id]: { ...s[id], [key]: v } }));

  const sorted = useMemo(() => [...members].sort((a, b) => a.name.localeCompare(b.name)), [members]);

  const save = async () => {
    // one batch: staged detail edits merged with birthOrder diffs by member id
    const merged = new Map<string, Partial<Member>>();
    for (const [id, data] of Object.entries(staged)) {
      const d = clean(data);
      if (Object.keys(d).length) merged.set(id, d);
    }
    for (const ch of orderChanges) merged.set(ch.id, { ...merged.get(ch.id), ...ch.data });
    if (!merged.size) { onClose(); return; }
    setBusy(true);
    try {
      await bulkUpdateMembers(treeId, [...merged].map(([id, data]) => ({ id, data })));
      setStaged({});
      order.markSaved();
    } finally { setBusy(false); }
  };

  if (!canManage) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Icon name="info" size={28} color={c.mute} />
        <Text style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 15, textAlign: 'center', marginTop: 12 }}>Only owners and admins can edit all members at once.</Text>
        <Pressable onPress={onClose} style={{ marginTop: 18, height: 46, paddingHorizontal: 22, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* header bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.lineSoft }}>
        <Pressable onPress={onClose} hitSlop={8}><Icon name="back" size={20} color={c.accent} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontFamily: font.serifItalic, fontSize: 19 }}>Edit all members</Text>
          <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>{members.length} people · {dirtyCount} edited</Text>
        </View>
        <SegTabs value={tab} onChange={setTab} options={[['details', 'Details'], ['order', 'Age order']]}
          fill={false} padV={7} padH={14} fontSize={12.5} />
        {dirtyCount > 0 ? (
          <Pressable onPress={() => { setStaged({}); order.reset(); }} style={{ height: 40, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 13 }}>Discard</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={save} disabled={busy || dirtyCount === 0} style={{ height: 40, paddingHorizontal: 18, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: busy || dirtyCount === 0 ? 0.5 : 1 }}>
          {busy ? <ActivityIndicator color={c.accentInk} /> : <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 13.5 }}>Save all</Text>}
        </Pressable>
      </View>

      {tab === 'order' ? (
        <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', gap: 14 }}>
            <AgeOrderGroups order={order} />
          </View>
        </ScrollView>
      ) : (
      <ScrollView horizontal contentContainerStyle={{ minWidth: totalW }} showsHorizontalScrollIndicator>
        <View style={{ width: totalW }}>
          {/* header row */}
          <View style={{ flexDirection: 'row', height: 40, backgroundColor: c.paper, borderBottomWidth: 1, borderColor: c.line }}>
            <HeaderCell w={IDX_W} label="#" c={c} />
            {COLS.map((col) => <HeaderCell key={String(col.key)} w={col.w} label={col.label} c={c} />)}
          </View>
          {/* data rows */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 80 }}>
            {sorted.map((m, i) => {
              const rowDirty = !!staged[m.id];
              return (
                <View key={m.id} style={{ flexDirection: 'row', height: ROW_H, backgroundColor: rowDirty ? c.accentSoft : (i % 2 ? c.bg : c.paper2), borderBottomWidth: 1, borderColor: c.lineSoft }}>
                  <View style={{ width: IDX_W, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>{i + 1}</Text>
                  </View>
                  {COLS.map((col) => (
                    <View key={String(col.key)} style={{ width: col.w, justifyContent: 'center', paddingHorizontal: 6, borderLeftWidth: 1, borderColor: c.lineSoft }}>
                      {col.kind === 'gender' ? (
                        <Pressable onPress={() => setCell(m.id, 'gender', GENDERS[(Math.max(0, GENDERS.indexOf(val(m, 'gender') as any)) + 1) % 3])}
                          style={{ height: 32, borderRadius: radius.sm, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 12.5, textTransform: 'capitalize' }}>{val(m, 'gender') || '—'}</Text>
                        </Pressable>
                      ) : (
                        <TextInput
                          value={val(m, col.key)}
                          onChangeText={(v) => setCell(m.id, col.key, v)}
                          placeholder={col.key === 'birthDate' || col.key === 'deathDate' ? 'YYYY-MM-DD' : '—'}
                          placeholderTextColor={c.faint}
                          style={{ height: 32, borderRadius: radius.sm, borderWidth: 1, borderColor: rowDirty ? c.accent : c.line, backgroundColor: c.bg, color: c.ink, paddingHorizontal: 8, fontFamily: font.sansMed, fontSize: 13, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
                      )}
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>
      )}
    </View>
  );
}

// Trim strings; drop empties EXCEPT keep an intentional clear as a removed key
// (we simply don't write empty values, so cleared cells are left unchanged).
function clean(data: Partial<Member>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') { const t = v.trim(); if (t) out[k] = t; }
    else if (v != null) out[k] = v;
  }
  return out;
}

function HeaderCell({ w, label, c }: { w: number; label: string; c: ReturnType<typeof useTheme>['c'] }) {
  return (
    <View style={{ width: w, justifyContent: 'center', paddingHorizontal: 8, borderLeftWidth: 1, borderColor: c.lineSoft }}>
      <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}
