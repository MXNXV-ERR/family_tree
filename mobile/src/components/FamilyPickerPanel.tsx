// Family switcher panel (the design's FamilyPickerSheet). Lists every family the
// user belongs to, switches the active tree, and offers "New family" /
// "Join by invite" inline flows plus a jump to Family info. Used by the mobile
// header sheet and the desktop switcher dropdown.
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Platform } from 'react-native';
import { useTheme, font, radius } from '../theme/theme';
import { useAuth } from '../firebase/AuthContext';
import { useFamily } from '../firebase/FamilyContext';
import { createFamily, joinFamilyByInvite } from '../firebase/families';
import { Icon } from '../ui/Icon';
import { SheetHead } from './panelChrome';

type Mode = 'list' | 'new' | 'join';

export function FamilyPickerPanel({ onClose, onOpenInfo }: { onClose: () => void; onOpenInfo: () => void }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const { families, activeTreeId, setActiveTreeId } = useFamily();
  const [mode, setMode] = useState<Mode>('list');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [code, setCode] = useState('');

  const switchTo = (id: string) => { setActiveTreeId(id); onClose(); };

  async function doCreate() {
    if (!user || !name.trim()) return;
    setBusy(true); setErr(null);
    try {
      const id = await createFamily(user.uid, user.email, { name: name.trim(), region: region.trim(), colorIndex: families.length });
      setActiveTreeId(id); onClose();
    } catch (e) { setErr('Could not create family. Check your connection / rules.'); }
    finally { setBusy(false); }
  }

  async function doJoin() {
    if (!user || !code.trim()) return;
    setBusy(true); setErr(null);
    try {
      const id = await joinFamilyByInvite(user.uid, user.email, code.trim());
      if (!id) { setErr('No family found for that invite code.'); return; }
      setActiveTreeId(id); onClose();
    } catch (e) { setErr('Could not join. Check the code and your rules.'); }
    finally { setBusy(false); }
  }

  const input = (value: string, set: (v: string) => void, placeholder: string, autoCap: 'characters' | 'sentences' = 'sentences') => (
    <TextInput value={value} onChangeText={set} placeholder={placeholder} placeholderTextColor={c.mute} autoCapitalize={autoCap}
      style={{ height: 48, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.ink, fontFamily: font.sansMed, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
  );

  const headSub = mode === 'new' ? 'Start a new tree you own' : mode === 'join' ? 'Enter an invite code' : 'Switch between the trees you belong to';

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="users" title="Your families" sub={headSub} onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10 }}>
        {mode === 'list' && (
          <>
            {families.map((f) => {
              const on = f.id === activeTreeId;
              const color = f.color ?? c.accent;
              return (
                <Pressable key={f.id} onPress={() => switchTo(f.id)} style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, borderRadius: radius.lg,
                  backgroundColor: on ? c.accentSoft : c.paper, borderWidth: 1.5, borderColor: on ? c.accent : c.line,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}>
                  <View style={{ width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper2, borderWidth: 1.5, borderColor: color }}>
                    <Text style={{ color, fontFamily: font.serif, fontSize: 24 }}>{f.mono ?? f.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansBold, fontSize: 16 }}>{f.name}</Text>
                    <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.mono, fontSize: 11, marginTop: 2, textTransform: 'capitalize' }}>{f.role ?? 'member'}</Text>
                  </View>
                  {on ? (
                    <View style={{ padding: 6, borderRadius: radius.pill, backgroundColor: c.accent }}><Icon name="check" size={16} color={c.accentInk} /></View>
                  ) : <Icon name="chevR" size={18} color={c.faint} />}
                </Pressable>
              );
            })}

            <Pressable onPress={onOpenInfo} style={({ pressed }) => actionStyle(c, pressed)}>
              <Icon name="info" size={18} color={c.inkSoft} /><Text style={actionText(c)}>View family info</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => { setMode('new'); setErr(null); }} style={({ pressed }) => [actionStyle(c, pressed), { flex: 1 }]}>
                <Icon name="plus" size={18} stroke={2.1} color={c.accent} /><Text style={[actionText(c), { color: c.accent }]}>New family</Text>
              </Pressable>
              <Pressable onPress={() => { setMode('join'); setErr(null); }} style={({ pressed }) => [actionStyle(c, pressed), { flex: 1 }]}>
                <Icon name="link" size={18} color={c.accent} /><Text style={[actionText(c), { color: c.accent }]}>Join</Text>
              </Pressable>
            </View>
          </>
        )}

        {mode === 'new' && (
          <View style={{ gap: 12 }}>
            {input(name, setName, 'Family name (e.g. Kapoor Family)')}
            {input(region, setRegion, 'Region (optional)')}
            {err ? <Text style={{ color: c.danger, fontFamily: font.sans, fontSize: 13 }}>{err}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setMode('list')} style={({ pressed }) => [actionStyle(c, pressed), { flex: 1 }]}><Text style={actionText(c)}>Back</Text></Pressable>
              <Pressable onPress={doCreate} disabled={busy || !name.trim()} style={{ flex: 1, height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, opacity: busy || !name.trim() ? 0.6 : 1 }}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>Create family</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {mode === 'join' && (
          <View style={{ gap: 12 }}>
            {input(code, setCode, 'Invite code (e.g. MEHTA-7K2X)', 'characters')}
            {err ? <Text style={{ color: c.danger, fontFamily: font.sans, fontSize: 13 }}>{err}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setMode('list')} style={({ pressed }) => [actionStyle(c, pressed), { flex: 1 }]}><Text style={actionText(c)}>Back</Text></Pressable>
              <Pressable onPress={doJoin} disabled={busy || !code.trim()} style={{ flex: 1, height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, opacity: busy || !code.trim() ? 0.6 : 1 }}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>Join family</Text>}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const actionStyle = (c: ReturnType<typeof useTheme>['c'], pressed: boolean) => ({
  flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8,
  height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, transform: [{ scale: pressed ? 0.98 : 1 }],
});
const actionText = (c: ReturnType<typeof useTheme>['c']) => ({ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 14.5 });
