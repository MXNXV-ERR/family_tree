// Face match. Two inputs: Upload (gallery) and Scan (live camera). Scan shows a
// live preview, auto-freezes the frame the moment a face is detected (cheap
// BlazeFace), then runs the full match on that single frozen frame — or you tap
// the shutter to freeze now. "Discard & scan again" resumes live detection. This
// replaces the old continuous-embed loop (which saturated the GPU and stalled)
// and folds the old separate Capture mode into Scan. Member descriptors are
// cached so repeat scans skip indexing. Native ML runs via tfjs-react-native
// (EAS build); web runs the same pipeline on the WebGL backend.
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
import { pickFromGallery } from '../src/shared/photo';
import { matchImage, buildMemberDescriptors, matchPrebuilt } from '../src/face/faceRunner';
import { detectFace } from '../src/face/faceEngine';
import { initials } from '../src/shared/adjacency';
import type { Progress, MatchResult, Descriptor } from '../src/face/faceMatch';
import type { Member } from '../src/shared/types';

type Mode = 'upload' | 'scan';

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
  const [queryUri, setQueryUri] = useState<string | null>(null); // picked photo OR frozen scan frame
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [faceFound, setFaceFound] = useState(true);

  // scan (live camera)
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const scanOn = useRef(false);
  const camReady = useRef(false);
  const dbRef = useRef<{ member: Member; desc: Descriptor }[]>([]);
  const [scanReady, setScanReady] = useState(false); // descriptors built, live preview active
  const [frozen, setFrozen] = useState(false);       // a frame is frozen (analysing or done)

  useEffect(() => () => { scanOn.current = false; }, []);

  // --- Upload (one-shot) ---
  async function runOneShot(uri: string) {
    setQueryUri(uri); setResults(null); setBusy(true); setProg({ phase: 'models', fraction: 0, note: 'Starting' });
    try {
      const { results: r, faceFound: ff } = await matchImage(uri, members, setProg);
      setResults(r.slice(0, 5)); setFaceFound(ff);
    } catch (e) {
      setProg({ phase: 'done', fraction: 1, note: 'Engine error — ' + String(e).slice(0, 80) });
      setResults([]);
    } finally { setBusy(false); }
  }
  async function onUpload() { const u = await pickFromGallery(); if (u) runOneShot(u); }

  // --- Scan (live camera) ---
  async function startScan() {
    if (!perm?.granted) { const r = await requestPerm(); if (!r.granted) return; }
    setBusy(true); setScanReady(false); setFrozen(false); setQueryUri(null); setResults(null);
    setProg({ phase: 'models', fraction: 0, note: 'Preparing' });
    try {
      dbRef.current = await buildMemberDescriptors(members, setProg);
      setBusy(false); setProg(null); setScanReady(true); scanOn.current = true;
      scanLoop();
    } catch { setBusy(false); }
  }
  function stopScan() { scanOn.current = false; setScanReady(false); setFrozen(false); setQueryUri(null); setResults(null); }

  async function grabFrame(): Promise<string | undefined> {
    const pic = await camRef.current?.takePictureAsync({ quality: 0.6, base64: true, skipProcessing: true });
    return pic?.base64 ? `data:image/jpg;base64,${pic.base64}` : pic?.uri;
  }

  // Detect cheaply until a face appears, then freeze that frame and analyse it.
  async function scanLoop() {
    while (scanOn.current) {
      try {
        if (!camReady.current) { await wait(140); continue; }
        const uri = await grabFrame();
        if (uri && scanOn.current && (await detectFace(uri).catch(() => false))) { await freeze(uri); return; }
      } catch { /* skip frame */ }
      await wait(500);
    }
  }
  // Manual shutter — freeze the current frame now (no need to wait for detection).
  async function captureNow() {
    if (!scanOn.current) return;
    try { const uri = await grabFrame(); if (uri) await freeze(uri); } catch { /* ignore */ }
  }
  async function freeze(uri: string) {
    scanOn.current = false; setFrozen(true); setQueryUri(uri); setResults(null);
    setBusy(true); setProg({ phase: 'analyze', fraction: 0.85, note: 'Analysing face' });
    try {
      const r = await matchPrebuilt(uri, dbRef.current);
      setResults(r.slice(0, 5)); setFaceFound(true);
    } catch { setResults([]); }
    finally { setBusy(false); setProg(null); }
  }
  function discardAndRescan() {
    setFrozen(false); setQueryUri(null); setResults(null);
    scanOn.current = true; scanLoop();
  }

  // Switching modes resets transient state and stops the scan loop.
  useEffect(() => {
    scanOn.current = false; camReady.current = false;
    setScanReady(false); setFrozen(false); setResults(null); setQueryUri(null); setProg(null);
  }, [mode]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, width: '100%', maxWidth: isDesktop ? 760 : undefined, alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingTop: isDesktop ? 24 : 16, paddingBottom: 6 }}>
          <Pressable onPress={() => { stopScan(); router.back(); }} hitSlop={8}><Icon name="back" size={20} color={c.accent} /></Pressable>
          <Text style={{ color: c.ink, fontSize: 22, fontFamily: font.serifItalic }}>Face match</Text>
        </View>

        {/* Mode segment */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={[styles.seg, { backgroundColor: c.paper, borderColor: c.line }]}>
            {(['upload', 'scan'] as Mode[]).map((mo) => {
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
          {mode === 'upload' ? (
            <>
              <Pressable onPress={onUpload} disabled={busy}
                style={[styles.bigBtn, { borderColor: c.accent, backgroundColor: c.accentSoft, opacity: busy ? 0.6 : 1 }]}>
                <Icon name="image" size={30} color={c.accent} />
                <Text style={{ color: c.accent, fontWeight: '700', marginTop: 6 }}>Pick a photo to match</Text>
              </Pressable>
              {queryUri ? <Image source={{ uri: queryUri }} style={styles.preview} /> : null}
            </>
          ) : (
            <ScanPanel c={c} perm={!!perm?.granted} camRef={camRef} onReady={() => { camReady.current = true; }}
              scanReady={scanReady} frozen={frozen} frozenUri={queryUri} busy={busy}
              onStart={startScan} onStop={stopScan} onCapture={captureNow} onDiscard={discardAndRescan} />
          )}

          {busy && prog ? <ProgressBar c={c} p={prog} /> : null}

          {results ? (
            <View style={{ gap: 10 }}>
              {!faceFound ? (
                <GlassSurface><Text style={{ color: c.danger, padding: 18, textAlign: 'center' }}>No face detected in that frame. Try a clearer, front-facing shot.</Text></GlassSurface>
              ) : results.length === 0 ? (
                <GlassSurface><Text style={{ color: c.mute, padding: 18, textAlign: 'center' }}>No match — no members have photos to match against yet.</Text></GlassSurface>
              ) : (
                <>
                  <Text style={{ color: c.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>BEST MATCHES</Text>
                  {results.map((r, i) => (
                    <Pressable key={r.member.id} onPress={() => { stopScan(); router.push({ pathname: '/profile', params: { id: r.member.id } }); }}>
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

function ScanPanel({ c, perm, camRef, onReady, scanReady, frozen, frozenUri, busy, onStart, onStop, onCapture, onDiscard }: {
  c: Palette; perm: boolean; camRef: React.RefObject<CameraView | null>; onReady: () => void;
  scanReady: boolean; frozen: boolean; frozenUri: string | null; busy: boolean;
  onStart: () => void; onStop: () => void; onCapture: () => void; onDiscard: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ height: 380, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: c.line, backgroundColor: '#000' }}>
        {frozen && frozenUri ? (
          <Image source={{ uri: frozenUri }} style={{ flex: 1 }} resizeMode="cover" />
        ) : Platform.OS === 'web' && !perm ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.mute, textAlign: 'center', padding: 20 }}>Grant camera access and tap Start to scan.</Text>
          </View>
        ) : (
          <CameraView ref={camRef} style={{ flex: 1 }} facing="front" onCameraReady={onReady} />
        )}
        {scanReady && !frozen ? (
          <View style={[styles.scanHint, { backgroundColor: c.paper, borderColor: c.accent }]}>
            <ActivityIndicator color={c.accent} size="small" />
            <Text style={{ color: c.ink, fontWeight: '700', fontSize: 12.5 }}>Scanning… hold still</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {!scanReady && !frozen ? (
          <Pressable onPress={onStart} disabled={busy} style={[styles.scanBtn, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
            <Text style={{ color: c.accentInk, fontWeight: '800' }}>{busy ? 'Preparing…' : 'Start scanning'}</Text>
          </Pressable>
        ) : frozen ? (
          <Pressable onPress={onDiscard} style={[styles.scanBtn, { backgroundColor: c.accent }]}>
            <Text style={{ color: c.accentInk, fontWeight: '800' }}>Discard & scan again</Text>
          </Pressable>
        ) : (
          <>
            <Pressable onPress={onCapture} style={[styles.scanBtn, { backgroundColor: c.accent }]}>
              <Text style={{ color: c.accentInk, fontWeight: '800' }}>Capture now</Text>
            </Pressable>
            <Pressable onPress={onStop} style={[styles.scanBtn, { borderWidth: 1, borderColor: c.line }]}>
              <Text style={{ color: c.inkSoft, fontWeight: '700' }}>Stop</Text>
            </Pressable>
          </>
        )}
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
  scanHint: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7 },
  scanBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
});
