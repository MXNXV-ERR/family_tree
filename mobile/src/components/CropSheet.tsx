// Manual square crop for a picked photo (Instagram-style: the crop window is
// fixed, you drag / zoom the image under it). Native pickers offer a system
// crop UI, but the WEB picker cannot crop at all — this gives both platforms
// the same in-app step. Pure RN core (PanResponder + buttons), no new deps.
import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Pressable, Modal, PanResponder, ActivityIndicator } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { Icon } from '../ui/Icon';
import { cropToDataUri } from '../shared/photo';

const VIEW = 300; // crop window (square, px)

export function CropSheet({ uri, onDone, onCancel }: {
  uri: string;
  onDone: (croppedDataUri: string) => void;
  onCancel: () => void;
}) {
  const { c } = useTheme();
  const [src, setSrc] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // transform state — scale is relative to the contain-fit base size
  const [scale, setScale] = useState(1);
  const [t, setT] = useState({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0 });
  const live = useRef({ scale: 1, x: 0, y: 0 });
  live.current = { scale, x: t.x, y: t.y };

  useEffect(() => {
    let on = true;
    Image.getSize(uri, (w, h) => { if (on) setSrc({ w, h }); }, () => { if (on) setSrc({ w: VIEW, h: VIEW }); });
    return () => { on = false; };
  }, [uri]);

  const fit = src ? Math.min(VIEW / src.w, VIEW / src.h) : 1; // contain-fit px-per-source-px at scale 1
  const cover = src ? Math.max(VIEW / (src.w * fit), VIEW / (src.h * fit)) : 1;
  useEffect(() => { if (src) { setScale(cover); setT({ x: 0, y: 0 }); } }, [src]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 2,
      onPanResponderGrant: () => { start.current = { x: live.current.x, y: live.current.y }; },
      onPanResponderMove: (_e, g) => setT({ x: start.current.x + g.dx, y: start.current.y + g.dy }),
    }),
  ).current;

  const zoomBy = (f: number) => setScale((s) => Math.max(cover * 0.5, Math.min(cover * 6, s * f)));

  async function confirm() {
    if (!src) return;
    setBusy(true);
    try {
      // rendered image: size base*scale, centred + translated inside the window
      const pxPerSrc = fit * scale;
      const x0 = (VIEW - src.w * pxPerSrc) / 2 + t.x;
      const y0 = (VIEW - src.h * pxPerSrc) / 2 + t.y;
      const box = {
        x: Math.round(-x0 / pxPerSrc),
        y: Math.round(-y0 / pxPerSrc),
        w: Math.round(VIEW / pxPerSrc),
        h: Math.round(VIEW / pxPerSrc),
      };
      onDone(await cropToDataUri(uri, box));
    } catch {
      onCancel();
    } finally { setBusy(false); }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,7,5,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View style={{ width: '100%', maxWidth: 380, borderRadius: radius.xl, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, padding: 18, gap: 14, alignItems: 'center' }}>
          <Text style={{ color: c.ink, fontFamily: font.serifItalic, fontSize: 20 }}>Crop the face</Text>
          <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12.5, textAlign: 'center' }}>Drag to position · zoom so one face fills the square</Text>

          <View {...pan.panHandlers} style={{ width: VIEW, height: VIEW, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1.5, borderColor: c.accent }}>
            {src ? (
              <Image
                source={{ uri }}
                resizeMode="contain"
                style={{ width: VIEW, height: VIEW, transform: [{ translateX: t.x }, { translateY: t.y }, { scale }] }} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.accent} /></View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => zoomBy(0.85)} hitSlop={6} style={{ width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="minus" size={17} color={c.inkSoft} />
            </Pressable>
            <Pressable onPress={() => zoomBy(1.18)} hitSlop={6} style={{ width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={17} color={c.inkSoft} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onCancel} disabled={busy} style={{ height: 44, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 14 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={confirm} disabled={busy || !src} style={{ height: 44, paddingHorizontal: 18, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
              {busy ? <ActivityIndicator color={c.accentInk} /> : <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 14 }}>Use this crop</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
