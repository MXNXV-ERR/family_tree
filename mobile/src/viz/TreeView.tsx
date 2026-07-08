// Tree visualization (RN). Renders the ported pyramid/inverted/hourglass
// layouts: an SVG layer for connector lines + couple pills, glass node cards on
// top. Tap a card to focus (re-centres inverted/hourglass) and highlight its
// neighbours; the focus bar opens the profile.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, useWindowDimensions, Animated, Easing } from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';
import { useTheme, radius, font, type Palette } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { ZoomPanCanvas, type CanvasHandle } from './ZoomPanCanvas';
import { DrawLines } from './DrawLines';
import { VizSegment, FocusBar, ZoomButtons, type ZoomApi } from './vizChrome';
import { MorphNode } from '../ui/primitives';
import { Slider } from '../ui/Slider';
import { Icon } from '../ui/Icon';
import { useAmbientMotion } from '../ui/AmbientMotion';
import {
  layoutPyramid, layoutLayered, layoutInverted, layoutHourglass,
  NODE_W, NODE_H, COUPLE_W, type LayoutResult,
} from '../shared/treeLayout';
import { initials, lifespan, computeGenerations, buildAdjacency } from '../shared/adjacency';
import { displayLabels } from '../shared/displayName';
import type { Adjacency } from '../shared/adjacency';
import { relToMe } from '../shared/relationTo';
import { useRelTerms } from '../theme/RelTermsContext';
import type { Member, Relationship } from '../shared/types';

type TreeLayout = 'pyramid' | 'inverted' | 'hourglass';
const LAYOUT_ORDER: TreeLayout[] = ['pyramid', 'inverted', 'hourglass'];

export function TreeView({ members, relationships, adjacency, focusId, meId, setFocusId, onOpenProfile, onZoomReady, hideZoomUI, layered, colorOf }: {
  members: Member[]; relationships: Relationship[]; adjacency: Adjacency; focusId: string; meId?: string;
  setFocusId: (id: string) => void; onOpenProfile: (m: Member) => void;
  onZoomReady?: (api: ZoomApi) => void; hideZoomUI?: boolean;
  // Combined-view extras: `layered` joins bridged families into one tree;
  // `colorOf` tints each node by its source family.
  layered?: boolean; colorOf?: (id: string) => string | undefined;
}) {
  const { c } = useTheme();
  const { terms } = useRelTerms();
  const { motion, firstNames } = useSettings();
  const am = useAmbientMotion();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [layout, setLayout] = useState<TreeLayout>('pyramid');
  const [selId, setSelId] = useState<string | null>(null);
  // Pan the sky to this layout's sub-slot (absolute, mirrors the view filmstrip)
  // so switching layouts MOVES the background instead of zoom-pulsing it.
  useEffect(() => { am?.setLayoutPos(LAYOUT_ORDER.indexOf(layout) * 0.25); }, [layout, am]);
  const canvasRef = useRef<CanvasHandle>(null);
  const labels = useMemo(() => displayLabels(members, firstNames), [members, firstNames]);

  // Generation index per member across the FULL tree — drives the slider max and
  // the pyramid subset.
  const genOfId = useMemo(() => computeGenerations(members, relationships), [members, relationships]);
  const maxGen = useMemo(() => { let mx = 0; genOfId.forEach((g) => { if (g > mx) mx = g; }); return mx + 1; }, [genOfId]);
  const [genLimit, setGenLimit] = useState(99);
  // Show everything by default; reset whenever the tree/layout changes.
  useEffect(() => { setGenLimit(maxGen); }, [maxGen, layout]);

  // Small trees (1–2 generations) get roomier sibling spacing — the tight gap
  // tuned for big pyramids reads cramped when one row IS the whole tree.
  const sibGap = maxGen <= 2 ? 28 : 12;

  // Pyramid re-solves the layout for just the visible generations, so it compacts
  // + recenters and the nodes glide (MorphNode) to their new spots — a real
  // reorganise, not a reload. Ancestors/Hourglass use the full focus-based set.
  const res = useMemo<LayoutResult>(() => {
    if (layout === 'pyramid') {
      if (layered) return layoutLayered(members, adjacency, sibGap);
      if (genLimit >= maxGen) return layoutPyramid(members, adjacency, sibGap);
      const vis = members.filter((m) => (genOfId.get(m.id) ?? 0) < genLimit);
      const ids = new Set(vis.map((m) => m.id));
      const rels = relationships.filter((r) => ids.has(r.fromId) && ids.has(r.toId));
      return layoutPyramid(vis, buildAdjacency(vis, rels), sibGap);
    }
    if (layout === 'inverted') return layoutInverted(focusId, adjacency);
    return layoutHourglass(focusId, members, adjacency);
  }, [layout, focusId, members, relationships, adjacency, layered, genLimit, maxGen, genOfId, sibGap]);

  const { positions, couplePills, lines, width, height } = res;

  // Constant stage: the FULL pyramid's dimensions, so the generations slider never
  // resizes the frame or re-zooms. The visible subset is centred inside it — adding
  // a generation grows the subset, shrinking the top offset, so the existing tree
  // glides UP to make space while the new row fades in (all via MorphNode).
  const full = useMemo(
    () => (layout === 'pyramid' && !layered) ? layoutPyramid(members, adjacency, sibGap) : null,
    [layout, layered, members, adjacency, sibGap],
  );
  const stageW = full ? Math.max(full.width, width) : width;
  const stageH = full ? Math.max(full.height, height) : height;
  const offX = full ? (stageW - width) / 2 : 0;
  const offY = full ? (stageH - height) / 2 : 0;

  // Dip the connectors during a generation change, then bring them back once the
  // nodes have glided in — so lines never point at mid-flight nodes.
  const lineFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!motion) { lineFade.setValue(1); return; }
    lineFade.setValue(0.12);
    Animated.timing(lineFade, { toValue: 1, duration: 460, delay: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genLimit]);

  const fit = Math.max(0.2, Math.min(1, (screenW - 40) / stageW, (screenH - 220) / stageH));
  // Entrance animations only on small trees — hundreds of NodePop/line-draw
  // animations stutter and "skip" on big trees, so render those instantly.
  const animate = motion && positions.size <= 60;
  // Dash long enough to cover any single connector at this tree size.
  const dash = Math.ceil(stageW + stageH);
  // Lines redraw on layout/size change, not on every focus tap (geometry is the
  // same), so the canvas stays mounted across focus changes (no remount jank).
  const drawKey = `${layout}-${Math.round(width)}`;

  // Smoothly pan the canvas so the focus member sits at centre — on first load
  // (the default "you"/random focus) and whenever the focus changes. Content is
  // centred in the canvas, transform is [tx, ty, scale], so a content point
  // (nx,ny) reaches centre at tx = scale*(W/2 - nx), ty = scale*(H/2 - ny).
  // Re-centre on the focus node when focus/layout changes — NOT on generation
  // changes (stageW/H are constant), so the gen slider's "tree moves up" glide
  // isn't interrupted by a canvas re-centre.
  useEffect(() => {
    const pos = positions.get(focusId);
    if (!pos) return;
    const nx = pos.x + offX + NODE_W / 2;
    const ny = pos.y + offY + NODE_H / 2;
    canvasRef.current?.reset(fit, fit * (stageW / 2 - nx), fit * (stageH / 2 - ny));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, layout, fit]);

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
      {layout === 'pyramid' && maxGen > 1 ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 10, height: 38, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line }}>
            <Icon name="branch" size={14} color={c.mute} />
            <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>Generations</Text>
            <Slider value={Math.min(genLimit, maxGen)} min={1} max={maxGen} step={1} width={104} onChange={setGenLimit} />
            <Text style={{ color: c.inkSoft, fontFamily: font.monoMed, fontSize: 12, width: 30 }}>{Math.min(genLimit, maxGen)}/{maxGen}</Text>
          </View>
        </View>
      ) : null}
      <ZoomPanCanvas key={layout} ref={canvasRef} initialScale={fit} minScale={0.15} maxScale={2.5} onTapEmpty={() => setSelId(null)}>
        <View style={{ width: stageW, height: stageH }}>
          <Svg width={stageW} height={stageH} style={StyleSheet.absoluteFill}>
            {/* dotted canvas (design .dotgrid) */}
            <Defs>
              <Pattern id="ft-dots" width={26} height={26} patternUnits="userSpaceOnUse">
                <Circle cx={1.4} cy={1.4} r={1.4} fill={c.mode === 'dark' ? 'rgba(255,255,255,0.035)' : 'rgba(60,50,30,0.05)'} />
              </Pattern>
            </Defs>
            <Rect x={0} y={0} width={stageW} height={stageH} fill="url(#ft-dots)" />
          </Svg>
          {/* Connectors on their own layer, offset to the centred subset so they
              can dip out/in during a generation morph (lineFade) without touching
              the dot grid. */}
          <Animated.View style={{ position: 'absolute', left: 0, top: 0, opacity: lineFade, transform: [{ translateX: offX }, { translateY: offY }] }} pointerEvents="none">
            <Svg width={width} height={height}>
              <DrawLines lines={lines} color={c.relParent} dash={dash} animate={animate} drawKey={drawKey}
                colorFor={layered && colorOf ? (ownerId) => (ownerId ? colorOf(ownerId) : undefined) : undefined} />
            </Svg>
          </Animated.View>

          {couplePills.map((p) => (
            <MorphNode key={`pill-${p.ids[0]}`} x={p.x - 6 + offX} y={p.y - 6 + offY}>
              <View pointerEvents="none" style={{
                width: COUPLE_W + 12, height: NODE_H + 12,
                borderRadius: radius.lg, borderWidth: 1,
                borderColor: p.status === 'divorced' ? c.relEx : c.gold,
                borderStyle: p.status === 'divorced' ? 'dashed' : 'solid', opacity: 0.55,
              }} />
            </MorphNode>
          ))}

          {[...positions.entries()].map(([id, pos], idx) => {
            const m = adjacency.get(id);
            if (!m) return null;
            const isFocus = id === focusId;
            const isMe = !!meId && id === meId;
            const dim = !!highlight && !highlight.has(id);
            const hl = !!highlight && highlight.has(id) && !isFocus;
            return (
              <MorphNode key={id} i={idx} x={pos.x + offX} y={pos.y + offY}>
                <NodeCard m={m} c={c} label={labels.get(id) ?? m.name}
                  isFocus={isFocus} isMe={isMe} dim={dim} hl={hl} tint={colorOf?.(id)}
                  onPress={() => { setSelId(id); setFocusId(id); }} />
              </MorphNode>
            );
          })}
        </View>
      </ZoomPanCanvas>

      {!hideZoomUI && <ZoomButtons onIn={() => canvasRef.current?.zoomBy(1.25)} onOut={() => canvasRef.current?.zoomBy(0.8)} onFit={() => canvasRef.current?.reset(fit, 0, 0)} />}
      {sel ? <FocusBar member={sel} onOpen={() => onOpenProfile(sel)} onClose={() => setSelId(null)} extra={relToMe(members, relationships, sel.id, meId, terms) ?? undefined} /> : null}
    </View>
  );
}

function NodeCard({ m, c, label, isFocus, isMe, dim, hl, tint, onPress }: {
  m: Member; c: Palette; label: string; isFocus: boolean; isMe: boolean; dim: boolean; hl: boolean; tint?: string; onPress: () => void;
}) {
  const { years } = useSettings();
  const bg = m.gender === 'female' ? c.cardF : m.gender === 'male' ? c.cardM : c.paper;
  // In the combined view `tint` is the source-family colour — it wins the border
  // (except on the focused card) so you can tell which family a person is from.
  const border = isFocus ? c.accent : tint ?? (hl ? c.relChild : m.gender === 'female' ? c.cardFBorder : c.cardMBorder);
  return (
    <Pressable onPress={onPress} style={{
      width: NODE_W, height: NODE_H,
      borderRadius: radius.md, borderWidth: isFocus ? 2 : tint ? 2 : 1, borderColor: border, backgroundColor: bg,
      opacity: dim ? 0.35 : 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8,
      // depth + accent glow on the focused card (design look)
      shadowColor: isFocus ? c.accent : '#000',
      shadowOpacity: isFocus ? 0.5 : (c.mode === 'dark' ? 0.35 : 0.12),
      shadowRadius: isFocus ? 16 : 5,
      shadowOffset: { width: 0, height: isFocus ? 8 : 2 },
      elevation: isFocus ? 8 : 2,
    }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {m.photoUrl
          ? <Image source={{ uri: m.photoUrl }} style={{ width: '100%', height: '100%' }} />
          : <Text style={{ color: m.gender === 'female' ? c.cardFInk : m.gender === 'male' ? c.cardMInk : c.cardOInk, fontFamily: font.sansBold, fontSize: 13 }}>{initials(m.name)}</Text>}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 12.5 }}>{label}</Text>
        {years ? <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.mono, fontSize: 10 }}>{lifespan(m)}</Text> : null}
        {isMe ? <Text style={{ color: c.accent, fontFamily: font.sansHeavy, fontSize: 9 }}>YOU</Text> : null}
      </View>
    </Pressable>
  );
}
