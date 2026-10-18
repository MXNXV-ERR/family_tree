// Composer (SPEC §4 "Giving" step 2). Repeat wishing is first-class, not an
// edit: the title is "Add another", an ordinal banner carries one dot per wish
// you've already written, your previous wishes list with Edit, and the CTA reads
// "Post this one too".
//
// The sticker you pick becomes this wish's token on the sky — unless media is
// attached, because media always wins the node (so the sticker label only
// appears while nothing is attached).
import { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Image, Platform, ActivityIndicator } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/primitives';
import { SheetHead, PanelScroll } from '../components/panelChrome';
import { addNote, updateWish } from '../firebase/firestore';
import { pickRawImage, compressUri } from '../shared/photo';
import { ordinalWishLine, ordinal } from '../shared/birthdayCopy';
import { mediaKind, type BirthdayWindow } from '../shared/birthday';
import * as haptics from './haptics';
import type { Member, Note } from '../shared/types';

const STICKERS = ['🎂', '🎉', '❤️', '🎈', '🌸', '⭐', '🥳', '🙏', '💌', '🎁'];
const MAX = 600;

export function WishComposer({
  treeId, celebrant, win, myWishes, uid, myMemberId, myName, editing, onClose,
}: {
  treeId?: string | null;
  celebrant: Member;
  win: BirthdayWindow;
  /** The viewer's own prior wishes for this birthday, oldest first. */
  myWishes: Note[];
  uid?: string | null;
  myMemberId?: string | null;
  myName: string;
  /** Editing an existing wish instead of adding one. */
  editing?: Note | null;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [text, setText] = useState(editing?.text ?? '');
  const [image, setImage] = useState<string | undefined>(editing?.image);
  const [videoUrl, setVideoUrl] = useState(editing?.wish?.videoUrl ?? '');
  const [videoOpen, setVideoOpen] = useState(!!editing?.wish?.videoUrl);
  const [sticker, setSticker] = useState(editing?.wish?.sticker ?? '');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const prior = useMemo(() => myWishes.filter((w) => w.id !== editing?.id), [myWishes, editing]);
  const nth = prior.length + 1;
  const isRepeat = prior.length > 0;
  const hasMedia = !!image || !!videoUrl.trim();

  // Posting is gated to the window; edit + delete stay open the whole fourteen
  // days, so an edit is always allowed once the wish exists.
  const now = new Date();
  const inWindow = now >= win.opensAt && now <= new Date(win.closesAt.getTime() + 86_400_000);
  const canPost = !!treeId && !!uid && (!!text.trim() || hasMedia || !!sticker) && !busy && !sending && (inWindow || !!editing);

  const pickImg = async () => {
    const raw = await pickRawImage();
    if (!raw) return;
    setBusy(true);
    try { setImage(await compressUri(raw.uri, raw.base64)); }
    finally { setBusy(false); }
  };

  const post = async () => {
    if (!treeId || !uid || !canPost) return;
    setSending(true);
    try {
      const wish = {
        year: win.year,
        ...(sticker ? { sticker } : {}),
        media: (videoUrl.trim() ? 'video' : image ? 'photo' : 'none') as 'video' | 'photo' | 'none',
        ...(videoUrl.trim() ? { videoUrl: videoUrl.trim() } : {}),
      };
      if (editing) {
        await updateWish(treeId, editing.id, {
          text: text.trim() || undefined,
          image,
          wish,
        });
      } else {
        await addNote(treeId, {
          toMemberId: celebrant.id,
          toUid: celebrant.associatedUserId ?? '',
          fromUid: uid,
          fromName: myName,
          ...(myMemberId ? { fromMemberId: myMemberId } : {}),
          ...(text.trim() ? { text: text.trim() } : {}),
          ...(image ? { image } : {}),
          wish,
        });
      }
      haptics.press();
      onClose();
    } finally { setSending(false); }
  };

  const firstName = celebrant.name.split(' ')[0];
  const turns = win.turning
    ? `turns ${win.turning} on ${win.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
    : win.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <View style={{ flex: 1 }}>
      <SheetHead
        icon="cake"
        title={editing ? 'Edit your wish' : isRepeat ? 'Add another' : 'Add your wish'}
        sub={`For ${firstName} · ${turns}`}
        onClose={onClose}
      />
      <PanelScroll contentStyle={{ padding: 16, paddingTop: 4, gap: 14 }}>
        {/* ordinal banner — one dot per wish, the same ticks the orb wears */}
        {!editing ? (
          <View style={{ borderRadius: 14, padding: 14, gap: 10, backgroundColor: 'rgba(255,206,107,0.07)', borderWidth: 1, borderColor: 'rgba(255,206,107,0.3)' }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {Array.from({ length: nth }).map((_, i) => (
                <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.gold, opacity: i === nth - 1 ? 0.3 : 1 }} />
              ))}
            </View>
            <Text style={{ color: c.inkSoft, fontFamily: font.sansMed, fontSize: 13.5, lineHeight: 19 }}>
              {ordinalWishLine(prior.length, firstName, celebrant.gender)}
            </Text>
          </View>
        ) : null}

        {!inWindow && !editing ? (
          <Text style={{ color: c.mute, fontFamily: font.sansMed, fontSize: 12.5, lineHeight: 18 }}>
            Wishes open seven days before the birthday and close seven days after.
          </Text>
        ) : null}

        {/* the message — Spectral, because what you type becomes the keepsake */}
        <View style={{ borderRadius: 18, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.line, padding: 14 }}>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, MAX))}
            placeholder={`Write to ${firstName}…`}
            placeholderTextColor={c.mute}
            multiline
            style={{
              minHeight: 130, color: c.ink, fontFamily: font.serifMed, fontSize: 17, lineHeight: 26,
              textAlignVertical: 'top',
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null),
            }} />
          <Text style={{ alignSelf: 'flex-end', color: c.mute, fontFamily: font.mono, fontSize: 11 }}>{text.length} / {MAX}</Text>
        </View>

        {/* attachments */}
        {image ? (
          <View>
            <Image source={{ uri: image }} style={{ width: '100%', height: 200, borderRadius: radius.lg, backgroundColor: c.paper2 }} resizeMode="cover" />
            <Pressable onPress={() => setImage(undefined)} style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={16} color="#fff" />
            </Pressable>
          </View>
        ) : null}

        {videoOpen ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={videoUrl} onChangeText={setVideoUrl} autoCapitalize="none"
              placeholder="Paste a Google Drive link…" placeholderTextColor={c.mute}
              style={{ height: 46, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.ink, borderRadius: radius.md, paddingHorizontal: 12, fontFamily: font.sansMed, fontSize: 14, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
            <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 11.5 }}>
              Anyone with the link must be able to open it, or {firstName} will only see the Drive button.
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 9 }}>
          {([
            ['image', 'Photo', pickImg],
            ['link', 'Drive link', () => setVideoOpen((v) => !v)],
            ['camera', 'Record', pickImg],
          ] as [any, string, () => void][]).map(([ic, lb, fn]) => (
            <Pressable key={lb} onPress={fn} disabled={busy} style={({ pressed }) => ({
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
              height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}>
              {busy && lb === 'Photo' ? <ActivityIndicator color={c.accent} /> : <><Icon name={ic} size={16} color={c.accent} /><Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 12.5 }}>{lb}</Text></>}
            </Pressable>
          ))}
        </View>

        {/* sticker picker — becomes the wish's star, unless media wins the node */}
        <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {hasMedia ? 'Sticker · rides the photo as a badge' : 'Your sticker · becomes this wish’s star'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {STICKERS.map((s) => {
            const on = sticker === s;
            return (
              <Pressable key={s} onPress={() => setSticker(on ? '' : s)} style={{
                width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
                borderWidth: on ? 2 : 1.5, borderColor: on ? c.gold : c.line,
                backgroundColor: on ? 'rgba(255,206,107,0.14)' : c.paper,
                ...(on ? { shadowColor: c.gold, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 5 } : null),
              }}>
                <Text style={{ fontSize: 21 }}>{s}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* star preview — the real thing: the new token on its new gold link */}
        <StarPreview priorCount={prior.length} sticker={sticker} media={!!image || !!videoUrl.trim()} image={image} nth={nth} />

        {/* already written by you */}
        {prior.length ? (
          <>
            <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 }}>Already written by you</Text>
            <View style={{ gap: 8 }}>
              {prior.map((w, i) => {
                const kind = mediaKind(w);
                return (
                  <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11, borderRadius: 15, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: kind === 'video' ? c.roseSoft : kind === 'photo' ? 'rgba(255,206,107,0.16)' : c.accentSoft }}>
                      <Text style={{ fontSize: 17 }}>{w.wish?.sticker || (kind === 'video' ? '🎬' : kind === 'photo' ? '🖼' : '✉️')}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansMed, fontSize: 13.5 }}>
                        {w.text || (kind === 'video' ? 'A video' : kind === 'photo' ? 'A photo' : 'A sticker')}
                      </Text>
                      <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 10.5 }}>
                        {ordinal(i + 1)} · sealed
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Pressable onPress={post} disabled={!canPost} style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          height: 52, borderRadius: radius.md, backgroundColor: c.gold,
          opacity: canPost ? 1 : 0.45, transform: [{ scale: pressed ? 0.98 : 1 }],
          shadowColor: c.gold, shadowOpacity: 0.32, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 8,
        })}>
          {sending ? <ActivityIndicator color={c.goldInk} /> : (
            <>
              <Icon name="send" size={17} color={c.goldInk} />
              <Text style={{ color: c.goldInk, fontFamily: font.sansBold, fontSize: 15 }}>
                {editing ? 'Save this wish' : isRepeat ? 'Post this one too' : 'Post wish'}
              </Text>
            </>
          )}
        </Pressable>
      </PanelScroll>
    </View>
  );
}

// A tiny live sky: the new token on a new gold link, prior read wishes faint
// behind it — the real geometry, not an illustration of it.
function StarPreview({ priorCount, sticker, media, image, nth }: {
  priorCount: number; sticker: string; media: boolean; image?: string; nth: number;
}) {
  const { c } = useTheme();
  const w = 300, h = 110;
  const hub = { x: 42, y: h / 2 };
  const seats = Array.from({ length: Math.min(priorCount, 4) }).map((_, i) => ({
    x: 96 + i * 44, y: 26 + ((i * 37) % 58),
  }));
  const fresh = { x: 96 + Math.min(priorCount, 4) * 44, y: 34 + ((priorCount * 23) % 46) };

  return (
    <View style={{ borderRadius: 16, backgroundColor: c.bg2, borderWidth: 1, borderColor: c.line, padding: 12, gap: 8 }}>
      <View style={{ height: h, overflow: 'hidden' }}>
        {/* faint links to the prior wishes, a gold one to the new bead */}
        {seats.map((s, i) => (
          <Line key={i} from={hub} to={s} color={c.accent} opacity={0.22} />
        ))}
        <Line from={hub} to={fresh} color={c.gold} opacity={0.8} />
        <View style={{ position: 'absolute', left: hub.x - 17, top: hub.y - 17, width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.paper }} />
        {seats.map((s, i) => (
          <View key={i} style={{ position: 'absolute', left: s.x - 8, top: s.y - 8, width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(167,139,255,0.3)', backgroundColor: c.paper, opacity: 0.55 }} />
        ))}
        <View style={{
          position: 'absolute', left: fresh.x - 15, top: fresh.y - 15, width: 30, height: 30,
          borderRadius: media ? 9 : 15, borderWidth: 2, borderColor: c.gold, overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper,
        }}>
          {media && image
            ? <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} />
            : <Text style={{ fontSize: 14 }}>{sticker || (media ? '🎬' : '✉️')}</Text>}
        </View>
      </View>
      <Text style={{ color: c.mute, fontFamily: font.sansMed, fontSize: 12, lineHeight: 17 }}>
        {priorCount === 0
          ? 'Your wish becomes a star on their sky. Sealed until the day.'
          : `Your ${ordinal(nth)} star joins the same sky, on its own link. Sealed until the day.`}
      </Text>
    </View>
  );
}

// A plain rotated 1px view — cheaper than mounting an SVG for the preview.
function Line({ from, to, color, opacity }: { from: { x: number; y: number }; to: { x: number; y: number }; color: string; opacity: number }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <View style={{
      position: 'absolute', left: from.x, top: from.y, width: len, height: 1.2,
      backgroundColor: color, opacity, transform: [{ translateY: -0.6 }, { rotate: `${angle}deg` }],
      transformOrigin: 'left center' as any,
    }} />
  );
}
