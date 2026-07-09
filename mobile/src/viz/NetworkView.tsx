// Network (force-directed) visualization — the whole family as a spring graph,
// inspired by document-network explorers. Nodes repel, relationships pull, so
// tightly-linked branches cluster and cross-family bridges show as long links.
// Tap a node to highlight its neighbours + open the focus bar; long-press to
// recentre. Renders with react-native-svg inside the shared zoom/pan canvas, so
// it works on web and native (no DOM-only graph lib).
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, useWindowDimensions } from 'react-native';
import Svg from 'react-native-svg';
import { useTheme, font } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { ZoomPanCanvas, type CanvasHandle } from './ZoomPanCanvas';
import { DrawLines, type DrawLine } from './DrawLines';
import { FocusBar, ZoomButtons, type ZoomApi } from './vizChrome';
import { MorphNode } from '../ui/primitives';
import { layoutNetwork } from '../shared/networkLayout';
import { initials } from '../shared/adjacency';
import { displayLabels } from '../shared/displayName';
import { relToMe } from '../shared/relationTo';
import { useRelTerms } from '../theme/RelTermsContext';
import type { Adjacency } from '../shared/adjacency';
import type { Member, Relationship } from '../shared/types';

export function NetworkView({ members, relationships, adjacency, focusId, meId, setFocusId, onOpenProfile, onZoomReady, hideZoomUI, colorOf }: {
  members: Member[]; relationships: Relationship[]; adjacency: Adjacency; focusId: string; meId?: string;
  setFocusId: (id: string) => void; onOpenProfile: (m: Member) => void;
  onZoomReady?: (api: ZoomApi) => void; hideZoomUI?: boolean;
  colorOf?: (id: string) => string | undefined; // combined view: tint by source family
}) {
  const { c } = useTheme();
  const { terms } = useRelTerms();
  const { firstNames, motion } = useSettings();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const canvasRef = useRef<CanvasHandle>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const lastPress = useRef(0);
  const labels = useMemo(() => displayLabels(members, firstNames), [members, firstNames]);

  const positions = useMemo(() => layoutNetwork(members, relationships), [members, relationships]);

  // Normalise into a positive-coordinate stage with padding.
  const { size, off } = useMemo(() => {
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    for (const p of positions.values()) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
    const pad = 140;
    return { size: { w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 }, off: { x: pad - minX, y: pad - minY } };
  }, [positions]);
  const P = (id: string) => { const p = positions.get(id)!; return { x: p.x + off.x, y: p.y + off.y }; };
  // Edges anchor on the avatar circle (the node row is avatar + name; lines
  // through the name text looked like they connected to the label).
  const AV = (id: string) => { const p = P(id); return { x: p.x - 45, y: p.y }; };

  // Which edge kinds are drawn — the legend chips toggle these. Siblings are
  // inferred from shared parents (there are usually no explicit sibling docs),
  // and stay OFF by default: the graph reads better without them.
  const [show, setShow] = useState({ parent: true, spouse: true, sibling: false });
  const siblingEdges = useMemo(() => {
    if (!show.sibling) return [] as { id: string; fromId: string; toId: string }[];
    const seen = new Set<string>();
    const out: { id: string; fromId: string; toId: string }[] = [];
    for (const m of members) {
      for (const s of adjacency.siblings(m.id)) {
        const key = m.id < s ? `${m.id}|${s}` : `${s}|${m.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ id: `sib:${key}`, fromId: m.id, toId: s });
      }
    }
    return out;
  }, [show.sibling, members, adjacency]);

  const highlight = useMemo(() => {
    if (!selId) return null;
    const s = new Set<string>([selId]);
    for (const id of adjacency.neighborhood(selId, 1).keys()) s.add(id);
    return s;
  }, [selId, adjacency]);

  // Always enter with a node selected (focus bar over bare canvas).
  useEffect(() => { if (focusId) setSelId((s) => s ?? focusId); }, [focusId]);

  // Fit the whole graph to the screen, then centre on the focus node — same
  // glide as the tree view (content is centred in the canvas, so a content
  // point (nx,ny) reaches centre at tx = scale*(W/2 - nx)).
  const fit = Math.max(0.15, Math.min(1, (screenW - 40) / size.w, (screenH - 220) / size.h));
  const fitRef = useRef(fit); fitRef.current = fit;
  useEffect(() => {
    const p = positions.get(focusId);
    if (!p) return;
    const nx = p.x + off.x, ny = p.y + off.y;
    canvasRef.current?.reset(fit, fit * (size.w / 2 - nx), fit * (size.h / 2 - ny));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, fit]);

  useEffect(() => {
    onZoomReady?.({
      in: () => canvasRef.current?.zoomBy(1.25),
      out: () => canvasRef.current?.zoomBy(0.8),
      fit: () => canvasRef.current?.reset(fitRef.current, 0, 0),
    });
  }, [onZoomReady]);

  // Edges as draw-in paths (entrance like the tree view). Highlight changes
  // only per-line opacity — the shared progress stays settled, no redraw.
  const relColorOf = (t: Relationship['type']) =>
    t === 'parent' ? c.relParent : t === 'spouse' ? c.relPartner : t === 'sibling' ? c.relSibling : c.relOther;
  const edgeLines = useMemo<DrawLine[]>(() => {
    return relationships
      .filter((r) => positions.has(r.fromId) && positions.has(r.toId))
      .filter((r) => (r.type === 'parent' ? show.parent : r.type === 'spouse' ? show.spouse : r.type === 'sibling' ? show.sibling : true))
      .map((r) => {
        const a = AV(r.fromId), b = AV(r.toId);
        const on = !highlight || (highlight.has(r.fromId) && highlight.has(r.toId));
        return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, color: relColorOf(r.type), opacity: highlight ? (on ? 0.9 : 0.07) : 0.4 };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationships, positions, off, show, highlight, c]);
  const sibLines = useMemo<DrawLine[]>(() => {
    return siblingEdges
      .filter((r) => positions.has(r.fromId) && positions.has(r.toId))
      .map((r) => {
        const a = AV(r.fromId), b = AV(r.toId);
        const on = !highlight || (highlight.has(r.fromId) && highlight.has(r.toId));
        return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, color: c.relSibling, opacity: highlight ? (on ? 0.8 : 0.06) : 0.3 };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siblingEdges, positions, off, highlight, c]);
  const animate = motion && edgeLines.length + sibLines.length <= 300;
  const drawKey = `net-${members.length}`;

  const sel = selId ? adjacency.get(selId) : undefined;

  return (
    <View style={{ flex: 1 }}>
      <ZoomPanCanvas ref={canvasRef} initialScale={fit} minScale={0.15} maxScale={2.5}
        onTapEmpty={() => { if (Date.now() - lastPress.current > 350) setSelId(null); }}>
        <View style={{ width: size.w, height: size.h }}>
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
            <DrawLines lines={edgeLines} color={c.relOther} animate={animate} drawKey={drawKey} strokeWidth={1.4} />
            <DrawLines lines={sibLines} color={c.relSibling} animate={animate} drawKey={drawKey} strokeWidth={1.2} />
          </Svg>
          {members.filter((m) => positions.has(m.id)).map((m, idx) => {
            const p = P(m.id);
            const isMe = m.id === meId, isFocus = m.id === focusId;
            const dim = !!highlight && !highlight.has(m.id);
            const av = m.gender === 'female' ? c.cardF : m.gender === 'male' ? c.cardM : c.paper2;
            const tint = colorOf?.(m.id);
            const nodeBorder = isMe || isFocus ? c.accent : tint ?? c.line;
            return (
              <MorphNode key={m.id} x={p.x - 60} y={p.y - 16} i={idx}>
                <Pressable
                  // Tap selects AND sets the shared focus — so the person picked
                  // here stays focused when switching to Tree/Radial/Timeline.
                  onPress={() => { lastPress.current = Date.now(); setSelId(m.id); setFocusId(m.id); }}
                  onLongPress={() => setFocusId(m.id)}
                  style={{ width: 120, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: dim ? 0.22 : 1 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: av, borderWidth: isMe || isFocus || tint ? 2 : 1, borderColor: nodeBorder, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: nodeBorder, shadowOpacity: c.mode === 'dark' ? 0.4 : 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 3 }}>
                    {m.photoUrl
                      ? <Image source={{ uri: m.photoUrl }} style={{ width: '100%', height: '100%' }} />
                      : <Text style={{ color: c.inkSoft, fontFamily: font.sansBold, fontSize: 10 }}>{initials(m.name)}</Text>}
                  </View>
                  <Text numberOfLines={1} style={{ flex: 1, color: c.ink, fontFamily: font.sansSemi, fontSize: 11 }}>{labels.get(m.id) ?? m.name}</Text>
                </Pressable>
              </MorphNode>
            );
          })}
        </View>
      </ZoomPanCanvas>

      {/* edge legend — chips TOGGLE each line kind (siblings inferred, off by default) */}
      <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: c.paper, borderWidth: 1, borderColor: c.lineSoft, opacity: 0.95 }}>
        {([['parent', 'Parent', c.relParent], ['spouse', 'Partner', c.relPartner], ['sibling', 'Sibling', c.relSibling]] as const).map(([key, label, col]) => {
          const on = show[key];
          return (
            <Pressable key={key} onPress={() => setShow((s) => ({ ...s, [key]: !s[key] }))} hitSlop={4}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, backgroundColor: on ? c.accentSoft : 'transparent', opacity: on ? 1 : 0.55 }}>
              <View style={{ width: 14, height: 2.5, borderRadius: 2, backgroundColor: col }} />
              <Text style={{ color: on ? c.ink : c.mute, fontFamily: font.sansSemi, fontSize: 10.5 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!hideZoomUI && <ZoomButtons onIn={() => canvasRef.current?.zoomBy(1.25)} onOut={() => canvasRef.current?.zoomBy(0.8)} onFit={() => canvasRef.current?.reset(fit, 0, 0)} />}
      {sel ? <FocusBar member={sel} onOpen={() => onOpenProfile(sel)} onClose={() => setSelId(null)} extra={relToMe(members, relationships, sel.id, meId, terms)} /> : null}
    </View>
  );
}
