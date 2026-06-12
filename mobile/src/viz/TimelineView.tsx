// Timeline visualization (RN). Rows sorted by generation then birth year, on a
// shared horizontal year axis. Modes: Birth event (dot) / Lifespan (bar) /
// Lifespan + events. Living people get a FADING TAIL (gradient to transparent),
// not a hard stop — so they don't read as "died today". Tap a row to highlight
// relatives and label the relationship; tap an event marker for its tooltip.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import Svg, { Rect, Circle, Defs, LinearGradient, Stop, Line as SvgLine, G } from 'react-native-svg';
import { useTheme, radius, type Palette } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { VizSegment, ZoomButtons } from './vizChrome';
import { yearOf, computeGenerations, initials } from '../shared/adjacency';
import type { Adjacency } from '../shared/adjacency';
import type { Member, Relationship } from '../shared/types';

type Mode = 'dot' | 'bar' | 'events';
const ROW_H = 46;
const LABEL_W = 116;

const REL_LABEL: Record<string, string> = {
  parent: 'parent', child: 'child', partner: 'partner', 'ex-partner': 'ex-partner', sibling: 'sibling',
  mother: 'mother', father: 'father', son: 'son', daughter: 'daughter', brother: 'brother', sister: 'sister',
};

export function TimelineView({ members, relationships, adjacency, focusId, meId, setFocusId, onOpenProfile }: {
  members: Member[]; relationships: Relationship[]; adjacency: Adjacency; focusId: string; meId?: string;
  setFocusId: (id: string) => void; onOpenProfile: (m: Member) => void;
}) {
  const { c } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('bar');
  const [pxPerYear, setPxPerYear] = useState(8);
  const [userZoomed, setUserZoomed] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [tip, setTip] = useState<{ text: string } | null>(null);
  const currentYear = new Date().getFullYear();
  const zoom = (fn: (p: number) => number) => { setUserZoomed(true); setPxPerYear((p) => Math.max(2, Math.min(60, fn(p)))); };

  const generations = useMemo(() => computeGenerations(members, relationships), [members, relationships]);

  const rows = useMemo(() => {
    const list = members.map((m) => ({ m, gen: generations.get(m.id) ?? 0 }));
    list.sort((a, b) => (a.gen !== b.gen ? a.gen - b.gen : (yearOf(a.m.birthDate) ?? 9999) - (yearOf(b.m.birthDate) ?? 9999)));
    return list;
  }, [members, generations]);

  const { minY, maxY } = useMemo(() => {
    const years: number[] = [];
    members.forEach((m) => { const b = yearOf(m.birthDate); const d = yearOf(m.deathDate); if (b) years.push(b); if (d) years.push(d); });
    const min = Math.min(...years, currentYear) - 5;
    const max = Math.max(...years, currentYear) + 5;
    return { minY: Math.floor(min / 10) * 10, maxY: Math.ceil(max / 10) * 10 };
  }, [members, currentYear]);

  // Default-fit so the whole span (incl. today + living "fading tails") shows
  // without scrolling. Only until the user manually zooms.
  const fitPx = Math.max(2, Math.min(20, (screenW - LABEL_W - 24) / Math.max(1, maxY - minY)));
  useEffect(() => { if (!userZoomed) setPxPerYear(fitPx); }, [fitPx, userZoomed]);

  const contentW = (maxY - minY) * pxPerYear;
  const xOf = (year: number) => (year - minY) * pxPerYear;

  const highlight = useMemo(() => {
    if (!selId) return null;
    const labels = new Map<string, string>();
    for (const [id, n] of adjacency.neighborhood(selId, 1)) labels.set(id, n.label);
    return labels;
  }, [selId, adjacency]);

  const ticks = useMemo(() => {
    const step = pxPerYear < 6 ? 50 : pxPerYear < 12 ? 25 : pxPerYear < 25 ? 10 : 5;
    const arr: number[] = [];
    for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) arr.push(y);
    return arr;
  }, [pxPerYear, minY, maxY]);

  function tapRow(id: string) {
    setSelId(id);
    const m = adjacency.get(id);
    if (m) setTip({ text: `${m.name} · ${m.birthDate ? (m.deathDate ? `${yearOf(m.birthDate)}–${yearOf(m.deathDate)}` : `b. ${yearOf(m.birthDate)}`) : 'no dates'}` });
  }

  return (
    <View style={{ flex: 1 }}>
      <VizSegment value={mode} onChange={(v) => setMode(v as Mode)}
        options={[['dot', 'Birth event'], ['bar', 'Lifespan'], ['events', 'Lifespan + events']]} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: LABEL_W + contentW }}>
          <View>
            {/* Axis */}
            <View style={{ flexDirection: 'row', height: 26 }}>
              <View style={{ width: LABEL_W }} />
              <Svg width={contentW} height={26}>
                {ticks.map((y) => (
                  <G key={y}>
                    <SvgLine x1={xOf(y)} y1={0} x2={xOf(y)} y2={26} stroke={c.line} strokeWidth={1} />
                  </G>
                ))}
                <SvgLine x1={xOf(currentYear)} y1={0} x2={xOf(currentYear)} y2={26} stroke={c.accent} strokeWidth={1.5} strokeDasharray="3,3" />
              </Svg>
            </View>
            <View style={{ flexDirection: 'row', height: 14, marginBottom: 2 }}>
              <View style={{ width: LABEL_W }} />
              <View style={{ width: contentW }}>
                {ticks.map((y) => (
                  <Text key={y} style={{ position: 'absolute', left: xOf(y) - 14, color: c.mute, fontSize: 9 }}>{y}</Text>
                ))}
              </View>
            </View>

            {/* Rows */}
            {rows.map((row, idx) => {
              const m = row.m;
              const prevGen = idx > 0 ? rows[idx - 1].gen : null;
              const newGen = prevGen !== row.gen;
              const b = yearOf(m.birthDate);
              const dY = yearOf(m.deathDate);
              const alive = !dY;
              const end = dY ?? currentYear;
              const isMe = !!meId && m.id === meId;
              const isFocus = m.id === focusId;
              const relLabel = highlight?.get(m.id);
              const dim = !!highlight && !highlight.has(m.id) && m.id !== selId;
              return (
                <View key={m.id}>
                  {newGen ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                      <Text style={{ color: c.mute, fontSize: 10, fontWeight: '700', width: LABEL_W, paddingLeft: 6 }}>GEN {row.gen + 1}</Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: c.lineSoft }} />
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', height: ROW_H, opacity: dim ? 0.3 : 1 }}>
                    {/* Label */}
                    <Pressable onPress={() => tapRow(m.id)} style={{ width: LABEL_W, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6 }}>
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: m.gender === 'female' ? c.cardF : c.cardM, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: c.inkSoft, fontSize: 9, fontWeight: '700' }}>{initials(m.name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: isFocus ? c.accent : c.ink, fontSize: 11, fontWeight: '600' }}>{m.name}</Text>
                        {relLabel ? <Text style={{ color: c.relChild, fontSize: 9, fontWeight: '700' }}>{REL_LABEL[relLabel] ?? relLabel}</Text>
                          : <Text style={{ color: c.mute, fontSize: 9 }}>{b ? (dY ? `${b}–${dY}` : `b.${b}`) : '—'}</Text>}
                      </View>
                    </Pressable>
                    {/* Track — Svg draws; a transparent overlay handles taps so the
                        SVG element never receives RN responder props (web warning). */}
                    <View style={{ width: contentW, height: ROW_H }}>
                      <Svg width={contentW} height={ROW_H} pointerEvents="none">
                        <Defs>
                          <LinearGradient id={`fade-${m.id}`} x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor={c.relChild} stopOpacity="0.9" />
                            <Stop offset="0.78" stopColor={c.relChild} stopOpacity="0.9" />
                            <Stop offset="1" stopColor={c.relChild} stopOpacity="0" />
                          </LinearGradient>
                        </Defs>
                        {b != null && mode === 'dot' ? (
                          <Circle cx={xOf(b)} cy={ROW_H / 2} r={6} fill={isMe ? c.accent : c.relParent} />
                        ) : null}
                        {b != null && mode !== 'dot' ? (
                          alive ? (
                            // Living: fading tail extending past today — "infinite rod".
                            <Rect x={xOf(b)} y={ROW_H / 2 - 5} width={Math.max((end - b) * pxPerYear + 40, 10)} height={10} rx={5}
                              fill={`url(#fade-${m.id})`} />
                          ) : (
                            <Rect x={xOf(b)} y={ROW_H / 2 - 5} width={Math.max((end - b) * pxPerYear, 6)} height={10} rx={5}
                              fill={isMe ? c.accent : c.relParent} opacity={0.85} />
                          )
                        ) : null}
                      </Svg>
                      <Pressable onPress={() => tapRow(m.id)} style={StyleSheet.absoluteFill} />
                      {mode === 'events' ? adjacency.children(m.id).map((cid) => {
                        const ch = adjacency.get(cid); const cy = yearOf(ch?.birthDate);
                        if (!cy || !ch) return null;
                        return (
                          <Pressable key={cid} onPress={() => setTip({ text: `${m.name}: birth of ${ch.name} · ${cy}` })}
                            style={{ position: 'absolute', left: xOf(cy) - 7, top: ROW_H / 2 - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: c.rose, borderWidth: 1, borderColor: c.bg }} />
                        );
                      }) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Zoom */}
      <ZoomButtons onIn={() => zoom((p) => p * 1.3)} onOut={() => zoom((p) => p / 1.3)} onFit={() => { setUserZoomed(false); setPxPerYear(fitPx); }} />

      {/* Tooltip / selection */}
      {tip ? (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 16 }} pointerEvents="box-none">
          <GlassSurface rounded={radius.lg}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
              <Text style={{ color: c.ink, flex: 1, fontSize: 13 }}>{tip.text}</Text>
              {selId ? (
                <Pressable onPress={() => { const m = adjacency.get(selId); if (m) onOpenProfile(m); }} style={{ backgroundColor: c.accent, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Profile →</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => { setTip(null); setSelId(null); }} hitSlop={10}><Text style={{ color: c.mute, fontSize: 18 }}>×</Text></Pressable>
            </View>
          </GlassSurface>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({});
