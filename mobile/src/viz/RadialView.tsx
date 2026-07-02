// Radial visualization (RN). Focus person at centre, relatives on rings.
// Fixes from the brief: relationship label is a pill ABOVE the card (never
// overlaps the name); cards are translucent glass; a "Focus" affordance recentres
// on a node. Tap a card to highlight its neighbours and reveal relationship pills.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, useWindowDimensions } from 'react-native';
import Svg, { Line as SvgLine, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme, radius, font, type Palette } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { GlassSurface } from '../theme/GlassSurface';
import { Slider } from '../ui/Slider';
import { Icon } from '../ui/Icon';
import { ZoomPanCanvas, type CanvasHandle } from './ZoomPanCanvas';
import { FocusBar, ZoomButtons, type ZoomApi } from './vizChrome';
import { layoutRadial, type RadialPos } from '../shared/radialLayout';
import { initials, lifespan } from '../shared/adjacency';
import { displayLabels } from '../shared/displayName';
import { relToMe, relationLabel } from '../shared/relationTo';
import { useRelTerms } from '../theme/RelTermsContext';
import type { Adjacency } from '../shared/adjacency';
import type { Member, Relationship } from '../shared/types';

export function RadialView({ members, relationships, adjacency, focusId, meId, setFocusId, onOpenProfile, onZoomReady, hideZoomUI, colorOf }: {
  members: Member[]; relationships: Relationship[]; adjacency: Adjacency; focusId: string; meId?: string;
  setFocusId: (id: string) => void; onOpenProfile: (m: Member) => void;
  onZoomReady?: (api: ZoomApi) => void; hideZoomUI?: boolean;
  colorOf?: (id: string) => string | undefined; // combined view: tint by source family
}) {
  const { c } = useTheme();
  const { terms } = useRelTerms();
  const { firstNames } = useSettings();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const labels = useMemo(() => displayLabels(members, firstNames), [members, firstNames]);
  const [depth, setDepth] = useState(1);
  // Furthest ring that actually has someone on it — lets the slider reach the
  // whole family (capped for sanity) instead of a fixed 3, so distant kin appear.
  const reach = useMemo(() => {
    let m = 1;
    for (const n of adjacency.neighborhood(focusId, 12).values()) m = Math.max(m, n.depth);
    return Math.min(Math.max(m, 1), 8);
  }, [adjacency, focusId]);
  useEffect(() => { setDepth((d) => Math.min(d, reach)); }, [reach]);
  const [selId, setSelId] = useState<string | null>(null);
  const canvasRef = useRef<CanvasHandle>(null);
  // The canvas tap (onTapEmpty) fires simultaneously with a card press; without
  // this guard the empty-tap clears a selection the card just set — making the
  // "Bring into focus" affordance appear only intermittently.
  const lastCardPress = useRef(0);

  // Entering radial (or refocusing) always leaves a node selected, so the focus
  // bar — not the bare legend — is what greets you.
  useEffect(() => { if (focusId) setSelId((s) => s ?? focusId); }, [focusId]);

  const { positions, nodes, ringRadii } = useMemo(
    () => layoutRadial(adjacency, focusId, depth), [adjacency, focusId, depth],
  );

  const maxR = (ringRadii[ringRadii.length - 1] ?? 250) + 120;
  const C = maxR; // centre offset (stage is 2*maxR square)
  const stageSize = maxR * 2;
  const fit = Math.max(0.25, Math.min(1, (screenW - 40) / stageSize, (screenH - 220) / stageSize));

  // Glide to centre on the focus member instead of hard-remounting the canvas.
  // The radial layout always places the focus at the stage centre, so recentring
  // is reset(fit, 0, 0). Skip the first run — initialScale already fits on mount.
  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) { firstFit.current = false; return; }
    canvasRef.current?.reset(fit, 0, 0);
  }, [focusId, depth, fit]);

  const highlight = useMemo(() => {
    if (!selId) return null;
    const s = new Set<string>([selId]);
    for (const id of adjacency.neighborhood(selId, 1).keys()) s.add(id);
    return s;
  }, [selId, adjacency]);

  const relColor = (rel?: string) => {
    if (rel === 'parent') return c.relParent;
    if (rel === 'child') return c.relChild;
    if (rel === 'partner') return c.relPartner;
    if (rel === 'ex-partner') return c.relEx;
    if (rel === 'sibling') return c.relSibling;
    return c.relOther;
  };

  const sel = selId ? adjacency.get(selId) : undefined;

  // Expose zoom so the desktop sub-bar can drive this view.
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
      {/* Depth control — slider (design's ft-range) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line }}>
          <Icon name="tune" size={14} color={c.mute} />
          <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>Depth</Text>
          <Slider value={depth} min={1} max={reach} step={1} width={92} onChange={(v) => { setDepth(v); setSelId(null); }} />
          <Text style={{ color: c.inkSoft, fontFamily: font.monoMed, fontSize: 12, width: 10 }}>{depth}</Text>
        </View>
      </View>

      <ZoomPanCanvas ref={canvasRef} initialScale={fit} minScale={0.2} maxScale={2.5} onTapEmpty={() => { if (Date.now() - lastCardPress.current > 350) setSelId(null); }}>
        <View style={{ width: stageSize, height: stageSize }}>
          <Svg width={stageSize} height={stageSize} style={StyleSheet.absoluteFill}>
            {/* filled radial-gradient glow + visible accent rings (design look) */}
            <Defs>
              <RadialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={c.accent} stopOpacity={c.mode === 'dark' ? 0.16 : 0.1} />
                <Stop offset="0.62" stopColor={c.accent} stopOpacity={0.04} />
                <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {ringRadii.length > 0 ? (
              <Circle cx={C} cy={C} r={ringRadii[ringRadii.length - 1]} fill="url(#ringGlow)" />
            ) : null}
            {ringRadii.map((r, i) => (
              <Circle key={i} cx={C} cy={C} r={r} fill="none" stroke={c.accent} strokeWidth={1.5} opacity={0.3} />
            ))}
            {[...nodes.entries()].map(([id, n]) => {
              if (n.depth === 0) return null;
              const from = n.viaId ? positions.get(n.viaId) : positions.get(focusId);
              const to = positions.get(id);
              if (!from || !to) return null;
              const isHl = highlight && highlight.has(id);
              return (
                <SvgLine key={id} x1={from.x + C} y1={from.y + C} x2={to.x + C} y2={to.y + C}
                  stroke={relColor(n.viaRel)} strokeWidth={1.6}
                  strokeDasharray={n.viaRel === 'ex-partner' ? '5,4' : undefined}
                  opacity={highlight ? (isHl ? 1 : 0.15) : 0.5} />
              );
            })}
          </Svg>

          {[...positions.entries()].map(([id, p]) => {
            const m = adjacency.get(id);
            if (!m) return null;
            const node = nodes.get(id);
            const isFocus = id === focusId;
            const isMe = !!meId && id === meId;
            const dim = !!highlight && !highlight.has(id);
            const showPill = !isFocus && (!highlight || (highlight && highlight.has(id)));
            return (
              <RadialCard key={id} m={m} c={c} label={labels.get(id) ?? m.name} cx={p.x + C} cy={p.y + C} pos={p}
                isFocus={isFocus} isMe={isMe} dim={dim} selected={selId === id} tint={colorOf?.(id)}
                relLabel={showPill ? relationLabel(members, relationships, id, focusId, terms) : undefined}
                relColor={relColor(node?.viaRel)}
                onPress={() => { lastCardPress.current = Date.now(); setSelId(id); }}
                onFocus={() => { setFocusId(id); setSelId(null); }} />
            );
          })}
        </View>
      </ZoomPanCanvas>

      {!hideZoomUI && <ZoomButtons onIn={() => canvasRef.current?.zoomBy(1.25)} onOut={() => canvasRef.current?.zoomBy(0.8)} onFit={() => canvasRef.current?.reset(fit, 0, 0)} />}

      {/* Relationship legend — keyed to the line colours; hidden while a card is
          selected so it never collides with the focus bar. */}
      {sel ? (
        <FocusBar member={sel} onOpen={() => onOpenProfile(sel)} onClose={() => setSelId(null)} extra={relToMe(members, relationships, sel.id, meId, terms)} />
      ) : (
        <RelationLegend c={c} />
      )}
    </View>
  );
}

function RelationLegend({ c }: { c: Palette }) {
  const rows: [string, string, boolean][] = [
    ['Parent / grandparent', c.relParent, false],
    ['Partner', c.relPartner, false],
    ['Former partner', c.relEx, true],
    ['Child / grandchild', c.relChild, false],
    ['Sibling / cousin', c.relSibling, false],
  ];
  return (
    <View style={{ position: 'absolute', left: 12, bottom: 16 }} pointerEvents="none">
      <GlassSurface rounded={radius.md}>
        <View style={{ paddingHorizontal: 13, paddingVertical: 11 }}>
          <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 9.5, letterSpacing: 1.7, textTransform: 'uppercase', marginBottom: 8 }}>Relationship</Text>
          <View style={{ gap: 6 }}>
            {rows.map(([lb, col, dash]) => (
              <View key={lb} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 16, height: 0, borderTopWidth: 2, borderColor: col, borderStyle: dash ? 'dashed' : 'solid' }} />
                <Text style={{ color: c.inkSoft, fontSize: 11.5, fontFamily: font.sans }}>{lb}</Text>
              </View>
            ))}
          </View>
        </View>
      </GlassSurface>
    </View>
  );
}

function RadialCard({ m, c, label, cx, cy, pos, isFocus, isMe, dim, selected, relLabel, relColor, tint, onPress, onFocus }: {
  m: Member; c: Palette; label: string; cx: number; cy: number; pos: RadialPos; isFocus: boolean; isMe: boolean;
  dim: boolean; selected: boolean; relLabel?: string; relColor: string; tint?: string; onPress: () => void; onFocus: () => void;
}) {
  const { years } = useSettings();
  const w = isFocus ? 168 : pos.depth === 1 ? 150 : 116;
  const bg = m.gender === 'female' ? c.cardF : m.gender === 'male' ? c.cardM : c.paper;
  const cardBorder = isFocus ? c.accent : selected ? c.relChild : tint ?? c.line;
  return (
    <View style={{ position: 'absolute', left: cx - w / 2, top: cy - 34, width: w, opacity: dim ? 0.3 : 1, alignItems: 'center' }}>
      {/* Relationship pill — sits ABOVE the card so it never overlaps the name */}
      {relLabel ? (
        <View style={{ marginBottom: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: c.bg, borderWidth: 1, borderColor: relColor }}>
          <Text style={{ color: relColor, fontSize: 10, fontWeight: '800' }}>{relLabel}</Text>
        </View>
      ) : null}
      <View style={{ width: '100%' }}>
        <Pressable onPress={onPress} style={{ width: '100%' }}>
          <GlassSurface rounded={radius.lg} intensity={50} style={{ borderColor: cardBorder, borderWidth: isFocus ? 2 : tint ? 1.5 : 1, ...(isFocus ? { shadowColor: c.accent, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 } : null) }}>
            <View style={{ padding: 10, alignItems: 'center', flexDirection: w > 130 ? 'row' : 'column', gap: 8 }}>
              <View style={{ width: isFocus ? 48 : 38, height: isFocus ? 48 : 38, borderRadius: 24, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {m.photoUrl
                  ? <Image source={{ uri: m.photoUrl }} style={{ width: '100%', height: '100%' }} />
                  : <Text style={{ color: c.inkSoft, fontWeight: '800', fontSize: isFocus ? 16 : 13 }}>{initials(m.name)}</Text>}
              </View>
              <View style={{ flex: w > 130 ? 1 : undefined, alignItems: w > 130 ? 'flex-start' : 'center' }}>
                <Text numberOfLines={1} style={{ color: c.ink, fontWeight: '800', fontSize: isFocus ? 15 : 12, textAlign: 'center' }}>{label}</Text>
                {years ? <Text style={{ color: c.mute, fontSize: 10 }}>{lifespan(m)}</Text> : null}
                {isMe ? <Text style={{ color: c.accent, fontSize: 9, fontWeight: '800' }}>YOU</Text> : null}
              </View>
            </View>
          </GlassSurface>
        </Pressable>
        {/* Bring-into-focus — a big round button to the LEFT of a selected card,
            so it's easy to tap and never collides with neighbouring nodes. */}
        {selected && !isFocus ? (
          <Pressable onPress={onFocus} hitSlop={10}
            style={{ position: 'absolute', left: -52, top: '50%', marginTop: -23, width: 46, height: 46, borderRadius: 23, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg, shadowColor: c.accent, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
            <Icon name="target" size={22} color={c.accentInk} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  depthBtn: { width: 36, height: 32, borderWidth: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
