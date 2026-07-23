// The opened note: the ROOT renders as the full note card (with the sender's
// reveal animation, seal, subject, effect + soft ambient background); its REPLIES
// appear as a thread of chat bubbles below, with an in-thread reply box. Per-
// message reactions show the reactor's name. Shared by the full-screen inbox
// overlay and the desktop drawer (`fullscreen` adds the cinematic reveal +
// ambient-sky movement, which only runs where no visualizer is mounted).
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Image, ScrollView, Animated, Easing, Platform } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { GlassSurface } from '../theme/GlassSurface';
import { Icon } from '../ui/Icon';
import { useAmbientMotion } from '../ui/AmbientMotion';
import { addNote, setNoteReaction, markNoteRead, deleteNote } from '../firebase/firestore';
import { pickRawImage, compressUri } from '../shared/photo';
import { NoteEffect, NoteAmbient } from './NoteEffects';
import type { Member, Note } from '../shared/types';

const REACTIONS = ['❤️', '👍', '😂', '🎉', '🙏'];
const tsMs = (t: unknown): number => { const a = t as any; return t == null ? Number.MAX_SAFE_INTEGER : (a.toMillis?.() ?? (typeof a.seconds === 'number' ? a.seconds * 1000 : 0)); };

function revealStyle(reveal: string | undefined, a: any, H: number) {
  const opacity = a.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] });
  switch (reveal) {
    case 'envelope': return { opacity, transform: [{ perspective: 1000 }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }, { rotateX: a.interpolate({ inputRange: [0, 1], outputRange: ['-105deg', '0deg'] }) }] };
    case 'flip': return { opacity, transform: [{ perspective: 1000 }, { rotateY: a.interpolate({ inputRange: [0, 1], outputRange: ['-92deg', '0deg'] }) }] };
    case 'curtain': return { opacity, transform: [{ scaleX: a.interpolate({ inputRange: [0, 1], outputRange: [0.02, 1] }) }] };
    case 'scroll': return { opacity, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-H * 0.4, 0] }) }, { scaleY: a.interpolate({ inputRange: [0, 1], outputRange: [0.02, 1] }) }] };
    case 'zoom': return { opacity, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }] };
    case 'unfold':
    default: return { opacity, transform: [{ perspective: 900 }, { scaleY: a.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] }) }, { rotateX: a.interpolate({ inputRange: [0, 1], outputRange: ['-40deg', '0deg'] }) }] };
  }
}

export function NoteThreadView({ root, all, members, treeId, myId, uid, myName, onClose, fullscreen }: {
  root: Note; all: Note[]; members: Member[]; treeId?: string | null; myId?: string; uid?: string | null; myName: string;
  onClose: () => void; fullscreen?: boolean;
}) {
  const { c, mode } = useTheme();
  const { motion } = useSettings();
  const am = useAmbientMotion();
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const nameOf = (id?: string) => (id ? memberById.get(id)?.name : undefined);

  const replies = useMemo(() => all.filter((n) => n.rootId === root.id).sort((a, b) => tsMs(a.createdAt) - tsMs(b.createdAt)), [all, root.id]);

  const accent = root.theme?.color || c.accent;
  const reveal = root.theme?.reveal || 'unfold';
  const openAnim = useRef(new Animated.Value(0)).current;
  const [effectKey, setEffectKey] = useState(0);

  // Reveal: clear foreground (delay) → play; drive the ambient sky per reveal.
  useEffect(() => {
    setEffectKey((k) => k + 1);
    if (!motion) { openAnim.setValue(1); return; }
    openAnim.setValue(0);
    Animated.timing(openAnim, { toValue: 1, duration: 1400, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }).start();
    if (fullscreen && am) {
      if (reveal === 'zoom' || reveal === 'scroll') am.nudgeZoom(1, reveal === 'zoom' ? 4 : 3);
      else if (reveal === 'envelope') am.nudgeZoom(-1, 3);
      else if (reveal === 'curtain') am.setLayoutPos(0.5);
      else if (reveal === 'flip') am.setLayoutPos(-0.5);
      else am.nudgeZoom(1, 2);
    }
    return () => { if (fullscreen && am) { am.resetZoom(); am.setLayoutPos(0); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root.id, motion]);

  useEffect(() => {
    if (!treeId) return;
    [root, ...replies].forEach((n) => { if (n.toMemberId === myId && !n.read) markNoteRead(treeId, n.id).catch(() => {}); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replies.length]);

  // Reply goes to the OTHER participant. Derive by uid (always known) so the box
  // shows for BOTH the sender (→ recipient node) and the receiver (→ sender node).
  const iAmSender = !!uid && root.fromUid === uid;
  const iAmRecipient = !iAmSender;
  const otherMemberId = iAmSender ? root.toMemberId : root.fromMemberId;
  const otherUid = iAmSender ? root.toUid : root.fromUid;

  const [reply, setReply] = useState('');
  const [replyImg, setReplyImg] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setReply(''); setReplyImg(undefined); }, [root.id]);

  const pickImg = async () => { const raw = await pickRawImage(); if (!raw) return; setBusy(true); try { setReplyImg(await compressUri(raw.uri, raw.base64)); } finally { setBusy(false); } };
  const canReply = !!treeId && !!uid && !!otherMemberId && (!!reply.trim() || !!replyImg) && !busy;
  const sendReply = async () => {
    if (!treeId || !uid || !otherMemberId) return;
    if (!reply.trim() && !replyImg) return;
    await addNote(treeId, {
      rootId: root.id, toMemberId: otherMemberId, toUid: otherUid ?? '', fromUid: uid,
      fromName: myName, ...(myId ? { fromMemberId: myId } : {}), ...(reply.trim() ? { text: reply.trim() } : {}), ...(replyImg ? { image: replyImg } : {}),
    }).catch(() => {});
    setReply(''); setReplyImg(undefined);
  };

  const removeThread = () => {
    if (!treeId) return;
    const go = () => { [root, ...replies].forEach((n) => deleteNote(treeId, n.id).catch(() => {})); onClose(); };
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm('Delete this note and its replies?')) go(); }
    else go();
  };

  const reactorName = (n: Note) => (n.toMemberId === myId ? 'You' : (nameOf(n.toMemberId) || 'They'));
  const ReactionArea = ({ n }: { n: Note }) => {
    const canReact = n.toMemberId === myId;
    return (
      <View style={{ gap: 6 }}>
        {n.reaction ? <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12 }}>{reactorName(n)} reacted <Text style={{ fontSize: 15 }}>{n.reaction}</Text></Text> : null}
        {canReact ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {REACTIONS.map((e) => { const on = n.reaction === e; return (
              <Pressable key={e} onPress={() => { if (treeId) setNoteReaction(treeId, n.id, on ? '' : e).catch(() => {}); }}
                style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: on ? accent : c.line, backgroundColor: on ? c.accentSoft : 'transparent' }}>
                <Text style={{ fontSize: 17 }}>{e}</Text>
              </Pressable>
            ); })}
          </View>
        ) : null}
      </View>
    );
  };

  const glassBg = mode === 'dark' ? 'rgba(12,10,24,0.30)' : 'rgba(255,255,255,0.26)';
  const rootAuthor = root.fromUid === uid ? 'You' : (root.fromName || nameOf(root.fromMemberId) || 'Someone');

  // Staged entrance so it doesn't read as a "reload": scrim fades in first (the
  // moving sky shows through), then the card reveals, then the effect + ambient
  // ramp in gently, then the chrome (header / reply box) fades in.
  const scrimOpacity = openAnim.interpolate({ inputRange: [0, 0.28], outputRange: [0, 1], extrapolate: 'clamp' });
  const cardAnim = openAnim.interpolate({ inputRange: [0.14, 0.74], outputRange: [0, 1], extrapolate: 'clamp' });
  const fxOpacity = openAnim.interpolate({ inputRange: [0.32, 0.68], outputRange: [0, 1], extrapolate: 'clamp' });
  const chromeOpacity = openAnim.interpolate({ inputRange: [0.55, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable onPress={onClose} hitSlop={8}><Icon name={fullscreen ? 'close' : 'back'} size={fullscreen ? 24 : 20} color={fullscreen ? c.ink : c.accent} /></Pressable>
      {root.theme?.seal ? <Text style={{ fontSize: 20 }}>{root.theme.seal}</Text> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansBold, fontSize: 16 }}>{root.subject || (iAmRecipient ? rootAuthor : `To ${nameOf(root.toMemberId) || 'someone'}`)}</Text>
        <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>{replies.length ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : 'Note'}</Text>
      </View>
      <Pressable onPress={removeThread} hitSlop={8}><Icon name="trash" size={18} color={c.mute} /></Pressable>
    </View>
  );

  const body = (
    <>
      {root.theme?.seal ? (
        <Animated.View style={{ alignItems: 'center', opacity: cardAnim, transform: [{ scale: cardAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 1.15, 1] }) }] }}>
          <Pressable onPress={() => setEffectKey((k) => k + 1)} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', shadowColor: accent, shadowOpacity: 0.5, shadowRadius: 14 }}>
            <Text style={{ fontSize: 27 }}>{root.theme.seal}</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {/* ROOT = the note itself, with the reveal animation */}
      <Animated.View style={revealStyle(reveal, cardAnim, 620) as any}>
        <GlassSurface rounded={radius.xl} intensity={22} style={{ backgroundColor: glassBg, borderColor: accent, borderWidth: 1.5 }}>
          <View style={{ padding: 18, gap: 12 }}>
            {root.subject ? <Text style={{ color: c.ink, fontFamily: font.serifItalic, fontSize: 22 }}>{root.subject}</Text> : null}
            <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>{rootAuthor}</Text>
            {root.text ? <Text style={{ color: c.ink, fontFamily: font.sans, fontSize: 16, lineHeight: 25 }}>{root.text}</Text> : null}
            {root.image ? <Image source={{ uri: root.image }} style={{ width: '100%', height: 280, borderRadius: radius.md, backgroundColor: c.paper2 }} resizeMode="contain" /> : null}
            <ReactionArea n={root} />
          </View>
        </GlassSurface>
      </Animated.View>

      {/* REPLIES = the thread */}
      {replies.length ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', marginLeft: 2 }}>Thread</Text>
          {replies.map((n) => {
            const mine = n.fromUid === uid;
            const author = mine ? 'You' : (n.fromName || nameOf(n.fromMemberId) || 'Someone');
            return (
              <View key={n.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}>
                <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 10.5, marginHorizontal: 4 }}>{author}</Text>
                <View style={{ maxWidth: '86%', borderRadius: radius.lg, borderWidth: 1, borderColor: mine ? accent : c.line, backgroundColor: mine ? c.accentSoft : c.paper, padding: 11, gap: 8 }}>
                  {n.text ? <Text style={{ color: c.ink, fontFamily: font.sans, fontSize: 14.5, lineHeight: 21 }}>{n.text}</Text> : null}
                  {n.image ? <Image source={{ uri: n.image }} style={{ width: 200, maxWidth: '100%', height: 180, borderRadius: radius.md, backgroundColor: c.paper2 }} resizeMode="cover" /> : null}
                </View>
                <ReactionArea n={n} />
              </View>
            );
          })}
        </View>
      ) : null}
    </>
  );

  const replyBar = (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
      <Pressable onPress={pickImg} disabled={!otherMemberId} hitSlop={6} style={{ width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: replyImg ? accent : c.line, alignItems: 'center', justifyContent: 'center', opacity: otherMemberId ? 1 : 0.5 }}><Icon name="image" size={18} color={replyImg ? accent : c.mute} /></Pressable>
      <TextInput value={reply} onChangeText={setReply} editable={!!otherMemberId} placeholder={otherMemberId ? 'Reply…' : 'Can’t reply — they haven’t claimed a profile'} placeholderTextColor={c.mute} multiline
        style={{ flex: 1, minHeight: 44, maxHeight: 110, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.ink, paddingHorizontal: 12, paddingVertical: 10, fontFamily: font.sansMed, fontSize: 14, textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
      <Pressable disabled={!canReply} onPress={sendReply} style={{ width: 48, height: 44, borderRadius: radius.md, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', opacity: canReply ? 1 : 0.5 }}><Icon name="send" size={18} color={c.accentInk} /></Pressable>
    </View>
  );

  if (fullscreen) {
    const scrimBg = mode === 'dark' ? 'rgba(8,6,18,0.42)' : 'rgba(244,243,252,0.42)';
    return (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: scrimOpacity }}>
          <GlassSurface rounded={0} bordered={false} intensity={55} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: scrimBg }} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: fxOpacity }}>
          <NoteAmbient effect={root.theme?.effect} emoji={root.theme?.seal} />
        </Animated.View>
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <Animated.View style={{ opacity: chromeOpacity }}>{header}</Animated.View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 10 }}>
            {body}
            <Animated.View style={{ marginTop: 6, opacity: chromeOpacity }}>{replyBar}</Animated.View>
          </ScrollView>
        </View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: fxOpacity }}>
          <NoteEffect effect={root.theme?.effect} color={root.theme?.color} emoji={root.theme?.seal} playKey={effectKey} />
        </Animated.View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>{header}</View>
      <View style={{ flex: 1 }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: fxOpacity }}>
          <NoteAmbient effect={root.theme?.effect} emoji={root.theme?.seal} />
        </Animated.View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14 }}>
          {body}
          <Animated.View style={{ marginTop: 6, opacity: chromeOpacity }}>{replyBar}</Animated.View>
        </ScrollView>
      </View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: fxOpacity }}>
        <NoteEffect effect={root.theme?.effect} color={root.theme?.color} emoji={root.theme?.seal} playKey={effectKey} />
      </Animated.View>
    </View>
  );
}
