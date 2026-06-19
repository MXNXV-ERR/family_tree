// Face match (Phase 5). Three inputs the user picks between: Upload (gallery),
// Capture (one photo), Live (continuous camera). Real progress bar across model
// load → member indexing → analyse → compare. Member descriptors are cached so
// repeat scans skip indexing. Native ML runs via tfjs-react-native (EAS build);
// the web target runs the same pipeline on the WebGL backend.
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFamily } from '../src/firebase/FamilyContext';
import { useFamilyTree } from '../src/firebase/useFamilyTree';
import { useTheme, radius, space, font, type Palette } from '../src/theme/theme';
import { Icon } from '../src/ui/Icon';
import { GlassSurface } from '../src/theme/GlassSurface';
import { useResponsive } from '../src/ui/useResponsive';
import { pickFromGallery, takePhoto } from '../src/shared/photo';
import { matchImage, buildMemberDescriptors, matchPrebuilt, clearMemberDescriptors } from '../src/face/faceRunner';
import { detectFace } from '../src/face/faceEngine';
import { initials } from '../src/shared/adjacency';
import type { Progress, MatchResult, Descriptor } from '../src/face/faceMatch';
import type { Member } from '../src/shared/types';

type Mode = 'upload' | 'capture' | 'live';

const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export default function FaceMatch() {
  const { c } = useTheme();
  const { isDesktop } = useResponsive();
  const { activeTreeId } = useFamily();
  const { members } = useFamilyTree(activeTreeId);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('upload');
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<Progress | null>(null);
  const [queryUri, setQueryUri] = useState<string | null>(null);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [faceFound, setFaceFound] = useState(true);

  // live
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const liveOn = useRef(false);
  const [liveTop, setLiveTop] = useState<MatchResult | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const dbRef = useRef<{ member: Member; desc: Descriptor }[]>([]);
  const lastEmbed = useRef(0);
  const camReady = useRef(false);

  useEffect(() => () => { liveOn.current = false; }, []);

  async function runOneShot(uri: string) {
    setQueryUri(uri); setResults(null); setBusy(true); setProg({ phase: 'models', fraction: 0, note: 'Starting' });
    try {
      const { results, faceFound } = await matchImage(uri, members, setProg);
      setResults(results.slice(0, 5)); setFaceFound(faceFound);
    } catch (e) {
      setProg({ phase: 'done', fraction: 1, note: 'Engine error — ' + String(e).slice(0, 80) });
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  async function onUpload() { const u = await pickFromGallery(); if (u) runOneShot(u); }
  async function onCapture() { const u = await takePhoto(); if (u) runOneShot(u); }

  async function startLive() {
    if (!perm?.granted) { const r = await requestPerm(); if (!r.granted) return; }
    setBusy(true); setLiveReady(false); setProg({ phase: 'models', fraction: 0, note: 'Preparing' });
    try {
      dbRef.current = await buildMemberDescriptors(members, setProg);
      setLiveReady(true); setBusy(false); liveOn.current = true; lastEmbed.current = 0;
      loop();
    } catch {
      setBusy(false);
    }
  }
  function stopLive() { liveOn.current = false; }

  // Two-rate live loop: a cheap BlazeFace detection every tick keeps the preview
  // responsive; the expensive MobileNet embed + rank runs only when a face is
  // present and at most every EMBED_MS. The awaits + the low-res capture yield to
  // the renderer so the camera never freezes (the old loop embedded EVERY frame,
  // which saturated the GPU and "broke" the engine).
  async function loop() {
    const DETECT_MS = 500;
    const EMBED_MS = 1800;
    while (liveOn.current) {
      try {
        if (!camReady.current) { await wait(140); continue; }
        const pic = await camRef.current?.takePictureAsync({ quality: 0.4, base64: true, skipProcessing: true });
        const uri = pic?.base64 ? `data:image/jpg;base64,${pic.base64}` : pic?.uri;
        if (uri && liveOn.current) {
          if (Date.now() - lastEmbed.current >= EMBED_MS) {
            await wait(0); // let the preview paint before the heavy embed
            const r = await matchPrebuilt(uri, dbRef.current);
            lastEmbed.current = Date.now();
            if (liveOn.current) setLiveTop(r[0] ?? null);
          } else {
            const hasFace = await detectFace(uri).catch(() => false);
            if (!hasFace && liveOn.current) setLiveTop(null);
          }
        }
      } catch { /* skip frame */ }
      await wait(DETECT_MS);
    }
  }

  useEffect(() => {
    // Switching modes resets transient state and stops the live loop.
    stopLive(); setLiveTop(null); setLiveReady(false); setResults(null); setQueryUri(null); setProg(null);
    camReady.current = false;
  }, [mode]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, width: '100%', maxWidth: isDesktop ? 760 : undefined, alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingTop: isDesktop ? 24 : 16, paddingBottom: 6 }}>
        <Pressable onPress={() => { stopLive(); router.back(); }} hitSlop={8}><Icon name="back" size={20} color={c.accent} /></Pressable>
        <Text style={{ color: c.ink, fontSize: 22, fontFamily: font.serifItalic }}>Face match</Text>
      </View>

      {/* Mode segment */}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={[styles.seg, { backgroundColor: c.paper, borderColor: c.line }]}>
          {(['upload', 'capture', 'live'] as Mode[]).map((mo) => {
            const on = mode === mo;
            return (
              <Pressable key={mo} onPress={() => setMode(mo)} style={[styles.segBtn, on && { backgroundColor: c.accentSoft }]}>
                <Text style={{ color: on ? c.accent : c.inkSoft, fontWeight: '700', textTransform: 'capitalize' }}>{mo}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {mode !== 'live' ? (
          <>
            <Pressable onPress={mode === 'upload' ? onUpload : onCapture} disabled={busy}
              style={[styles.bigBtn, { borderColor: c.accent, backgroundColor: c.accentSoft, opacity: busy ? 0.6 : 1 }]}>
              <Icon name={mode === 'upload' ? 'image' : 'camera'} size={30} color={c.accent} />
              <Text style={{ color: c.accent, fontWeight: '700', marginTop: 6 }}>
                {mode === 'upload' ? 'Pick a photo to match' : 'Take a photo to match'}
              </Text>
            </Pressable>
            {queryUri ? <Image source={{ uri: queryUri }} style={styles.preview} /> : null}
          </>
        ) : (
          <LivePanel c={c} perm={!!perm?.granted} liveOn={liveOn.current} liveReady={liveReady}
            camRef={camRef} onReady={() => { camReady.current = true; }} onStart={startLive} onStop={stopLive} top={liveTop} onOpen={(m) => { stopLive(); router.push({ pathname: '/profile', params: { id: m.id } }); }} />
        )}

        {busy && prog ? <ProgressBar c={c} p={prog} /> : null}

        {results && mode !== 'live' ? (
          <View style={{ gap: 10 }}>
            {!faceFound ? (
              <GlassSurface><Text style={{ color: c.danger, padding: 18, textAlign: 'center' }}>No face detected in that photo. Try a clearer, front-facing shot.</Text></GlassSurface>
            ) : results.length === 0 ? (
              <GlassSurface><Text style={{ color: c.mute, padding: 18, textAlign: 'center' }}>No members have photos to match against yet.</Text></GlassSurface>
            ) : (
              <>
                <Text style={{ color: c.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>BEST MATCHES</Text>
                {results.map((r, i) => (
                  <Pressable key={r.member.id} onPress={() => router.push({ pathname: '/profile', params: { id: r.member.id } })}>
                    <GlassSurface style={{ borderColor: i === 0 ? c.accent : c.line, borderWidth: i === 0 ? 2 : 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: space(3) }}>
                        <View style={[styles.av, { backgroundColor: r.member.gender === 'female' ? c.cardF : c.cardM }]}>
                          {r.member.photoUrl ? <Image source={{ uri: r.member.photoUrl }} style={styles.avImg} /> : <Text style={{ color: c.inkSoft, fontWeight: '700' }}>{initials(r.member.name)}</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: c.ink, fontWeight: '700' }}>{r.member.name}</Text>
                          <Text style={{ color: c.mute, fontSize: 12 }}>{i === 0 ? 'Top match' : `#${i + 1}`}</Text>
                        </View>
                        <ConfidencePill c={c} score={r.score} top={i === 0} />
                      </View>
                    </GlassSurface>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        ) : null}
      </ScrollView>
      </View>
    </View>
  );
}

function LivePanel({ c, perm, liveReady, camRef, onReady, onStart, onStop, top, onOpen }: {
  c: Palette; perm: boolean; liveOn: boolean; liveReady: boolean;
  camRef: React.RefObject<CameraView | null>; onReady: () => void; onStart: () => void; onStop: () => void;
  top: MatchResult | null; onOpen: (m: Member) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ height: 380, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: c.line, backgroundColor: '#000' }}>
        {Platform.OS === 'web' && !perm ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.mute, textAlign: 'center', padding: 20 }}>Grant camera access and tap Start to scan live.</Text>
          </View>
        ) : (
          <CameraView ref={camRef} style={{ flex: 1 }} facing="front" onCameraReady={onReady} />
        )}
        {top ? (
          <Pressable onPress={() => onOpen(top.member)} style={[styles.liveTag, { backgroundColor: c.paper, borderColor: c.accent }]}>
            <Text style={{ color: c.ink, fontWeight: '800' }}>{top.member.name}</Text>
            <Text style={{ color: c.accent, fontSize: 12, fontWeight: '700' }}>{Math.round(Math.max(0, top.score) * 100)}% · tap to open</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={onStart} style={[styles.liveBtn, { backgroundColor: c.accent }]}><Text style={{ color: '#fff', fontWeight: '800' }}>{liveReady ? 'Restart' : 'Start scanning'}</Text></Pressable>
        <Pressable onPress={onStop} style={[styles.liveBtn, { borderWidth: 1, borderColor: c.line }]}><Text style={{ color: c.inkSoft, fontWeight: '700' }}>Stop</Text></Pressable>
      </View>
    </View>
  );
}

function ProgressBar({ c, p }: { c: Palette; p: Progress }) {
  const pct = Math.round(p.fraction * 100);
  return (
    <GlassSurface>
      <View style={{ padding: space(4), gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: c.inkSoft, fontSize: 13 }}>{p.note ?? p.phase}</Text>
          <Text style={{ color: c.accent, fontSize: 13, fontWeight: '700' }}>{pct}%</Text>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: c.lineSoft, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.accent }} />
        </View>
      </View>
    </GlassSurface>
  );
}

function ConfidencePill({ c, score, top }: { c: Palette; score: number; top: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  return (
    <View style={{ borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: top ? c.accent : c.accentSoft }}>
      <Text style={{ color: top ? '#fff' : c.accent, fontWeight: '800', fontSize: 13 }}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  bigBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.xl, paddingVertical: 30, alignItems: 'center' },
  preview: { width: '100%', height: 240, borderRadius: radius.lg },
  av: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avImg: { width: '100%', height: '100%' },
  liveTag: { position: 'absolute', left: 12, bottom: 12, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  liveBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
});
