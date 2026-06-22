// Family switcher panel (the design's FamilyPickerSheet). Lists every family the
// user belongs to, switches the active tree, and offers "New family" /
// "Join by invite" inline flows plus a jump to Family info. Used by the mobile
// header sheet and the desktop switcher dropdown.
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Platform } from 'react-native';
import { useTheme, font, radius } from '../theme/theme';
import { useAuth } from '../firebase/AuthContext';
import { useFamily } from '../firebase/FamilyContext';
import { useFamilyTree } from '../firebase/useFamilyTree';
import { createFamily, requestToJoinFamily, monoOf } from '../firebase/families';
import { claimMember } from '../firebase/firestore';
import { useUserProfile } from '../firebase/UserProfileContext';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/primitives';
import { SheetHead } from './panelChrome';
import type { FamilyTree } from '../shared/types';

type Mode = 'list' | 'new' | 'join' | 'claim';

export function FamilyPickerPanel({ onClose, onOpenInfo }: { onClose: () => void; onOpenInfo: () => void }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const profile = useUserProfile();
  const { families, activeTreeId, setActiveTreeId } = useFamily();
  const { members, treeMetadata } = useFamilyTree(activeTreeId);

  // The membership index can be empty (e.g. multi-family rules not deployed yet)
  // even though the user clearly has an active tree. Always surface at least the
  // current family so the switcher is never an empty, confusing list.
  const shownFamilies: FamilyTree[] = families.length
    ? families
    : activeTreeId
      ? [{
          id: activeTreeId,
          name: treeMetadata?.name ?? 'My Family',
          mono: (treeMetadata as any)?.mono ?? monoOf(treeMetadata?.name ?? 'F'),
          color: (treeMetadata as any)?.color ?? c.accent,
          role: 'owner',
          ownerUid: user?.uid ?? '',
        } as FamilyTree]
      : [];
  const [mode, setMode] = useState<Mode>('list');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [code, setCode] = useState('');
  const [joinMsg, setJoinMsg] = useState<string | null>(null);

  const switchTo = (id: string) => { setActiveTreeId(id); onClose(); };

  async function doCreate() {
    if (!user || !name.trim()) return;
    setBusy(true); setErr(null);
    try {
      const id = await createFamily(user.uid, user.email, { name: name.trim(), region: region.trim(), colorIndex: families.length });
      setActiveTreeId(id); onClose();
    } catch (e: any) {
      console.error('doCreate', e);
      setErr(e?.message || 'Could not create family. Check your connection / rules.');
    }
    finally { setBusy(false); }
  }

  async function doJoin() {
    if (!user || !code.trim()) return;
    setBusy(true); setErr(null); setJoinMsg(null);
    try {
      const res = await requestToJoinFamily(user.uid, user.email, code.trim());
      if (!res) { setErr('No family found for that invite code.'); return; }
      if (res.status === 'joined') {
        // Open-policy family — joined instantly; offer to claim a node.
        setActiveTreeId(res.treeId); setCode(''); setMode('claim');
      } else {
        // Approval-policy family — request sent, awaiting owner/admin approval.
        setCode(''); setJoinMsg('Request sent — an owner or admin needs to approve it before you get access.');
      }
    } catch (e) { setErr('Could not join. Check the code and your rules.'); }
    finally { setBusy(false); }
  }

  // Link the signed-in user to a member node ("this is me") right after joining.
  async function doClaim(memberId: string) {
    if (!user || !activeTreeId) return;
    setBusy(true); setErr(null);
    try { await claimMember(activeTreeId, memberId, user.uid); onClose(); }
    catch (e) { setErr('Could not set that as you. Ask the family owner.'); }
    finally { setBusy(false); }
  }

  const input = (value: string, set: (v: string) => void, placeholder: string, autoCap: 'characters' | 'sentences' = 'sentences') => (
    <TextInput value={value} onChangeText={set} placeholder={placeholder} placeholderTextColor={c.mute} autoCapitalize={autoCap}
      style={{ height: 48, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.ink, fontFamily: font.sansMed, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
  );

  const headSub = mode === 'new' ? 'Start a new tree you own' : mode === 'join' ? 'Enter an invite code'
    : mode === 'claim' ? 'Pick the person that is you' : 'Switch between the trees you belong to';
  // Rank unclaimed members by how well their name matches the joining user, so
  // the likely "this is me" node floats to the top and gets a hint.
  const myName = (profile?.name ?? user?.displayName ?? user?.email?.split('@')[0] ?? '').trim().toLowerCase();
  const nameScore = (n: string) => {
    const a = n.trim().toLowerCase();
    if (!myName || !a) return 0;
    if (a === myName) return 3;
    if (a.includes(myName) || myName.includes(a)) return 2;
    const af = a.split(/\s+/)[0], mf = myName.split(/\s+/)[0];
    return af && af === mf ? 1 : 0;
  };
  const unclaimed = members
    .filter((m) => !m.associatedUserId)
    .map((m) => ({ m, s: nameScore(m.name) }))
    .sort((a, b) => b.s - a.s || a.m.name.localeCompare(b.m.name));
  const suggestedId = (unclaimed[0]?.s ?? 0) >= 2 ? unclaimed[0].m.id : null;

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="users" title="Your families" sub={headSub} onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10 }}>
        {mode === 'list' && (
          <>
            {shownFamilies.map((f) => {
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
            {joinMsg ? <Text style={{ color: c.accent, fontFamily: font.sansSemi, fontSize: 13 }}>{joinMsg}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setMode('list')} style={({ pressed }) => [actionStyle(c, pressed), { flex: 1 }]}><Text style={actionText(c)}>Back</Text></Pressable>
              <Pressable onPress={doJoin} disabled={busy || !code.trim()} style={{ flex: 1, height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, opacity: busy || !code.trim() ? 0.6 : 1 }}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>Join family</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {mode === 'claim' && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 13.5, lineHeight: 20 }}>
              You're in. Which person are you? Pick your node to get the “You” badge — or just browse the tree.
            </Text>
            {unclaimed.map(({ m }) => {
              const suggested = m.id === suggestedId;
              return (
                <Pressable key={m.id} onPress={() => doClaim(m.id)} disabled={busy} style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, borderRadius: radius.lg,
                  backgroundColor: suggested ? c.accentSoft : c.paper, borderWidth: 1.5, borderColor: suggested ? c.accent : c.line,
                  opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }],
                })}>
                  <Avatar m={m} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 15 }}>{m.name}</Text>
                    {suggested ? <Text style={{ color: c.accent, fontFamily: font.sansSemi, fontSize: 11.5, marginTop: 1 }}>Likely you</Text> : null}
                  </View>
                  <Icon name="chevR" size={18} color={suggested ? c.accent : c.faint} />
                </Pressable>
              );
            })}
            {unclaimed.length === 0 ? (
              <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 13, textAlign: 'center', paddingVertical: 8 }}>No unclaimed people to pick yet.</Text>
            ) : null}
            {err ? <Text style={{ color: c.danger, fontFamily: font.sans, fontSize: 13 }}>{err}</Text> : null}
            <Pressable onPress={onClose} style={({ pressed }) => actionStyle(c, pressed)}>
              <Icon name="check" size={18} color={c.inkSoft} /><Text style={actionText(c)}>Just view</Text>
            </Pressable>
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
