// Radial visualization (RN). Focus person at centre, relatives on rings.
// Fixes from the brief: relationship label is a pill ABOVE the card (never
// overlaps the name); cards are translucent glass; a "Focus" affordance recentres
// on a node. Tap a card to highlight its neighbours and reveal relationship pills.
import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Line as SvgLine, Circle } from 'react-native-svg';
import { useTheme, radius, type Palette } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { ZoomPanCanvas, type CanvasHandle } from './ZoomPanCanvas';
import { FocusBar, ZoomButtons } from './vizChrome';
import { layoutRadial, type RadialPos } from '../shared/radialLayout';
import { initials, lifespan } from '../shared/adjacency';
import type { Adjacency } from '../shared/adjacency';
import type { Member } from '../shared/types';

const REL_LABEL: Record<string, string> = {
  parent: 'Parent', child: 'Child', partner: 'Partner', 'ex-partner': 'Ex-partner', sibling: 'Sibling',
  mother: 'Mother', father: 'Father', son: 'Son', daughter: 'Daughter', brother: 'Brother', sister: 'Sister',
};

export function RadialView({ adjacency, focusId, meId, setFocusId, onOpenProfile }: {
  members: Member[]; adjacency: Adjacency; focusId: string; meId?: string;
  setFocusId: (id: string) => void; onOpenProfile: (m: Member) => void;
}) {
  const { c } = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [depth, setDepth] = useState(1);
  const [selId, setSelId] = useState<string | null>(null);
  const canvasRef = useRef<CanvasHandle>(null);

  const { positions, nodes, ringRadii } = useMemo(
    () => layoutRadial(adjacency, focusId, depth), [adjacency, focusId, depth],
  );

  const maxR = (ringRadii[ringRadii.length - 1] ?? 250) + 120;
  const C = maxR; // centre offset (stage is 2*maxR square)
  const stageSize = maxR * 2;
  const fit = Math.max(0.25, Math.min(1, (screenW - 40) / stageSize, (screenH - 220) / stageSize));
  const fitKey = `${focusId}-${depth}-${Math.round(maxR)}`;

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

  return (
    <View style={{ flex: 1 }}>
      {/* Depth control */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10 }}>
        <Text style={{ color: c.mute, fontSize: 13 }}>Depth</Text>
        {[1, 2, 3].map((d) => (
          <Pressable key={d} onPress={() => { setDepth(d); setSelId(null); }} style={[styles.depthBtn, { borderColor: depth === d ? c.accent : c.line, backgroundColor: depth === d ? c.accentSoft : 'transparent' }]}>
            <Text style={{ color: depth === d ? c.accent : c.inkSoft, fontWeight: '700' }}>{d}</Text>
          </Pressable>
        ))}
      </View>

      <ZoomPanCanvas key={fitKey} ref={canvasRef} initialScale={fit} minScale={0.2} maxScale={2.5} onTapEmpty={() => setSelId(null)}>
        <View style={{ width: stageSize, height: stageSize }}>
          <Svg width={stageSize} height={stageSize} style={StyleSheet.absoluteFill}>
            {ringRadii.map((r, i) => (
              <Circle key={i} cx={C} cy={C} r={r} fill="none" stroke={c.line} strokeWidth={1} opacity={0.4} />
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
              <RadialCard key={id} m={m} c={c} cx={p.x + C} cy={p.y + C} pos={p}
                isFocus={isFocus} isMe={isMe} dim={dim} selected={selId === id}
                relLabel={showPill ? REL_LABEL[node?.label ?? ''] ?? node?.label : undefined}
                relColor={relColor(node?.viaRel)}
                onPress={() => setSelId(id)}
                onFocus={() => { setFocusId(id); setSelId(null); }} />
            );
          })}
        </View>
      </ZoomPanCanvas>

      <ZoomButtons onIn={() => canvasRef.current?.zoomBy(1.25)} onOut={() => canvasRef.current?.zoomBy(0.8)} onFit={() => canvasRef.current?.reset(fit, 0, 0)} />
      {sel ? <FocusBar member={sel} onOpen={() => onOpenProfile(sel)} onClose={() => setSelId(null)} /> : null}
    </View>
  );
}

function RadialCard({ m, c, cx, cy, pos, isFocus, isMe, dim, selected, relLabel, relColor, onPress, onFocus }: {
  m: Member; c: Palette; cx: number; cy: number; pos: RadialPos; isFocus: boolean; isMe: boolean;
  dim: boolean; selected: boolean; relLabel?: string; relColor: string; onPress: () => void; onFocus: () => void;
}) {
  const w = isFocus ? 168 : pos.depth === 1 ? 150 : 116;
  const bg = m.gender === 'female' ? c.cardF : m.gender === 'male' ? c.cardM : c.paper;
  return (
    <View style={{ position: 'absolute', left: cx - w / 2, top: cy - 34, width: w, opacity: dim ? 0.3 : 1, alignItems: 'center' }}>
      {/* Relationship pill — sits ABOVE the card so it never overlaps the name */}
      {relLabel ? (
        <View style={{ marginBottom: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: c.bg, borderWidth: 1, borderColor: relColor }}>
          <Text style={{ color: relColor, fontSize: 10, fontWeight: '800' }}>{relLabel}</Text>
        </View>
      ) : null}
      <Pressable onPress={onPress} style={{ width: '100%' }}>
        <GlassSurface rounded={radius.lg} intensity={50} style={{ borderColor: isFocus ? c.accent : selected ? c.relChild : c.line, borderWidth: isFocus ? 2 : 1 }}>
          <View style={{ padding: 10, alignItems: 'center', flexDirection: w > 130 ? 'row' : 'column', gap: 8 }}>
            <View style={{ width: isFocus ? 48 : 38, height: isFocus ? 48 : 38, borderRadius: 24, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: c.inkSoft, fontWeight: '800', fontSize: isFocus ? 16 : 13 }}>{initials(m.name)}</Text>
            </View>
            <View style={{ flex: w > 130 ? 1 : undefined, alignItems: w > 130 ? 'flex-start' : 'center' }}>
              <Text numberOfLines={1} style={{ color: c.ink, fontWeight: '800', fontSize: isFocus ? 15 : 12, textAlign: 'center' }}>{m.name}</Text>
              <Text style={{ color: c.mute, fontSize: 10 }}>{lifespan(m)}</Text>
              {isMe ? <Text style={{ color: c.accent, fontSize: 9, fontWeight: '800' }}>YOU</Text> : null}
            </View>
          </View>
        </GlassSurface>
      </Pressable>
      {/* Bring-into-focus affordance, shown when a non-focus card is selected */}
      {selected && !isFocus ? (
        <Pressable onPress={onFocus} style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: c.accent }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>◎ Bring into focus</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  depthBtn: { width: 36, height: 32, borderWidth: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
