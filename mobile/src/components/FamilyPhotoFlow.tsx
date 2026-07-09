// Family group-photo → face-assign. Upload one photo, detect every face, assign
// each to a member, and save each cropped face as that member's profile picture
// plus a reduced copy of the group photo on the family. Owner/admin only.
//
// Detection runs client-side (BlazeFace via the platform face engine). On native
// this needs an EAS dev build — in Expo Go it degrades with a message; web works.
import { useMemo, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, TextInput, Modal, ActivityIndicator, Platform } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/primitives';
import { SheetHead, Toggle, PanelScroll } from './panelChrome';
import { pickRawImage, cropToDataUri, compressUri, type CropBox } from '../shared/photo';
import { detectFaces } from '../face/faceEngine';
import { buildMemberDescriptors, matchPrebuilt } from '../face/faceRunner';
import { bulkUpdateMembers } from '../firebase/firestore';
import { setFamilyPhoto } from '../firebase/families';
import type { Member } from '../shared/types';

type Face = { box: CropBox; thumb: string; memberId?: string; suggestion?: string };
type Phase = 'pick' | 'working' | 'assign' | 'saving' | 'error';

export function FamilyPhotoFlow({ treeId, members, onClose }: {
  treeId: string; members: Member[]; onClose: () => void;
}) {
  const { c } = useTheme();
  const [phase, setPhase] = useState<Phase>('pick');
  const [note, setNote] = useState('Detecting faces…');
  const [errMsg, setErrMsg] = useState('');
  const [src, setSrc] = useState<{ uri: string; base64?: string } | null>(null);
  const [dims, setDims] = useState({ w: 1, h: 1 });
  const [faces, setFaces] = useState<Face[]>([]);
  const [autoMatch, setAutoMatch] = useState(true);
  const [pickFor, setPickFor] = useState<number | null>(null);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const pick = async () => {
    const raw = await pickRawImage();
    if (!raw) return;
    setSrc(raw);
    setPhase('working'); setNote('Detecting faces…');
    try {
      const detectUri = Platform.OS === 'web' && raw.base64 ? `data:image/jpeg;base64,${raw.base64}` : raw.uri;
      const det = await detectFaces(detectUri);
      setDims({ w: det.width, h: det.height });
      if (!det.faces.length) { setErrMsg('No faces found in that photo. Try a clearer group photo.'); setPhase('error'); return; }

      // Crop each detected face (padded) to a thumbnail data URI.
      const out: Face[] = [];
      for (const f of det.faces) {
        const box = pad(f, det.width, det.height);
        const thumb = await cropToDataUri(raw.uri, box, raw.base64);
        out.push({ box, thumb });
      }

      // Optional auto-match: rank members per face and pre-select the top guess.
      if (autoMatch) {
        setNote('Recognising people…');
        try {
          const db = await buildMemberDescriptors(members);
          const used = new Set<string>();
          for (const face of out) {
            const ranked = await matchPrebuilt(face.thumb, db);
            const top = ranked.find((r) => !used.has(r.member.id));
            if (top && top.score > 0.45) { face.memberId = top.member.id; face.suggestion = top.member.name; used.add(top.member.id); }
          }
        } catch (e) { console.warn('auto-match failed', e); }
      }
      setFaces(out);
      setPhase('assign');
    } catch (e: any) {
      console.warn('detectFaces failed', e);
      setErrMsg(Platform.OS === 'web'
        ? 'Could not analyse the photo. Please try another image.'
        : 'Face detection needs a full dev build (not Expo Go) on this device.');
      setPhase('error');
    }
  };

  const assign = (faceIdx: number, memberId: string | undefined) => {
    setFaces((fs) => fs.map((f, i) => (i === faceIdx ? { ...f, memberId } : f)));
    setPickFor(null);
  };

  const assignedCount = faces.filter((f) => f.memberId).length;

  const save = async () => {
    if (!src) return;
    setPhase('saving');
    try {
      const changes = faces.filter((f) => f.memberId).map((f) => ({ id: f.memberId!, data: { photoUrl: f.thumb } }));
      if (changes.length) await bulkUpdateMembers(treeId, changes);
      const groupThumb = await compressUri(src.uri, src.base64);
      await setFamilyPhoto(treeId, groupThumb);
      onClose();
    } catch (e) {
      console.warn('save family photo failed', e);
      setErrMsg('Could not save. Check your connection and that the rules are deployed.');
      setPhase('error');
    }
  };

  // Display geometry — fit the group image to the panel width.
  const PANEL_W = 360;
  const scale = PANEL_W / dims.w;
  const dispH = dims.h * scale;
  const display = src?.base64 ? `data:image/jpeg;base64,${src.base64}` : src?.uri;

  return (
    <View style={{ flex: 1 }}>
      <SheetHead icon="image" title="Family photo" sub="Assign each face to a member" onClose={onClose} />
      <PanelScroll contentStyle={{ padding: 16, paddingTop: 4, gap: 14 }}>
        {phase === 'pick' ? (
          <View style={{ gap: 14, alignItems: 'center', paddingVertical: 24 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="image" size={30} color={c.accent} />
            </View>
            <Text style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
              Upload a group photo. We'll detect the faces so you can set each person's profile picture in one go.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 13.5 }}>Auto-match faces</Text>
              <Toggle on={autoMatch} onPress={() => setAutoMatch((v) => !v)} />
            </View>
            <Pressable onPress={pick} style={{ height: 50, paddingHorizontal: 24, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>Choose photo</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'working' || phase === 'saving' ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 14 }}>
            <ActivityIndicator color={c.accent} size="large" />
            <Text style={{ color: c.inkSoft, fontFamily: font.sansMed, fontSize: 14 }}>{phase === 'saving' ? 'Saving…' : note}</Text>
          </View>
        ) : null}

        {phase === 'error' ? (
          <View style={{ alignItems: 'center', paddingVertical: 30, gap: 14 }}>
            <Icon name="info" size={28} color={c.danger} />
            <Text style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>{errMsg}</Text>
            <Pressable onPress={() => { setPhase('pick'); setFaces([]); setErrMsg(''); }} style={{ height: 46, paddingHorizontal: 20, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi }}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'assign' ? (
          <>
            {display ? (
              <View style={{ width: PANEL_W, height: dispH, alignSelf: 'center', borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.paper2 }}>
                <Image source={{ uri: display }} style={{ width: PANEL_W, height: dispH }} resizeMode="cover" />
                {faces.map((f, i) => (
                  <View key={i} pointerEvents="none" style={{
                    position: 'absolute', left: f.box.x * scale, top: f.box.y * scale, width: f.box.w * scale, height: f.box.h * scale,
                    borderWidth: 2, borderColor: f.memberId ? c.accent : c.amber, borderRadius: 6,
                  }}>
                    <View style={{ position: 'absolute', top: -2, left: -2, backgroundColor: f.memberId ? c.accent : c.amber, paddingHorizontal: 5, paddingVertical: 1, borderTopLeftRadius: 6, borderBottomRightRadius: 6 }}>
                      <Text style={{ color: c.accentInk, fontFamily: font.sansHeavy, fontSize: 9 }}>{i + 1}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 }}>
              {faces.length} {faces.length === 1 ? 'face' : 'faces'} · {assignedCount} assigned
            </Text>

            {faces.map((f, i) => {
              const m = f.memberId ? memberById.get(f.memberId) : undefined;
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: radius.md, borderWidth: 1, borderColor: c.line }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: c.accent, fontFamily: font.sansHeavy, fontSize: 12 }}>{i + 1}</Text>
                  </View>
                  <Image source={{ uri: f.thumb }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.paper2 }} />
                  <Pressable onPress={() => setPickFor(i)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: m ? c.ink : c.mute, fontFamily: font.sansSemi, fontSize: 14 }}>{m ? m.name : 'Tap to assign'}</Text>
                      {f.suggestion && m && f.suggestion === m.name ? <Text style={{ color: c.accent, fontFamily: font.sans, fontSize: 11 }}>auto-matched</Text> : null}
                    </View>
                    <Icon name="chevR" size={16} color={c.faint} />
                  </Pressable>
                  {f.memberId ? (
                    <Pressable onPress={() => assign(i, undefined)} hitSlop={8}><Icon name="close" size={16} color={c.mute} /></Pressable>
                  ) : null}
                </View>
              );
            })}

            <Pressable onPress={save} disabled={assignedCount === 0} style={{ height: 52, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: assignedCount === 0 ? 0.5 : 1, marginTop: 6 }}>
              <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 15 }}>
                {assignedCount === 0 ? 'Assign at least one face' : `Save ${assignedCount} profile photo${assignedCount === 1 ? '' : 's'}`}
              </Text>
            </Pressable>
          </>
        ) : null}
      </PanelScroll>

      {/* member picker */}
      {pickFor !== null ? (
        <Modal transparent animationType="fade" onRequestClose={() => setPickFor(null)}>
          <MemberPicker members={members} c={c} onPick={(id) => assign(pickFor, id)} onClose={() => setPickFor(null)} />
        </Modal>
      ) : null}
    </View>
  );
}

function MemberPicker({ members, c, onPick, onClose }: {
  members: Member[]; c: ReturnType<typeof useTheme>['c']; onPick: (id: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const shown = q.trim() ? members.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase())) : members;
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
      <View style={{ backgroundColor: c.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '70%', paddingBottom: 20 }}>
        <SheetHead icon="users" title="Assign to" sub="Pick the person in this face" onClose={onClose} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <TextInput value={q} onChangeText={setQ} placeholder="Search members…" placeholderTextColor={c.mute} autoFocus
            style={{ height: 46, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, color: c.ink, fontFamily: font.sansMed, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 0, gap: 6 }}>
          {shown.map((m) => (
            <Pressable key={m.id} onPress={() => onPick(m.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.md, backgroundColor: pressed ? c.accentSoft : c.paper })}>
              <Avatar m={m} size={38} />
              <Text style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 14.5 }}>{m.name}</Text>
            </Pressable>
          ))}
          {shown.length === 0 ? <Text style={{ color: c.mute, fontFamily: font.sans, textAlign: 'center', padding: 16 }}>No members match.</Text> : null}
        </ScrollView>
      </View>
    </View>
  );
}

// Expand a tight face box ~30% for a flattering portrait crop, clamped to image.
function pad(b: CropBox, W: number, H: number, f = 0.3): CropBox {
  const px = (b.w * f) / 2, py = (b.h * f) / 2;
  const x = Math.max(0, b.x - px), y = Math.max(0, b.y - py);
  return { x, y, w: Math.min(W - x, b.w + px * 2), h: Math.min(H - y, b.h + py * 2) };
}
