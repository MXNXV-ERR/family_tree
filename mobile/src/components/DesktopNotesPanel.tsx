// Notes inbox for the desktop right-drawer: thread roots (Inbox / Sent) + the
// shared NoteThreadView when one is opened. Mirrors the mobile /inbox route.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, Platform, Alert } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { Avatar } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { SheetHead, PanelScroll } from './panelChrome';
import { useUserProfile } from '../firebase/UserProfileContext';
import { useInbox } from '../firebase/useInbox';
import { deleteNote } from '../firebase/firestore';
import { myMemberId } from '../shared/permissions';
import { NoteThreadView } from './NoteThreadView';
import type { Member, Note } from '../shared/types';

const whenText = (t: unknown): string => {
  const a = t as any;
  const ms = t == null ? Date.now() : (a.toMillis?.() ?? (typeof a.seconds === 'number' ? a.seconds * 1000 : Date.now()));
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ms).toLocaleDateString();
};

export function DesktopNotesPanel({ treeId, uid, members, onClose }: {
  treeId?: string | null; uid?: string | null; members: Member[]; onClose: () => void;
}) {
  const { c } = useTheme();
  const profile = useUserProfile();
  const myId = useMemo(() => myMemberId(members, uid), [members, uid]);
  const { inbox, sent, all, unread } = useInbox(treeId, uid, myId);
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [openId, setOpenId] = useState<string | null>(null);
  const nameOf = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const myName = profile?.name || 'Someone';
  const openNote = openId ? all.find((n) => n.id === openId) ?? null : null;
  const replyCount = (id: string) => all.filter((n) => n.rootId === id).length;
  const list = tab === 'inbox' ? inbox : sent;

  const remove = (n: Note) => {
    if (!treeId) return;
    const ids = [n.id, ...all.filter((x) => x.rootId === n.id).map((x) => x.id)];
    const go = () => { ids.forEach((id) => deleteNote(treeId, id).catch(() => {})); };
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm('Delete this note and its replies?')) go(); }
    else Alert.alert('Delete note', 'Delete this note and its replies?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };

  if (openNote) {
    return <NoteThreadView root={openNote} all={all} members={members} treeId={treeId} myId={myId} uid={uid} myName={myName} onClose={() => setOpenId(null)} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="mail" title="Notes" sub={unread ? `${unread} unread` : undefined} onClose={onClose} />
      <PanelScroll contentStyle={{ padding: 16, paddingTop: 4, gap: 10 }}>
        <View style={{ flexDirection: 'row', backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, padding: 4, gap: 4 }}>
          {(['inbox', 'sent'] as const).map((t) => { const on = tab === t; return (
            <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center', backgroundColor: on ? c.accentSoft : 'transparent' }}>
              <Text style={{ color: on ? c.accent : c.inkSoft, fontFamily: font.sansSemi, textTransform: 'capitalize' }}>{t}{t === 'inbox' && unread ? ` (${unread})` : ''}</Text>
            </Pressable>
          ); })}
        </View>
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
                <View style={{ padding: 13, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Avatar m={otherM ?? { id: '_', name: plainName }} size={32} />
                    {unreadDot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} /> : null}
                    {n.theme?.seal ? <Text style={{ fontSize: 14 }}>{n.theme.seal}</Text> : null}
                    <Text numberOfLines={1} style={{ flex: 1, color: c.ink, fontFamily: font.sansBold, fontSize: 14.5 }}>{title}</Text>
                    {n.reaction ? <Text style={{ fontSize: 14 }}>{n.reaction}</Text> : null}
                    <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 10.5 }}>{whenText(n.createdAt)}</Text>
                  </View>
                  {n.text ? <Text numberOfLines={2} style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 13 }}>{n.text}</Text> : null}
                  {replies ? <Text style={{ color: c.accent, fontFamily: font.sansSemi, fontSize: 12 }}>{replies} {replies === 1 ? 'reply' : 'replies'}</Text> : null}
                </View>
              </GlassSurface>
            </Pressable>
          );
        })}
        {list.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 30, gap: 8 }}>
            <Icon name="mail" size={26} color={c.faint} />
            <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 13.5 }}>{tab === 'inbox' ? 'No notes yet.' : 'You haven’t sent any notes.'}</Text>
          </View>
        ) : null}
      </PanelScroll>
    </View>
  );
}
