// Interactive square crop (primarily web — replaces the old window.confirm
// centre-square auto-crop). Shows the picked image, a draggable + resizable
// square selection, and returns a <1 MB cropped JPEG data URI via cropToDataUri.
// Drag the box to move it; use the slider to change its size.
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, PanResponder, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { Slider } from '../ui/Slider';
import { cropToDataUri } from '../shared/photo';

export function CropBox({ uri, base64, onCancel, onDone }: {
  uri: string; base64?: string; onCancel: () => void; onDone: (dataUri: string) => void;
}) {
  const { c } = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);

  // Fit the image into a display box.
  const maxSide = Math.min(screenW - 64, screenH - 280, 380);
  const disp = nat ? fit(nat.w, nat.h, maxSide) : { w: maxSide, h: maxSide };

  // Square selection in DISPLAY coordinates.
  const [rect, setRect] = useState({ x: 0, y: 0, size: 0 });
  const start = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const src = base64 ? `data:image/jpeg;base64,${base64}` : uri;
    Image.getSize(src, (w, h) => setNat({ w, h }), () => setNat({ w: maxSide, h: maxSide }));
  }, [uri, base64]);

  useEffect(() => {
    if (!nat) return;
    const side = Math.min(disp.w, disp.h) * 0.86;
    setRect({ x: (disp.w - side) / 2, y: (disp.h - side) / 2, size: side });
  }, [nat]);

  const clamp = (x: number, y: number, size: number) => ({
    x: Math.max(0, Math.min(x, disp.w - size)),
    y: Math.max(0, Math.min(y, disp.h - size)),
    size,
  });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { start.current = { x: 0, y: 0 }; setRect((r) => { start.current = { x: r.x, y: r.y }; return r; }); },
      onPanResponderMove: (_e, g) => {
        setRect((r) => clamp(start.current.x + g.dx, start.current.y + g.dy, r.size));
      },
    }),
  ).current;

  const onSize = (v: number) => {
    setRect((r) => {
      const size = Math.max(40, Math.min(v, disp.w, disp.h));
      // keep centre roughly stable, then clamp into bounds
      const cx = r.x + r.size / 2, cy = r.y + r.size / 2;
      return clamp(cx - size / 2, cy - size / 2, size);
    });
  };

  const confirm = async () => {
    if (!nat || busy) return;
    setBusy(true);
    try {
      const scale = nat.w / disp.w; // uniform (aspect preserved)
      const out = await cropToDataUri(uri, {
        x: Math.round(rect.x * scale), y: Math.round(rect.y * scale),
        w: Math.round(rect.size * scale), h: Math.round(rect.size * scale),
      }, base64);
      onDone(out);
    } catch (e) {
      console.warn('crop failed', e);
      onCancel();
    } finally { setBusy(false); }
  };

  const src = base64 ? `data:image/jpeg;base64,${base64}` : uri;
  const maskColor = 'rgba(0,0,0,0.5)';

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ backgroundColor: c.bg, borderRadius: radius.xl, padding: 18, alignItems: 'center', maxWidth: 460 }}>
        <Text style={{ color: c.ink, fontFamily: font.serifItalic, fontSize: 22, marginBottom: 4 }}>Crop photo</Text>
        <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 13, marginBottom: 14, textAlign: 'center' }}>Drag the square to move it; use the slider to resize.</Text>

        <View style={{ width: disp.w, height: disp.h, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.paper2 }}>
          {nat ? <Image source={{ uri: src }} style={{ width: disp.w, height: disp.h }} resizeMode="cover" /> : <ActivityIndicator color={c.accent} style={{ marginTop: disp.h / 2 - 10 }} />}
          {/* dim mask outside the square */}
          {nat ? (
            <>
              <View style={{ position: 'absolute', left: 0, top: 0, width: disp.w, height: rect.y, backgroundColor: maskColor }} />
              <View style={{ position: 'absolute', left: 0, top: rect.y + rect.size, width: disp.w, height: Math.max(0, disp.h - rect.y - rect.size), backgroundColor: maskColor }} />
              <View style={{ position: 'absolute', left: 0, top: rect.y, width: rect.x, height: rect.size, backgroundColor: maskColor }} />
              <View style={{ position: 'absolute', left: rect.x + rect.size, top: rect.y, width: Math.max(0, disp.w - rect.x - rect.size), height: rect.size, backgroundColor: maskColor }} />
              {/* draggable selection */}
              <View {...pan.panHandlers} style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.size, height: rect.size, borderWidth: 2, borderColor: c.accent, borderRadius: 6 }} />
            </>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, width: disp.w }}>
          <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>Size</Text>
          <Slider value={rect.size} min={40} max={Math.max(41, Math.min(disp.w, disp.h))} step={1} width={disp.w - 60} onChange={onSize} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: disp.w }}>
          <Pressable onPress={onCancel} style={{ flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.inkSoft, fontFamily: font.sansSemi, fontSize: 14.5 }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={confirm} disabled={busy || !nat} style={{ flex: 1, height: 48, borderRadius: radius.md, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: busy || !nat ? 0.6 : 1 }}>
            {busy ? <ActivityIndicator color={c.accentInk} /> : <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 14.5 }}>Use photo</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function fit(w: number, h: number, max: number): { w: number; h: number } {
  const scale = Math.min(max / w, max / h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}
