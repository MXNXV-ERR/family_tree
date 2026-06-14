// Tree visualization (RN). Renders the ported pyramid/inverted/hourglass
// layouts: an SVG layer for connector lines + couple pills, glass node cards on
// top. Tap a card to focus (re-centres inverted/hourglass) and highlight its
// neighbours; the focus bar opens the profile.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, useWindowDimensions } from 'react-native';
import Svg, { Path, Defs, Pattern, Circle, Rect } from 'react-native-svg';
import Reanimated, { useSharedValue, useAnimatedProps, withTiming, Easing as REasing } from 'react-native-reanimated';
import { useTheme, radius, type Palette } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { ZoomPanCanvas, type CanvasHandle } from './ZoomPanCanvas';
import { VizSegment, FocusBar, ZoomButtons, type ZoomApi } from './vizChrome';
import { NodePop } from '../ui/primitives';
import {
  layoutPyramid, layoutInverted, layoutHourglass,
  NODE_W, NODE_H, COUPLE_W, type LayoutResult,
} from '../shared/treeLayout';
import { initials, lifespan } from '../shared/adjacency';
import type { Adjacency } from '../shared/adjacency';
import { relToMe } from '../shared/relationTo';
import type { Member, Relationship } from '../shared/types';

const RnPath = Reanimated.createAnimatedComponent(Path);
const DASH = 2000;

// Connector lines that draw themselves in (design's .link-draw / ft-draw): a
// long dash slides its offset to 0. Reanimated drives the SVG prop so it works
// on web + native. Restarts whenever `drawKey` changes.
function DrawLines({ lines, color, drawKey }: { lines: { d: string }[]; color: string; drawKey: string }) {
  const { motion } = useSettings();
  const p = useSharedValue(motion ? 0 : 1);
  useEffect(() => {
    if (!motion) { p.value = 1; return; }
    p.value = 0;
    p.value = withTiming(1, { duration: 900, easing: REasing.bezier(0.16, 1, 0.3, 1) });
  }, [drawKey, motion]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: DASH * (1 - p.value) }));
  return (
    <>
      {lines.map((l, i) => (
        <RnPath key={i} d={l.d} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5}
          strokeLinecap="round" strokeDasharray={DASH} animatedProps={animatedProps} />
      ))}
    </>
  );
}

type TreeLayout = 'pyramid' | 'inverted' | 'hourglass';

export function TreeView({ members, relationships, adjacency, focusId, meId, setFocusId, onOpenProfile, onZoomReady, hideZoomUI }: {
  members: Member[]; relationships: Relationship[]; adjacency: Adjacency; focusId: string; meId?: string;
  setFocusId: (id: string) => void; onOpenProfile: (m: Member) => void;
  onZoomReady?: (api: ZoomApi) => void; hideZoomUI?: boolean;
}) {
  const { c } = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [layout, setLayout] = useState<TreeLayout>('pyramid');
  const [selId, setSelId] = useState<string | null>(null);
  const canvasRef = useRef<CanvasHandle>(null);

  const res = useMemo<LayoutResult>(() => {
    if (layout === 'pyramid') return layoutPyramid(members, adjacency);
    if (layout === 'inverted') return layoutInverted(focusId, adjacency);
    return layoutHourglass(focusId, members, adjacency);
  }, [layout, focusId, members, adjacency]);

  const { positions, couplePills, lines, width, height } = res;

  const fit = Math.max(0.2, Math.min(1, (screenW - 40) / width, (screenH - 220) / height));
  const fitKey = `${layout}-${focusId}-${Math.round(width)}`;

  const highlight = useMemo(() => {
    if (!selId) return null;
    const s = new Set<string>([selId]);
    for (const id of adjacency.neighborhood(selId, 1).keys()) s.add(id);
    return s;
  }, [selId, adjacency]);

  const sel = selId ? adjacency.get(selId) : undefined;

  // Expose zoom so a shared control (desktop sub-bar) can drive this view.
  const fitRef = useRef(fit); fitRef.current = fit;
  useEffect(() => {
    onZoomReady?.({
      in: () => canvasRef.current?.zoomBy(1.25),
      out: () => canvasRef.current?.zoomBy(0.8),
      fit: () => canvasRef.current?.reset(fitRef.current, 0, 0),
    });
  }, [onZoomReady]);

  return (
    <View style={{ flex: 1 }}>
      <VizSegment
        value={layout}
        onChange={(v) => { setLayout(v as TreeLayout); setSelId(null); }}
        options={[['pyramid', 'Pyramid'], ['inverted', 'Ancestors'], ['hourglass', 'Hourglass']]}
      />
      <ZoomPanCanvas key={fitKey} ref={canvasRef} initialScale={fit} minScale={0.15} maxScale={2.5} onTapEmpty={() => setSelId(null)}>
        <View style={{ width, height }}>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            {/* dotted canvas (design .dotgrid) */}
            <Defs>
              <Pattern id="ft-dots" width={26} height={26} patternUnits="userSpaceOnUse">
                <Circle cx={1.4} cy={1.4} r={1.4} fill={c.mode === 'dark' ? 'rgba(255,255,255,0.035)' : 'rgba(60,50,30,0.05)'} />
              </Pattern>
            </Defs>
            <Rect x={0} y={0} width={width} height={height} fill="url(#ft-dots)" />
            <DrawLines lines={lines} color={c.relParent} drawKey={fitKey} />
          </Svg>

          {couplePills.map((p, i) => (
            <View key={`pill-${i}`} pointerEvents="none" style={{
              position: 'absolute', left: p.x - 6, top: p.y - 6, width: COUPLE_W + 12, height: NODE_H + 12,
              borderRadius: radius.lg, borderWidth: 1,
              borderColor: p.status === 'divorced' ? c.relEx : c.relPartner,
              borderStyle: p.status === 'divorced' ? 'dashed' : 'solid', opacity: 0.5,
            }} />
          ))}

          {[...positions.entries()].map(([id, pos], idx) => {
            const m = adjacency.get(id);
            if (!m) return null;
            const isFocus = id === focusId;
            const isMe = !!meId && id === meId;
            const dim = !!highlight && !highlight.has(id);
            const hl = !!highlight && highlight.has(id) && !isFocus;
            return (
              <NodePop key={id} i={idx} style={{ position: 'absolute', left: pos.x, top: pos.y }}>
                <NodeCard m={m} c={c}
                  isFocus={isFocus} isMe={isMe} dim={dim} hl={hl}
                  onPress={() => { setSelId(id); setFocusId(id); }} />
              </NodePop>
            );
          })}
        </View>
      </ZoomPanCanvas>

      {!hideZoomUI && <ZoomButtons onIn={() => canvasRef.current?.zoomBy(1.25)} onOut={() => canvasRef.current?.zoomBy(0.8)} onFit={() => canvasRef.current?.reset(fit, 0, 0)} />}
      {sel ? <FocusBar member={sel} onOpen={() => onOpenProfile(sel)} onClose={() => setSelId(null)} extra={relToMe(members, relationships, sel.id, meId) ?? undefined} /> : null}
    </View>
  );
}

function NodeCard({ m, c, isFocus, isMe, dim, hl, onPress }: {
  m: Member; c: Palette; isFocus: boolean; isMe: boolean; dim: boolean; hl: boolean; onPress: () => void;
}) {
  const { years } = useSettings();
  const bg = m.gender === 'female' ? c.cardF : m.gender === 'male' ? c.cardM : c.paper;
  const border = isFocus ? c.accent : hl ? c.relChild : m.gender === 'female' ? c.cardFBorder : c.cardMBorder;
  return (
    <Pressable onPress={onPress} style={{
      width: NODE_W, height: NODE_H,
      borderRadius: radius.md, borderWidth: isFocus ? 2 : 1, borderColor: border, backgroundColor: bg,
      opacity: dim ? 0.35 : 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8,
      // depth + accent glow on the focused card (design look)
      shadowColor: isFocus ? c.accent : '#000',
      shadowOpacity: isFocus ? 0.5 : (c.mode === 'dark' ? 0.35 : 0.12),
      shadowRadius: isFocus ? 16 : 5,
      shadowOffset: { width: 0, height: isFocus ? 8 : 2 },
      elevation: isFocus ? 8 : 2,
    }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {m.photoUrl
          ? <Image source={{ uri: m.photoUrl }} style={{ width: '100%', height: '100%' }} />
          : <Text style={{ color: c.inkSoft, fontWeight: '800', fontSize: 13 }}>{initials(m.name)}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: c.ink, fontWeight: '700', fontSize: 12 }}>{m.name}</Text>
        {years ? <Text style={{ color: c.mute, fontSize: 10 }}>{lifespan(m)}</Text> : null}
        {isMe ? <Text style={{ color: c.accent, fontSize: 9, fontWeight: '700' }}>YOU</Text> : null}
      </View>
    </Pressable>
  );
}
