// Add/Edit Member form (Phase 1, reqs 2 + 6). Required name + smart validation;
// gendered avatar; photo via gallery/camera; tappable phone/email live in the
// profile, here they're just inputs. Optional bio fields always shown in the
// form (per user) but hidden in display when empty. Open-ended custom fields.
import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Image, ScrollView,
  ActivityIndicator, Platform, type KeyboardTypeOptions,
} from 'react-native';
import { useTheme, radius, space, font, type Palette } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { IconBtn } from '../ui/primitives';
import { DateField } from '../ui/DateField';
import { validateMember, hasErrors, type FieldErrors } from '../shared/validation';
import { pickFromGallery, takePhoto } from '../shared/photo';
import { initials } from '../shared/adjacency';
import type { Member } from '../shared/types';

type Draft = Partial<Member> & { customFields?: Record<string, string> };

export function MemberForm({
  initial,
  saving,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Member;
  saving?: boolean;
  onSubmit: (data: Omit<Member, 'id'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { c } = useTheme();
  const [d, setD] = useState<Draft>(initial ?? { gender: 'male' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoBusy, setPhotoBusy] = useState(false);
  const [custom, setCustom] = useState<{ k: string; v: string }[]>(
    Object.entries(initial?.customFields ?? {}).map(([k, v]) => ({ k, v })),
  );

  const set = (k: keyof Draft, v: any) => setD((p) => ({ ...p, [k]: v }));

  async function choosePhoto(fn: () => Promise<string | null>) {
    setPhotoBusy(true);
    try {
      const uri = await fn();
      if (uri) set('photoUrl', uri);
    } finally {
      setPhotoBusy(false);
    }
  }

  function submit() {
    const cf = custom.reduce<Record<string, string>>((a, { k, v }) => {
      if (k.trim() && v.trim()) a[k.trim()] = v.trim();
      return a;
    }, {});
    const merged: Draft = { ...d, customFields: Object.keys(cf).length ? cf : undefined };
    const e = validateMember(merged);
    setErrors(e);
    if (hasErrors(e)) return;
    onSubmit(clean(merged) as Omit<Member, 'id'>);
  }

  const av = d.gender === 'female' ? c.cardF : d.gender === 'other' ? c.paper : c.cardM;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Fixed header — back (cancels the edit), title, and Save */}
      <View style={[styles.header, { borderColor: c.lineSoft, paddingTop: Platform.OS === 'web' ? 16 : 14 }]}>
        <IconBtn name="back" tone="glass" size={40} onPress={onCancel} />
        <Text style={[styles.headerTitle, { color: c.ink }]}>{initial ? 'Edit member' : 'New member'}</Text>
        <Pressable onPress={submit} disabled={saving} style={[styles.saveBtn, { backgroundColor: c.accent, opacity: saving ? 0.6 : 1 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 14 }}>{initial ? 'Save' : 'Add'}</Text>}
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      {/* Photo */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <View style={[styles.photo, { backgroundColor: av, borderColor: c.line }]}>
          {d.photoUrl ? (
            <Image source={{ uri: d.photoUrl }} style={styles.photoImg} />
          ) : (
            <Text style={{ color: c.inkSoft, fontSize: 28, fontWeight: '800' }}>{initials(d.name ?? '?')}</Text>
          )}
          {photoBusy && <View style={styles.photoBusy}><ActivityIndicator color={c.accent} /></View>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <SmallBtn label="Gallery" onPress={() => choosePhoto(pickFromGallery)} c={c} />
          <SmallBtn label="Camera" onPress={() => choosePhoto(takePhoto)} c={c} />
          {d.photoUrl ? <SmallBtn label="Remove" onPress={() => set('photoUrl', undefined)} c={c} danger /> : null}
        </View>
      </View>

      {/* Core */}
      <Section title="Basics" c={c}>
        <Field label="Name" required value={d.name} onChange={(v) => set('name', v)} error={errors.name} c={c} placeholder="Full name" />
        <GenderRow value={d.gender} onChange={(v) => set('gender', v)} c={c} />
        <Row>
          <Field label="Born" value={d.birthDate} onChange={(v) => set('birthDate', v)} error={errors.birthDate} c={c} placeholder="Select date" flex date />
          <Field label="Died" value={d.deathDate} onChange={(v) => set('deathDate', v)} error={errors.deathDate} c={c} placeholder="Select date" flex date />
        </Row>
      </Section>

      {/* Contact */}
      <Section title="Contact" c={c}>
        <Field label="Phone" value={d.phone} onChange={(v) => set('phone', v)} error={errors.phone} c={c} placeholder="+1 555 123 4567" keyboardType="phone-pad" />
        <Field label="Email" value={d.email} onChange={(v) => set('email', v)} error={errors.email} c={c} placeholder="name@example.com" keyboardType="email-address" autoCap="none" />
        <Field label="Address" value={d.address} onChange={(v) => set('address', v)} c={c} placeholder="Street, city" />
        <Field label="Current location" value={d.location} onChange={(v) => set('location', v)} c={c} placeholder="City, country" />
      </Section>

      {/* Bio */}
      <Section title="Life & story" c={c}>
        <Row>
          <Field label="Occupation" value={d.occupation} onChange={(v) => set('occupation', v)} c={c} flex />
          <Field label="Maiden name" value={d.maidenName} onChange={(v) => set('maidenName', v)} c={c} flex />
        </Row>
        <Field label="Place of birth" value={d.placeOfBirth} onChange={(v) => set('placeOfBirth', v)} c={c} />
        <Field label="Favorite quote" value={d.favoriteQuote} onChange={(v) => set('favoriteQuote', v)} c={c} placeholder="The line they most vibe with" multiline />
        <Field label="Childhood stories" value={d.childhoodStories} onChange={(v) => set('childhoodStories', v)} c={c} multiline />
        <Field label="About" value={d.about} onChange={(v) => set('about', v)} c={c} multiline />
        <Field label="Notes" value={d.notes} onChange={(v) => set('notes', v)} c={c} multiline />
      </Section>

      {/* Custom */}
      <Section title="And more" c={c}>
        {custom.map((row, i) => (
          <Row key={i}>
            <Field label="" value={row.k} onChange={(v) => setCustom((p) => p.map((r, j) => (j === i ? { ...r, k: v } : r)))} c={c} placeholder="Label" flex />
            <Field label="" value={row.v} onChange={(v) => setCustom((p) => p.map((r, j) => (j === i ? { ...r, v } : r)))} c={c} placeholder="Value" flex />
            <Pressable onPress={() => setCustom((p) => p.filter((_, j) => j !== i))} style={[styles.del, { borderColor: c.line }]}>
              <Text style={{ color: c.danger, fontSize: 18 }}>×</Text>
            </Pressable>
          </Row>
        ))}
        <Pressable onPress={() => setCustom((p) => [...p, { k: '', v: '' }])} style={[styles.addField, { borderColor: c.line }]}>
          <Text style={{ color: c.accent, fontWeight: '600' }}>+ Add field</Text>
        </Pressable>
      </Section>

      {initial && onDelete ? (
        <Pressable onPress={onDelete} disabled={saving} style={[styles.btn, { borderWidth: 1, borderColor: c.danger, marginTop: 4 }]}>
          <Text style={{ color: c.danger, fontFamily: font.sansBold }}>Delete member</Text>
        </Pressable>
      ) : null}
      </ScrollView>
    </View>
  );
}

// Strip undefined / empty strings so Firestore doesn't reject the write.
function clean(d: Draft): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

// ---- primitives ----
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

function Field({
  label, value, onChange, error, c, placeholder, required, multiline, flex, keyboardType, autoCap, date,
}: {
  label: string; value?: string; onChange: (v: string) => void; error?: string; c: Palette;
  placeholder?: string; required?: boolean; multiline?: boolean; flex?: boolean;
  keyboardType?: KeyboardTypeOptions; autoCap?: 'none' | 'sentences' | 'words'; date?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12, flex: flex ? 1 : undefined }}>
      {label ? (
        <Text style={[styles.label, { color: c.inkSoft }]}>
          {label}{required ? <Text style={{ color: c.danger }}> *</Text> : null}
        </Text>
      ) : null}
      {date ? (
        <DateField value={value} onChange={onChange} placeholder={placeholder} error={!!error} />
      ) : (
        <TextInput
          value={value ?? ''}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={c.mute}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCap ?? 'sentences'}
          style={[
            styles.input,
            { color: c.ink, borderColor: error ? c.danger : c.line, backgroundColor: c.paper },
            multiline && { minHeight: 72, textAlignVertical: 'top' },
          ]}
        />
      )}
      {error ? <Text style={[styles.err, { color: c.danger }]}>{error}</Text> : null}
    </View>
  );
}

function GenderRow({ value, onChange, c }: { value?: string; onChange: (v: Member['gender']) => void; c: Palette }) {
  const opts: Member['gender'][] = ['male', 'female', 'other'];
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: c.inkSoft }]}>Gender</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {opts.map((o) => {
          const on = value === o;
          return (
            <Pressable key={o} onPress={() => onChange(o)} style={[styles.seg, { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : 'transparent' }]}>
              <Text style={{ color: on ? c.accent : c.inkSoft, fontWeight: '600', textTransform: 'capitalize' }}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>{children}</View>
);

function SmallBtn({ label, onPress, c, danger }: { label: string; onPress: () => void; c: Palette; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.smallBtn, { borderColor: danger ? c.danger : c.line }]}>
      <Text style={{ color: danger ? c.danger : c.inkSoft, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontFamily: font.serifItalic, fontSize: 19 },
  saveBtn: { borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 9, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  err: { fontSize: 12, marginTop: 4 },
  photo: { width: 96, height: 96, borderRadius: 48, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoBusy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  seg: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: 9, alignItems: 'center' },
  smallBtn: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  del: { width: 44, height: 44, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  addField: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  btn: { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
});
