// Add Link dialog (Phase 2, req 7). Link two existing members: pick A, choose
// A's role toward B, pick B. Live-validates via planRelationship — hard blocks
// show a red reason, soft age-mismatch shows an amber warning the user can
// override. Spouse links expose a current/divorced status toggle.
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme, radius, space, type Palette } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { planRelationship, type LinkKind } from '../shared/relationshipActions';
import { initials, lifespan } from '../shared/adjacency';
import type { Member, Relationship } from '../shared/types';

const KINDS: { kind: LinkKind; label: string; hint: (b: string) => string }[] = [
  { kind: 'child', label: 'Child', hint: (b) => `is the child of ${b}` },
  { kind: 'parent', label: 'Parent', hint: (b) => `is the parent of ${b}` },
  { kind: 'spouse', label: 'Spouse', hint: (b) => `is married to ${b}` },
  { kind: 'sibling', label: 'Sibling', hint: (b) => `is a sibling of ${b}` },
];

export function LinkForm({
  members,
  relationships,
  presetAId,
  presetKind,
  saving,
  onSubmit,
  onCancel,
}: {
  members: Member[];
  relationships: Relationship[];
  presetAId?: string;
  presetKind?: LinkKind;
  saving?: boolean;
  onSubmit: (edges: Omit<Relationship, 'id'>[]) => void;
  onCancel: () => void;
}) {
  const { c } = useTheme();
  const [aId, setAId] = useState<string | undefined>(presetAId);
  const [bId, setBId] = useState<string | undefined>();
  const [kind, setKind] = useState<LinkKind>(presetKind ?? 'child');
  const [status, setStatus] = useState<'current' | 'divorced'>('current');
  const [marriageDate, setMarriageDate] = useState('');

  const plan = useMemo(
    () => (aId && bId ? planRelationship(members, relationships, aId, bId, kind, status, marriageDate) : null),
    [aId, bId, kind, status, marriageDate, members, relationships],
  );

  const A = members.find((m) => m.id === aId);
  const B = members.find((m) => m.id === bId);
  const kindMeta = KINDS.find((k) => k.kind === kind)!;
  const canSave = !!plan?.ok && !saving;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Text style={[styles.h1, { color: c.ink }]}>Add a link</Text>

      <Section title="Person A" c={c}>
        <MemberPicker members={members} selectedId={aId} onSelect={setAId} c={c} />
      </Section>

      <Section title="Relationship" c={c}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {KINDS.map((k) => {
            const on = kind === k.kind;
            return (
              <Pressable key={k.kind} onPress={() => setKind(k.kind)} style={[styles.seg, { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : 'transparent' }]}>
                <Text style={{ color: on ? c.accent : c.inkSoft, fontWeight: '600' }}>{k.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: c.mute, fontSize: 13, marginTop: 10 }}>
          {A ? A.name : 'A'} {kindMeta.hint(B ? B.name : 'B')}.
        </Text>
        {kind === 'spouse' && (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {(['current', 'divorced'] as const).map((s) => {
                const on = status === s;
                return (
                  <Pressable key={s} onPress={() => setStatus(s)} style={[styles.seg, { flex: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : 'transparent' }]}>
                    <Text style={{ color: on ? c.accent : c.inkSoft, fontWeight: '600', textTransform: 'capitalize' }}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
            {/* Optional wedding date — drives anniversary events on the timeline */}
            <TextInput
              value={marriageDate}
              onChangeText={setMarriageDate}
              placeholder="Married on (YYYY-MM-DD, optional)"
              placeholderTextColor={c.mute}
              style={[styles.input, { color: c.ink, borderColor: c.line, backgroundColor: c.paper, marginTop: 10 }]}
            />
          </>
        )}
      </Section>

      <Section title="Person B" c={c}>
        <MemberPicker members={members} selectedId={bId} onSelect={setBId} excludeId={aId} c={c} />
      </Section>

      {/* Plan feedback */}
      {plan && !plan.ok && plan.error ? (
        <View style={[styles.notice, { backgroundColor: c.roseSoft, borderColor: c.danger }]}>
          <Text style={{ color: c.danger, fontWeight: '600' }}>⛔ {plan.error}</Text>
        </View>
      ) : null}
      {plan?.ok && plan.warnings.map((w, i) => (
        <View key={i} style={[styles.notice, { backgroundColor: c.accentSoft, borderColor: c.relEx }]}>
          <Text style={{ color: c.relEx, fontWeight: '600' }}>⚠ {w}</Text>
        </View>
      ))}
      {plan?.ok ? (
        <Text style={{ color: c.mute, fontSize: 12, marginBottom: 12, paddingHorizontal: 4 }}>
          Creates {plan.edges.length} link{plan.edges.length === 1 ? '' : 's'} (incl. cascaded parents/siblings).
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={onCancel} style={[styles.btn, { borderWidth: 1, borderColor: c.line }]}>
          <Text style={{ color: c.inkSoft, fontWeight: '700' }}>Cancel</Text>
        </Pressable>
        <Pressable onPress={() => plan && onSubmit(plan.edges)} disabled={!canSave} style={[styles.btn, { backgroundColor: c.accent, opacity: canSave ? 1 : 0.4 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Create link</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function MemberPicker({ members, selectedId, onSelect, excludeId, c }: {
  members: Member[]; selectedId?: string; onSelect: (id: string) => void; excludeId?: string; c: Palette;
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return members.filter((m) => m.id !== excludeId && (!t || m.name.toLowerCase().includes(t))).slice(0, 40);
  }, [q, members, excludeId]);
  const sel = members.find((m) => m.id === selectedId);

  return (
    <View>
      {sel ? (
        <Pressable onPress={() => onSelect('')} style={[styles.selRow, { borderColor: c.accent, backgroundColor: c.accentSoft }]}>
          <View style={[styles.av, { backgroundColor: sel.gender === 'female' ? c.cardF : c.cardM }]}>
            <Text style={{ color: c.inkSoft, fontWeight: '700', fontSize: 12 }}>{initials(sel.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontWeight: '700' }}>{sel.name}</Text>
            <Text style={{ color: c.mute, fontSize: 12 }}>{lifespan(sel)}</Text>
          </View>
          <Text style={{ color: c.accent, fontSize: 13, fontWeight: '600' }}>Change</Text>
        </Pressable>
      ) : (
        <>
          <TextInput value={q} onChangeText={setQ} placeholder="Search name…" placeholderTextColor={c.mute}
            style={[styles.input, { color: c.ink, borderColor: c.line, backgroundColor: c.paper }]} />
          <ScrollView style={{ maxHeight: 180, marginTop: 8 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {list.map((m) => (
              <Pressable key={m.id} onPress={() => onSelect(m.id)} style={[styles.pickRow, { borderColor: c.lineSoft }]}>
                <View style={[styles.av, { backgroundColor: m.gender === 'female' ? c.cardF : c.cardM }]}>
                  <Text style={{ color: c.inkSoft, fontWeight: '700', fontSize: 11 }}>{initials(m.name)}</Text>
                </View>
                <Text style={{ color: c.ink, flex: 1 }}>{m.name}</Text>
              </Pressable>
            ))}
            {list.length === 0 && <Text style={{ color: c.mute, padding: 12 }}>No matches.</Text>}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function Section({ title, c, children }: { title: string; c: Palette; children: React.ReactNode }) {
  return (
    <GlassSurface style={{ marginBottom: 14 }}>
      <View style={{ padding: space(4) }}>
        <Text style={[styles.section, { color: c.mute }]}>{title.toUpperCase()}</Text>
        {children}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  seg: { borderWidth: 1, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 16, alignItems: 'center' },
  av: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  selRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: radius.md, padding: 10 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  notice: { borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 10 },
  btn: { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
});
