// Family events panel — list + create/edit/delete get-togethers, reunions, etc.
// Each event carries a date, optional location, Google Drive link, description,
// and optional member links. Events surface on the timeline (events mode).
// Viewing is open to members; editing is owner/admin only (canManage).
import { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Platform, Alert, ActivityIndicator, Linking } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { Icon } from '../ui/Icon';
import { DateField } from '../ui/DateField';
import { SheetHead, PanelScroll } from './panelChrome';
import { addEvent, updateEvent, deleteEvent } from '../firebase/firestore';
import { yearOf } from '../shared/adjacency';
import type { FamilyEvent, Member } from '../shared/types';

type Editing = (Partial<FamilyEvent> & { id?: string }) | null;

export function EventsPanel({ treeId, members, events, canManage, onClose }: {
  treeId: string; members: Member[]; events: FamilyEvent[]; canManage: boolean; onClose: () => void;
}) {
  const { c } = useTheme();
  const [editing, setEditing] = useState<Editing>(null);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(
    () => [...events].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [events],
  );
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const startNew = () => setEditing({ title: '', date: '', memberIds: [] });
  const startEdit = (e: FamilyEvent) => setEditing({ ...e });

  const save = async () => {
    if (!editing || !editing.title?.trim() || !editing.date) return;
    setBusy(true);
    try {
      const payload: any = {
        title: editing.title.trim(),
        date: editing.date,
        ...(editing.endDate ? { endDate: editing.endDate } : {}),
        ...(editing.location?.trim() ? { location: editing.location.trim() } : {}),
        ...(editing.driveUrl?.trim() ? { driveUrl: editing.driveUrl.trim() } : {}),
        ...(editing.description?.trim() ? { description: editing.description.trim() } : {}),
        ...(editing.memberIds?.length ? { memberIds: editing.memberIds } : {}),
      };
      if (editing.id) await updateEvent(treeId, editing.id, payload);
      else await addEvent(treeId, payload);
      setEditing(null);
    } finally { setBusy(false); }
  };

  const remove = (e: FamilyEvent) => {
    const go = () => deleteEvent(treeId, e.id);
    const msg = `Delete "${e.title}"?`;
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm(msg)) go(); }
    else Alert.alert('Delete event', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };

  const input = (value: string | undefined, set: (v: string) => void, placeholder: string, multiline?: boolean) => (
    <TextInput value={value ?? ''} onChangeText={set} placeholder={placeholder} placeholderTextColor={c.mute} multiline={multiline}
      style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.ink, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: font.sansMed, fontSize: 15, minHeight: multiline ? 72 : undefined, textAlignVertical: multiline ? 'top' : 'center', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
  );

  const toggleMember = (id: string) => setEditing((e) => {
    if (!e) return e;
    const set = new Set(e.memberIds ?? []);
    set.has(id) ? set.delete(id) : set.add(id);
    return { ...e, memberIds: [...set] };
  });

  if (editing) {
    return (
      <View style={{ flex: 1 }}>
        <SheetHead icon="calendar" title={editing.id ? 'Edit event' : 'New event'} sub="Get-togethers, reunions, trips…" onClose={() => setEditing(null)} />
        <PanelScroll contentStyle={{ padding: 16, paddingTop: 4, gap: 12 }}>
          <Lbl c={c}>Title</Lbl>
          {input(editing.title, (v) => setEditing({ ...editing, title: v }), 'e.g. Diwali get-together')}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Lbl c={c}>Date</Lbl><DateField value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} placeholder="Date" allowFuture /></View>
            <View style={{ flex: 1 }}><Lbl c={c}>End (optional)</Lbl><DateField value={editing.endDate} onChange={(v) => setEditing({ ...editing, endDate: v })} placeholder="End date" allowFuture /></View>
          </View>
          <Lbl c={c}>Location</Lbl>
          {input(editing.location, (v) => setEditing({ ...editing, location: v }), 'Where it happened')}
          <Lbl c={c}>Google Drive link</Lbl>
          {input(editing.driveUrl, (v) => setEditing({ ...editing, driveUrl: v }), 'https://drive.google.com/…')}
          <Lbl c={c}>Description</Lbl>
          {input(editing.description, (v) => setEditing({ ...editing, description: v }), 'A few words about it', true)}

          <Lbl c={c}>People (optional)</Lbl>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {members.map((m) => {
              const on = (editing.memberIds ?? []).includes(m.id);
              return (
                <Pressable key={m.id} onPress={() => toggleMember(m.id)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.paper }}>
                  <Text style={{ color: on ? c.accent : c.inkSoft, fontFamily: font.sansSemi, fontSize: 12.5 }}>{m.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Pressable onPress={() => setEditing(null)} style={{ flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 15 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={busy || !editing.title?.trim() || !editing.date} style={{ flex: 1, height: 50, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: busy || !editing.title?.trim() || !editing.date ? 0.6 : 1 }}>
              {busy ? <ActivityIndicator color={c.accentInk} /> : <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>{editing.id ? 'Save' : 'Add event'}</Text>}
            </Pressable>
          </View>
        </PanelScroll>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="calendar" title="Family events" sub="Shown on the timeline" onClose={onClose} />
      <PanelScroll contentStyle={{ padding: 16, paddingTop: 4, gap: 10 }}>
        {canManage ? (
          <Pressable onPress={startNew} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.md, backgroundColor: c.accent, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <Icon name="plus" size={18} stroke={2.1} color={c.accentInk} />
            <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 14.5 }}>New event</Text>
          </Pressable>
        ) : null}

        {sorted.map((e) => (
          <GlassSurface key={e.id} rounded={radius.lg}>
            <View style={{ padding: 13, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="calendar" size={16} color={c.accent} />
                <Text style={{ flex: 1, color: c.ink, fontFamily: font.sansBold, fontSize: 15 }}>{e.title}</Text>
                <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>{yearOf(e.date) ?? e.date}</Text>
              </View>
              <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>{e.date}{e.location ? ` · ${e.location}` : ''}</Text>
              {e.description ? <Text style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 13, lineHeight: 19 }}>{e.description}</Text> : null}
              {e.memberIds?.length ? (
                <Text numberOfLines={1} style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 12 }}>
                  {e.memberIds.map((id) => memberById.get(id)?.name).filter(Boolean).join(', ')}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2 }}>
                {e.driveUrl ? (
                  <Pressable onPress={() => Linking.openURL(e.driveUrl!).catch(() => {})} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Icon name="link" size={14} color={c.accent} /><Text style={{ color: c.accent, fontFamily: font.sansSemi, fontSize: 12.5 }}>Open link</Text>
                  </Pressable>
                ) : null}
                {canManage ? (
                  <>
                    <Pressable onPress={() => startEdit(e)} hitSlop={6}><Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 12.5 }}>Edit</Text></Pressable>
                    <Pressable onPress={() => remove(e)} hitSlop={6}><Text style={{ color: c.danger, fontFamily: font.sansSemi, fontSize: 12.5 }}>Delete</Text></Pressable>
                  </>
                ) : null}
              </View>
            </View>
          </GlassSurface>
        ))}

        {sorted.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 36, gap: 8 }}>
            <Icon name="calendar" size={28} color={c.faint} />
            <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 14, textAlign: 'center' }}>No events yet.{canManage ? ' Add your first get-together.' : ''}</Text>
          </View>
        ) : null}
      </PanelScroll>
    </View>
  );
}

function Lbl({ c, children }: { c: ReturnType<typeof useTheme>['c']; children: React.ReactNode }) {
  return <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginLeft: 2 }}>{children}</Text>;
}
