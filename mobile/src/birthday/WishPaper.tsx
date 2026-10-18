// A wish opens (SPEC §4 step 6). The tapped token ZOOMS INTO the polaroid —
// same image, thumbnail → paper, not a screen change — so the card grows out of
// wherever the token sat. Neighbouring wishes peek at 40% so swiping needs no
// tutorial.
//
// Reactions are the app's existing five, inside the paper only. Reply is a short
// private message that lands in the existing chat thread with that sender (a
// normal reply note), never on the wall; afterwards the paper shows a violet
// "Replied" chip and the token gains its tick.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, Image, ScrollView, TextInput, Animated, Easing,
  useWindowDimensions, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/primitives';
import { addNote, markWishRead, markWishReplied, setNoteReaction } from '../firebase/firestore';
import { mediaKind, isRead } from '../shared/birthday';
import { relToMe } from '../shared/relationTo';
import { senderMember, relChip, whenWord } from './model';
import * as haptics from './haptics';
import type { Member, Note, Relationship } from '../shared/types';

// 🥹 renders as tofu on Windows Chrome — keep every reaction to glyphs that
// ship in the default emoji font everywhere.
const REACTIONS = ['❤️', '🎉', '😂', '🙏', '😊'];

const PAPER = '#fffdf8';
const PAPER_INK = '#241f2e';
const PAPER_META = '#867d95';

// Google Drive share links preview at /preview — the only embed that works.
function drivePreview(url: string): string | null {
  const m = /drive\.google\.com\/file\/d\/([^/]+)/.exec(url) || /[?&]id=([^&]+)/.exec(url);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
}

export function WishPaper({
  wishes, openId, onClose, members, relationships, celebrantId, treeId, uid, myMemberId, myName, origin,
}: {
  wishes: Note[];
  openId: string;
  onClose: () => void;
  members: Member[];
  relationships: Relationship[];
  celebrantId: string;
  treeId?: string | null;
  uid?: string | null;
  myMemberId?: string | null;
  myName: string;
  /** Screen-space centre of the tapped token — the paper grows out of it. */
  origin?: { x: number; y: number };
}) {
  const { c } = useTheme();
  const { motion } = useSettings();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(() => Math.max(0, wishes.findIndex((w) => w.id === openId)));
  const scroller = useRef<ScrollView>(null);
  const zoom = useRef(new Animated.Value(motion ? 0 : 1)).current;

  const cardW = Math.min(width * 0.82, 420);
  const gap = 12;
  const side = (width - cardW) / 2;

  // zoom-in from the token's position
  useEffect(() => {
    if (!motion) { zoom.setValue(1); return; }
    Animated.timing(zoom, { toValue: 1, duration: 420, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }).start();
  }, [motion]);

  // Opening marks read — dims the token and cools its link in place.
  useEffect(() => {
    const w = wishes[index];
    if (!w || !treeId || isRead(w)) return;
    if (w.toMemberId !== celebrantId) return;     // only the celebrant marks read
    markWishRead(treeId, w.id).catch(() => {});
  }, [index, wishes, treeId, celebrantId]);

  useEffect(() => {
    const i = wishes.findIndex((w) => w.id === openId);
    if (i >= 0) {
      setIndex(i);
      requestAnimationFrame(() => scroller.current?.scrollTo({ x: i * (cardW + gap), animated: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, cardW]);

  const close = () => {
    if (!motion) { onClose(); return; }
    Animated.timing(zoom, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  const originX = (origin?.x ?? width / 2) - width / 2;
  const originY = (origin?.y ?? height / 2) - height / 2;

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <Pressable onPress={close} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,6,17,0.72)' }} />

      <Animated.View
        pointerEvents="box-none"
        style={{
          flex: 1, justifyContent: 'center',
          opacity: zoom,
          transform: [
            { translateX: zoom.interpolate({ inputRange: [0, 1], outputRange: [originX, 0] }) },
            { translateY: zoom.interpolate({ inputRange: [0, 1], outputRange: [originY, 0] }) },
            { scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [0.18, 1] }) },
          ],
        }}>
        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardW + gap}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: side, gap, alignItems: 'center' }}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (cardW + gap)))}>
          {wishes.map((w, i) => (
            // A long wish (photo + several lines + reactions + reply) is taller
            // than the viewport. Bound each card to the frame and let it scroll
            // inside, or the top of the paper is simply cut off with no way back.
            <ScrollView
              key={w.id}
              style={{ width: cardW, maxHeight: height - 150, opacity: i === index ? 1 : 0.4 }}
              contentContainerStyle={{ paddingVertical: 2 }}
              showsVerticalScrollIndicator={false}>
              <PaperCard
                wish={w}
                members={members}
                relationships={relationships}
                celebrantId={celebrantId}
                treeId={treeId}
                uid={uid}
                myMemberId={myMemberId}
                myName={myName}
                canReact={w.toMemberId === celebrantId}
              />
            </ScrollView>
          ))}
        </ScrollView>

        {/* The close button used to sit on the card's own top-right corner. Park
            it in the frame's corner, on its own solid chip, so it never reads as
            part of the paper. */}
        <Pressable onPress={close} hitSlop={10} style={{
          position: 'absolute', top: Platform.OS === 'web' ? 14 : 48, right: 14,
          width: 40, height: 40, borderRadius: 20,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(8,6,17,0.86)', borderWidth: 1, borderColor: c.glassBrd,
        }}>
          <Icon name="close" size={18} color={c.ink} />
        </Pressable>

        {wishes.length > 1 ? (
          <View style={{ position: 'absolute', bottom: Platform.OS === 'web' ? 18 : 40, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
            {wishes.map((w, i) => (
              <View key={w.id} style={{ width: i === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? c.gold : c.faint }} />
            ))}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function PaperCard({ wish, members, relationships, celebrantId, treeId, uid, myMemberId, myName, canReact }: {
  wish: Note; members: Member[]; relationships: Relationship[]; celebrantId: string;
  treeId?: string | null; uid?: string | null; myMemberId?: string | null; myName: string; canReact: boolean;
}) {
  const { c } = useTheme();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [replied, setReplied] = useState(!!wish.repliedAt);

  const sender = useMemo(() => senderMember(wish, members), [wish, members]);
  const rel = useMemo(
    () => relChip(sender ? relToMe(members, relationships, sender.id, celebrantId) : undefined),
    [sender, members, relationships, celebrantId],
  );
  const kind = mediaKind(wish);
  const sticker = wish.wish?.sticker;
  const preview = kind === 'video' && wish.wish?.videoUrl ? drivePreview(wish.wish.videoUrl) : null;

  const react = (emoji: string) => {
    if (!treeId || !canReact) return;
    haptics.press();
    setNoteReaction(treeId, wish.id, wish.reaction === emoji ? '' : emoji).catch(() => {});
  };

  // The reply is a normal reply note in the existing thread — never on the wall.
  const sendReply = async () => {
    if (!treeId || !uid || !reply.trim() || !sender) return;
    setSending(true);
    try {
      await addNote(treeId, {
        toMemberId: sender.id,
        toUid: wish.fromUid,
        fromUid: uid,
        fromName: myName,
        ...(myMemberId ? { fromMemberId: myMemberId } : {}),
        text: reply.trim(),
        rootId: wish.id,
      });
      await markWishReplied(treeId, wish.id).catch(() => {});
      setReplied(true);
      setReplying(false);
      setReply('');
    } finally { setSending(false); }
  };

  return (
    <View style={{ backgroundColor: PAPER, borderRadius: radius.lg, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 12 }}>
      {/* media */}
      {kind === 'photo' && wish.image ? (
        <View>
          <Image source={{ uri: wish.image }} style={{ width: '100%', height: 210, backgroundColor: '#e7e2d8' }} resizeMode="cover" />
          {sticker ? (
            // the sender's sticker sits on the photo as a physical sticker would
            <View style={{ position: 'absolute', right: 12, bottom: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}>
              <Text style={{ fontSize: 17 }}>{sticker}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {kind === 'video' ? (
        <VideoBlock url={wish.wish?.videoUrl ?? ''} preview={preview} sticker={sticker} />
      ) : null}

      <View style={{ padding: 18, gap: 14 }}>
        {wish.subject ? (
          <Text style={{ color: PAPER_INK, fontFamily: font.serif, fontSize: 20 }}>{wish.subject}</Text>
        ) : null}
        {wish.text ? (
          <Text style={{ color: PAPER_INK, fontFamily: font.serifMed, fontSize: 17.5, lineHeight: 26 }}>{wish.text}</Text>
        ) : null}
        {!wish.text && kind === 'none' && sticker ? (
          <Text style={{ fontSize: 46, textAlign: 'center' }}>{sticker}</Text>
        ) : null}

        {/* sender footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(36,31,46,0.1)', paddingTop: 12 }}>
          <Avatar m={sender ?? { id: '_', name: wish.fromName ?? 'Someone' }} size={34} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: PAPER_INK, fontFamily: font.sansBold, fontSize: 14.5 }}>
              {(sender?.name ?? wish.fromName ?? 'Someone').split(' ')[0]}
            </Text>
            <Text numberOfLines={1} style={{ color: PAPER_META, fontFamily: font.mono, fontSize: 11 }}>
              {[rel, whenWord(wish.createdAt)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {replied ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(109,78,224,0.12)' }}>
              <Icon name="check" size={12} stroke={2.6} color="#6b52c8" />
              <Text style={{ color: '#6b52c8', fontFamily: font.sansSemi, fontSize: 11.5 }}>Replied</Text>
            </View>
          ) : null}
        </View>

        {/* reactions — inside the paper only, never in chrome */}
        {canReact ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {REACTIONS.map((e) => {
              const on = wish.reaction === e;
              return (
                <Pressable key={e} onPress={() => react(e)} style={{
                  width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? 'rgba(255,206,107,0.28)' : 'rgba(36,31,46,0.05)',
                  borderWidth: 1.5, borderColor: on ? '#e0a23c' : 'transparent',
                }}>
                  <Text style={{ fontSize: 18 }}>{e}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* reply → the existing chat thread with that sender */}
        {canReact && sender ? (
          replying ? (
            <View style={{ gap: 10 }}>
              <TextInput
                value={reply} onChangeText={setReply} autoFocus multiline
                placeholder={`Reply privately to ${(sender.name ?? '').split(' ')[0]}…`}
                placeholderTextColor={PAPER_META}
                style={{
                  minHeight: 76, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(36,31,46,0.14)',
                  padding: 12, color: PAPER_INK, fontFamily: font.sansMed, fontSize: 14.5, textAlignVertical: 'top',
                  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null),
                }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => setReplying(false)} style={{ paddingHorizontal: 14, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: PAPER_META, fontFamily: font.sansSemi, fontSize: 14 }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={sendReply} disabled={!reply.trim() || sending} style={{ flex: 1, height: 42, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6b52c8', opacity: !reply.trim() || sending ? 0.5 : 1 }}>
                  {sending ? <ActivityIndicator color="#fff" /> : <><Icon name="send" size={16} color="#fff" /><Text style={{ color: '#fff', fontFamily: font.sansBold, fontSize: 14 }}>Send privately</Text></>}
                </Pressable>
              </View>
              <Text style={{ color: PAPER_META, fontFamily: font.sans, fontSize: 11.5 }}>
                Goes to your notes thread with {(sender.name ?? '').split(' ')[0]} — never onto the wall.
              </Text>
            </View>
          ) : (
            <Pressable onPress={() => setReplying(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: 'rgba(107,82,200,0.4)' }}>
              <Icon name="mail" size={16} color="#6b52c8" />
              <Text style={{ color: '#6b52c8', fontFamily: font.sansBold, fontSize: 14 }}>{replied ? 'Reply again' : 'Reply'}</Text>
            </Pressable>
          )
        ) : null}
      </View>
    </View>
  );
}

// Never a broken player (SPEC §4 step 6). A Drive embed can fail for reasons the
// page cannot see across origins — the link is private, the id is wrong, Drive
// refuses to frame it — and an auto-embed then renders Google's own error page
// inside the keepsake. So the paper shows a poster first: the viewer opts into
// the inline player, and "Open in Drive" is always one tap away.
function VideoBlock({ url, preview, sticker }: { url: string; preview: string | null; sticker?: string }) {
  const [playing, setPlaying] = useState(false);
  const canEmbed = Platform.OS === 'web' && !!preview;

  if (playing && canEmbed) {
    return (
      <View style={{ width: '100%', backgroundColor: '#000' }}>
        <View style={{ width: '100%', height: 210 }}>
          {require('react').createElement('iframe', {
            src: preview, width: '100%', height: '100%', allow: 'autoplay',
            style: { border: 0, display: 'block' },
          })}
        </View>
        <Pressable onPress={() => { if (url) Linking.openURL(url).catch(() => {}); }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 9, backgroundColor: '#140f1e' }}>
          <Icon name="link" size={13} color="#ff9ec4" />
          <Text style={{ color: '#ff9ec4', fontFamily: font.sansSemi, fontSize: 12 }}>Open in Drive instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => (canEmbed ? setPlaying(true) : url ? Linking.openURL(url).catch(() => {}) : undefined)}
      style={{ width: '100%', height: 190, backgroundColor: '#1a1424', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <View style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: '#ff7fae', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, color: '#ff7fae' }}>▶</Text>
      </View>
      <Text style={{ color: '#ffd9e6', fontFamily: font.sansSemi, fontSize: 13 }}>
        {canEmbed ? 'Play the video' : 'Open in Drive'}
      </Text>
      <Text style={{ color: '#9c8fa8', fontFamily: font.mono, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' }}>
        Google Drive
      </Text>
      {sticker ? (
        <View style={{ position: 'absolute', right: 12, bottom: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 17 }}>{sticker}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
