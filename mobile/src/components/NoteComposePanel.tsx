// Compose a private note (+ optional image) to a member. Shared by the mobile
// /note route and the desktop right-drawer, so both send the exact same way. The
// image is compressed < 1 MB and stored inline (no Firebase Storage).
import { useState } from 'react';
import { View, Text, Pressable, TextInput, Image, ActivityIndicator, Platform } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { Avatar } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { SheetHead, PanelScroll } from './panelChrome';
import { useAuth } from '../firebase/AuthContext';
import { useUserProfile } from '../firebase/UserProfileContext';
import { addNote } from '../firebase/firestore';
import { pickRawImage, compressUri } from '../shared/photo';
import { NoteEffect } from './NoteEffects';
import type { Member } from '../shared/types';

const PALETTE = ['#8f8bff', '#ff6b8a', '#5fd0b0', '#ffd166', '#e0b873', '#6fb1ff'];
const SEALS = ['💌', '🎉', '❤️', '🎂', '⭐', '🌸', '🔥', '🙏'];
const REVEALS: [string, string][] = [['unfold', 'Unfold'], ['envelope', 'Envelope'], ['flip', 'Flip'], ['curtain', 'Curtain'], ['scroll', 'Scroll'], ['zoom', 'Zoom']];
const EFFECTS: [string, string][] = [
  ['none', 'None'], ['confetti', 'Confetti'], ['ribbons', 'Ribbons'], ['hearts', 'Hearts'],
  ['balloons', 'Balloons'], ['bubbles', 'Bubbles'], ['snow', 'Snow'], ['petals', 'Petals'],
  ['sparkles', 'Sparkles'], ['glitter', 'Glitter'], ['stars', 'Stars'], ['fireworks', 'Fireworks'],
  ['emojiRain', 'Emoji rain'], ['wings', 'Wings'],
];

export function NoteComposePanel({ treeId, recipient, myId, onClose }: {
  treeId?: string | null; recipient?: Member; myId?: string; onClose: () => void;
}) {
  const { c } = useTheme();
  const { user } = useAuth();
  const profile = useUserProfile();
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);      // compressing an image
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState('');
  // Style (optional): accent colour, emoji seal, emoji pin, reveal + effect.
  const [color, setColor] = useState<string | undefined>(undefined);
  const [seal, setSeal] = useState('');
  const [reveal, setReveal] = useState<string>('unfold');
  const [effect, setEffect] = useState<string>('none');
  const [previewKey, setPreviewKey] = useState(0);

  const pickImg = async () => {
    const raw = await pickRawImage();
    if (!raw) return;
    setBusy(true);
    try { setImage(await compressUri(raw.uri, raw.base64)); }
    finally { setBusy(false); }
  };

  const canSend = !!treeId && !!recipient && (!!text.trim() || !!image || !!subject.trim()) && !busy && !sending;

  const send = async () => {
    if (!treeId || !user || !recipient) return;
    if (!text.trim() && !image && !subject.trim()) return;
    setSending(true);
    try {
      const theme: any = {};
      if (color) theme.color = color;
      if (seal.trim()) theme.seal = seal.trim();
      if (reveal && reveal !== 'unfold') theme.reveal = reveal;
      if (effect && effect !== 'none') theme.effect = effect;
      await addNote(treeId, {
        toMemberId: recipient.id,
        toUid: recipient.associatedUserId ?? '',
        fromUid: user.uid,
        fromName: profile?.name || user.email?.split('@')[0] || 'Someone',
        ...(myId ? { fromMemberId: myId } : {}),
        ...(subject.trim() ? { subject: subject.trim() } : {}),
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(image ? { image } : {}),
        ...(Object.keys(theme).length ? { theme } : {}),
      });
      onClose();
    } finally { setSending(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="send" title="New note" sub={recipient ? `To ${recipient.name}` : undefined} onClose={onClose} />
      <PanelScroll contentStyle={{ padding: 16, paddingTop: 4, gap: 14 }}>
        {recipient ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar m={recipient} size={40} />
            <View>
              <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12 }}>To</Text>
              <Text style={{ color: c.ink, fontFamily: font.sansBold, fontSize: 16 }}>{recipient.name}</Text>
            </View>
          </View>
        ) : (
          <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 13 }}>Member not found.</Text>
        )}

        {recipient ? (
          <>
            {!recipient.associatedUserId ? (
              <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12.5, lineHeight: 18 }}>
                {recipient.name} hasn’t set “This is me” yet — they’ll see this once they claim their profile.
              </Text>
            ) : null}

            <TextInput value={subject} onChangeText={setSubject} placeholder="Subject (optional)" placeholderTextColor={c.mute}
              style={{ height: 46, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.ink, borderRadius: radius.md, paddingHorizontal: 12, fontFamily: font.sansBold, fontSize: 15.5, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />

            <TextInput value={text} onChangeText={setText} placeholder="Write a note…" placeholderTextColor={c.mute} multiline
              style={{ minHeight: 120, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.ink, borderRadius: radius.md, padding: 12, fontFamily: font.sansMed, fontSize: 15, textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />

            {image ? (
              <View>
                <Image source={{ uri: image }} style={{ width: '100%', height: 200, borderRadius: radius.lg, backgroundColor: c.paper2 }} resizeMode="cover" />
                <Pressable onPress={() => setImage(undefined)} style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={16} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={pickImg} disabled={busy} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: c.line }}>
                {busy ? <ActivityIndicator color={c.accent} /> : <><Icon name="image" size={17} color={c.accent} /><Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 14 }}>Add photo</Text></>}
              </Pressable>
            )}

            {/* Style (optional) — colour, emoji seal, celebratory open effect */}
            <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>Style (optional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {PALETTE.map((col) => {
                const on = color === col;
                return <Pressable key={col} onPress={() => setColor(on ? undefined : col)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: col, borderWidth: 3, borderColor: on ? c.ink : 'transparent' }} />;
              })}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {SEALS.map((s) => {
                const on = seal === s;
                return <Pressable key={s} onPress={() => setSeal(on ? '' : s)} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.paper }}><Text style={{ fontSize: 18 }}>{s}</Text></Pressable>;
              })}
              <TextInput value={seal} onChangeText={(t) => setSeal(t.trim())} placeholder="seal" placeholderTextColor={c.mute} maxLength={8}
                style={{ width: 60, height: 38, textAlign: 'center', fontSize: 16, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.ink, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
            </View>
            <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12 }}>Reveal</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {REVEALS.map(([r, lb]) => { const on = reveal === r; return <Pressable key={r} onPress={() => setReveal(r)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.paper }}><Text style={{ color: on ? c.accent : c.inkSoft, fontFamily: font.sansSemi, fontSize: 12.5 }}>{lb}</Text></Pressable>; })}
            </View>
            <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12 }}>Effect</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {EFFECTS.map(([e, lb]) => {
                const on = effect === e;
                return <Pressable key={e} onPress={() => { setEffect(e); if (e !== 'none') setPreviewKey((k) => k + 1); }} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.paper }}><Text style={{ color: on ? c.accent : c.inkSoft, fontFamily: font.sansSemi, fontSize: 12.5 }}>{lb}</Text></Pressable>;
              })}
              {effect !== 'none' ? (
                <Pressable onPress={() => setPreviewKey((k) => k + 1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7 }}>
                  <Icon name="sparkles" size={14} color={c.accent} /><Text style={{ color: c.accent, fontFamily: font.sansSemi, fontSize: 12.5 }}>Preview</Text>
                </Pressable>
              ) : null}
            </View>

            <Pressable onPress={send} disabled={!canSend} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md, backgroundColor: c.accent, opacity: canSend ? 1 : 0.5 }}>
              {sending ? <ActivityIndicator color={c.accentInk} /> : <><Icon name="send" size={17} color={c.accentInk} /><Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>Send note</Text></>}
            </Pressable>
          </>
        ) : null}
      </PanelScroll>
      <NoteEffect effect={effect} color={color} emoji={seal || undefined} playKey={previewKey} />
    </View>
  );
}
