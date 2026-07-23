// Inbox — note threads sent to you (Inbox) and started by you (Sent). Reachable
// from Home. Rows are thread ROOTS; opening one shows the full thread + reply in
// the shared NoteThreadView (over the ambient sky).
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Platform, Alert, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/firebase/AuthContext';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useInbox } from '../src/firebase/useInbox';
import { useUserProfile } from '../src/firebase/UserProfileContext';
import { deleteNote } from '../src/firebase/firestore';
import { myMemberId } from '../src/shared/permissions';
import { safeBack } from '../src/shared/nav';
import { useTheme, radius, font } from '../src/theme/theme';
import { useSettings } from '../src/theme/SettingsContext';
import { GlassSurface } from '../src/theme/GlassSurface';
import { Icon } from '../src/ui/Icon';
import { Avatar } from '../src/ui/primitives';
import { NoteThreadView } from '../src/components/NoteThreadView';
import type { Note } from '../src/shared/types';

type Tab = 'inbox' | 'sent';

const whenText = (t: unknown): string => {
  const anyT = t as any;
  const ms = t == null ? Date.now() : (anyT.toMillis?.() ?? (typeof anyT.seconds === 'number' ? anyT.seconds * 1000 : Date.now()));
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ms).toLocaleDateString();
};

export default function Inbox() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { activeTreeId } = useFamily();
  const router = useRouter();
  const { members } = useFamilyTree(activeTreeId);
  const profile = useUserProfile();
  const myId = useMemo(() => myMemberId(members, user?.uid), [members, user]);
  const { inbox, sent, all, unread } = useInbox(activeTreeId, user?.uid, myId);
  const [tab, setTab] = useState<Tab>('inbox');
  const [openId, setOpenId] = useState<string | null>(null);
  const nameOf = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const myName = profile?.name || user?.email?.split('@')[0] || 'Someone';
  const { motion } = useSettings();
  const listFade = useRef(new Animated.Value(1)).current;
  // Fade the inbox list out while a note is open (so it doesn't show behind the
  // note's translucent scrim), and back in when the note closes.
  useEffect(() => {
    if (!motion) { listFade.setValue(openId ? 0 : 1); return; }
    Animated.timing(listFade, { toValue: openId ? 0 : 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [openId, motion]);

  const list = tab === 'inbox' ? inbox : sent;
  const openNote = openId ? all.find((n) => n.id === openId) ?? null : null;
  const replyCount = (id: string) => all.filter((n) => n.rootId === id).length;

  const remove = (n: Note) => {
    if (!activeTreeId) return;
    const ids = [n.id, ...all.filter((x) => x.rootId === n.id).map((x) => x.id)];
    const go = () => { ids.forEach((id) => deleteNote(activeTreeId, id).catch(() => {})); };
    const msg = 'Delete this note and its replies?';
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm(msg)) go(); }
    else Alert.alert('Delete note', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <Animated.View style={{ flex: 1, opacity: listFade }} pointerEvents={openId ? 'none' : 'auto'}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Pressable onPress={() => safeBack(router)} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="back" size={18} color={c.accent} />
            <Text style={{ color: c.accent, fontWeight: '600' }}>Back</Text>
          </View>
        </Pressable>

        <Text style={{ color: c.ink, fontFamily: font.serifItalic, fontSize: 27, marginBottom: 14 }}>Notes</Text>

        <View style={{ flexDirection: 'row', backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, padding: 4, marginBottom: 14, gap: 4 }}>
          {(['inbox', 'sent'] as Tab[]).map((t) => {
            const on = tab === t;
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center', backgroundColor: on ? c.accentSoft : 'transparent' }}>
                <Text style={{ color: on ? c.accent : c.inkSoft, fontFamily: font.sansSemi, textTransform: 'capitalize' }}>{t}{t === 'inbox' && unread ? ` (${unread})` : ''}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 10 }}>
          {list.map((n) => {
            const mine = n.toMemberId === myId;
            const plainName = mine ? (n.fromName || 'Someone') : (nameOf.get(n.toMemberId) || 'someone');
            const title = n.subject || (mine ? plainName : `To ${plainName}`);
            const otherId = mine ? n.fromMemberId : n.toMemberId;
            const otherM = otherId ? memberById.get(otherId) : undefined;
            const unreadDot = mine && !n.read;
            const replies = replyCount(n.id);
            return (
              <Pressable key={n.id} onPress={() => setOpenId(n.id)}>
                <GlassSurface rounded={radius.lg}>
                  <View style={{ padding: 14, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Avatar m={otherM ?? { id: '_', name: plainName }} size={34} />
                      {unreadDot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} /> : null}
                      {n.theme?.seal ? <Text style={{ fontSize: 15 }}>{n.theme.seal}</Text> : null}
                      <Text numberOfLines={1} style={{ flex: 1, color: c.ink, fontFamily: font.sansBold, fontSize: 15 }}>{title}</Text>
                      {n.reaction ? <Text style={{ fontSize: 15 }}>{n.reaction}</Text> : null}
                      <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>{whenText(n.createdAt)}</Text>
                      <Pressable onPress={() => remove(n)} hitSlop={8}><Icon name="trash" size={15} color={c.mute} /></Pressable>
                    </View>
                    {n.text ? <Text numberOfLines={2} style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 14, lineHeight: 20 }}>{n.text}</Text> : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {n.image ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="image" size={13} color={c.mute} /><Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12 }}>Photo</Text></View> : null}
                      {replies ? <Text style={{ color: c.accent, fontFamily: font.sansSemi, fontSize: 12 }}>{replies} {replies === 1 ? 'reply' : 'replies'}</Text> : null}
                    </View>
                  </View>
                </GlassSurface>
              </Pressable>
            );
          })}
          {list.length === 0 ? (
            <GlassSurface rounded={radius.lg}>
              <View style={{ alignItems: 'center', padding: 40, gap: 10 }}>
                <Icon name="mail" size={30} color={c.faint} />
                <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 14, textAlign: 'center' }}>
                  {tab === 'inbox' ? 'No notes yet.' : 'You haven’t sent any notes.'}
                </Text>
              </View>
            </GlassSurface>
          ) : null}
        </View>
      </ScrollView>
      </Animated.View>

      {openNote ? (
        <NoteThreadView root={openNote} all={all} members={members} treeId={activeTreeId} myId={myId} uid={user?.uid} myName={myName} onClose={() => setOpenId(null)} fullscreen />
      ) : null}
    </View>
  );
}
