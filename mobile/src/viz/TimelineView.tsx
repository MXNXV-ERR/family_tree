// Timeline visualization (RN). Rows sorted by generation then birth year, on a
// shared horizontal year axis. Modes: Birth event (dot) / Lifespan (bar) /
// Lifespan + events. Living people get a FADING TAIL (gradient to transparent),
// not a hard stop. Events carry icons: birth=cake, marriage/anniversary=ring,
// child=heart, death=flower — tap one for its tooltip. Tapping a row FOCUSES
// that person: relatives highlight with their relationship to the focused
// person, and the tooltip shows the focused person's relationship to YOU.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Linking, useWindowDimensions } from 'react-native';
import Svg, { Rect, Circle, Defs, LinearGradient, Stop, Line as SvgLine } from 'react-native-svg';
import { useTheme, radius, font, genderTint, type Palette } from '../theme/theme';
import { useSettings } from '../theme/SettingsContext';
import { GlassSurface } from '../theme/GlassSurface';
import { type ZoomApi } from './vizChrome';
import { Slider } from '../ui/Slider';
import { Icon, type IconName } from '../ui/Icon';
import { Avatar } from '../ui/primitives';
import { yearOf, computeGenerations } from '../shared/adjacency';
import { relationLabel } from '../shared/relationTo';
import { useRelTerms } from '../theme/RelTermsContext';
import type { Adjacency } from '../shared/adjacency';
import type { Member, Relationship, FamilyEvent } from '../shared/types';

type Mode = 'dot' | 'bar' | 'events';
const ROW_H = 48;
const LABEL_W = 132;

type LifeEvent = { year: number; icon: IconName; color: string; soft: string; label: string };

export function TimelineView({ members, relationships, events, adjacency, focusId, meId, setFocusId, onOpenProfile, onZoomReady, hideZoomUI }: {
  members: Member[]; relationships: Relationship[]; events?: FamilyEvent[]; adjacency: Adjacency; focusId: string; meId?: string;
  setFocusId: (id: string) => void; onOpenProfile: (m: Member) => void;
  onZoomReady?: (api: ZoomApi) => void; hideZoomUI?: boolean;
}) {
  const { c } = useTheme();
  const { terms } = useRelTerms();
  const { years } = useSettings();
  const { width: screenW } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('bar');
  const [pxPerYear, setPxPerYear] = useState(8);
  const [userZoomed, setUserZoomed] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [tip, setTip] = useState<{ text: string } | null>(null);
  const [evTip, setEvTip] = useState<FamilyEvent | null>(null);
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

  // Expose zoom so the desktop sub-bar can drive this view.
  const fitPxRef = useRef(fitPx); fitPxRef.current = fitPx;
  useEffect(() => {
    onZoomReady?.({
      in: () => zoom((p) => p * 1.3),
      out: () => zoom((p) => p / 1.3),
      fit: () => { setUserZoomed(false); setPxPerYear(fitPxRef.current); },
    });
  }, [onZoomReady]);

  const contentW = (maxY - minY) * pxPerYear;
  const xOf = (year: number) => (year - minY) * pxPerYear;

  // Relationship of every neighbour to the SELECTED (focused) person.
  const highlight = useMemo(() => {
    if (!selId) return null;
    const labels = new Map<string, string>();
    for (const [id, n] of adjacency.neighborhood(selId, 1)) labels.set(id, n.label);
    return labels;
  }, [selId, adjacency]);

  // Life events per member: birth, marriage (when the spouse edge carries a
  // marriageDate), children's births, death.
  const eventsOf = useMemo(() => {
    const map = new Map<string, LifeEvent[]>();
    if (mode !== 'events') return map;
    members.forEach((m) => {
      const out: LifeEvent[] = [];
      const b = yearOf(m.birthDate);
      if (b) out.push({ year: b, icon: 'cake', color: c.teal, soft: c.bg, label: `${m.name} born · ${b}` });
      relationships.forEach((r) => {
        if (r.type !== 'spouse' || r.fromId !== m.id || !r.marriageDate) return;
        const y = yearOf(r.marriageDate);
        const sp = adjacency.get(r.toId);
        if (y && sp) out.push({ year: y, icon: 'ring', color: c.rose, soft: c.roseSoft, label: `Married ${sp.name} · ${y}` });
      });
      adjacency.children(m.id).forEach((cid) => {
        const ch = adjacency.get(cid); const y = yearOf(ch?.birthDate);
        if (y && ch) out.push({ year: y, icon: 'heart', color: c.accent, soft: c.accentSoft, label: `Birth of ${ch.name} · ${y}` });
      });
      const d = yearOf(m.deathDate);
      if (d) out.push({ year: d, icon: 'flower', color: c.amber, soft: c.bg, label: `${m.name} passed away · ${d}` });
      map.set(m.id, out);
    });
    // Custom events linked to members also surface on those members' rows.
    (events ?? []).forEach((ev) => {
      const y = yearOf(ev.date);
      if (!y || !ev.memberIds) return;
      ev.memberIds.forEach((mid) => {
        const arr = map.get(mid);
        if (arr) arr.push({ year: y, icon: 'calendar', color: c.accent, soft: c.accentSoft, label: `${ev.title} · ${y}` });
      });
    });
    return map;
  }, [mode, members, relationships, adjacency, events, c]);

  // Standalone events lane (year-sorted) for all family events.
  const eventLane = useMemo(
    () => (mode === 'events' ? (events ?? []) : [])
      .map((ev) => ({ ev, year: yearOf(ev.date) }))
      .filter((e): e is { ev: FamilyEvent; year: number } => e.year != null),
    [mode, events],
  );

  const ticks = useMemo(() => {
    const step = pxPerYear < 6 ? 50 : pxPerYear < 12 ? 25 : pxPerYear < 25 ? 10 : 5;
    const arr: number[] = [];
    for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) arr.push(y);
    return arr;
  }, [pxPerYear, minY, maxY]);

  // Tap a row → focus that person + tooltip with their relationship to YOU.
  function tapRow(id: string) {
    setSelId(id);
    setFocusId(id);
    const m = adjacency.get(id);
    if (!m) return;
    const yrs = m.birthDate ? (m.deathDate ? `${yearOf(m.birthDate)}–${yearOf(m.deathDate)}` : `b. ${yearOf(m.birthDate)}`) : 'no dates';
    const rel = meId ? relationLabel(members, relationships, id, meId, terms) : undefined;
    const relTxt = id === meId ? 'You' : rel ? (rel.startsWith('Relation path') ? rel : `Your ${rel.toLowerCase()}`) : undefined;
    setTip({ text: `${m.name} · ${yrs}${relTxt ? ` · ${relTxt}` : ''}` });
  }

  return (
    <View style={{ flex: 1 }}>
      {/* toolbar — modes (left) + zoom slider & buttons (right); design style */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', padding: 4, gap: 2, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: radius.pill }}>
          {([['dot', screenW > 700 ? 'Birth event' : 'Birth'], ['bar', 'Lifespan'], ['events', screenW > 700 ? 'Lifespan + events' : 'Events']] as [Mode, string][]).map(([k, lb]) => {
            const on = mode === k;
            return (
              <Pressable key={k} onPress={() => setMode(k)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: on ? c.accent : 'transparent' }}>
                <Text style={{ color: on ? c.accentInk : c.inkSoft, fontFamily: font.sansSemi, fontSize: 12 }}>{lb}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flex: 1, minWidth: 8 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 12, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: radius.md }}>
          <Icon name="calendar" size={14} color={c.mute} />
          <Slider value={pxPerYear} min={2} max={60} step={1} width={108} onChange={(v) => { setUserZoomed(true); setPxPerYear(v); }} />
          <Text style={{ color: c.inkSoft, fontFamily: font.monoMed, fontSize: 11, width: 50 }}>{pxPerYear.toFixed(0)}px/yr</Text>
        </View>
        {!hideZoomUI && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([['minus', () => zoom((p) => p / 1.3)], ['plus', () => zoom((p) => p * 1.3)], ['target', () => { setUserZoomed(false); setPxPerYear(fitPx); }]] as [IconName, () => void][]).map(([n, fn]) => (
              <Pressable key={n} onPress={fn} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] })}>
                <Icon name={n} size={16} color={c.inkSoft} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: LABEL_W + contentW }}>
          <View>
            {/* Axis */}
            <View style={{ flexDirection: 'row', height: 26 }}>
              <View style={{ width: LABEL_W }} />
              <Svg width={contentW} height={26}>
                {ticks.map((y) => (
                  <SvgLine key={y} x1={xOf(y)} y1={0} x2={xOf(y)} y2={26} stroke={c.line} strokeWidth={1} />
                ))}
                <SvgLine x1={xOf(currentYear)} y1={0} x2={xOf(currentYear)} y2={26} stroke={c.teal} strokeWidth={1.5} strokeDasharray="3,3" />
              </Svg>
            </View>
            <View style={{ flexDirection: 'row', height: 14, marginBottom: 2 }}>
              <View style={{ width: LABEL_W }} />
              <View style={{ width: contentW }}>
                {ticks.map((y) => (
                  <Text key={y} style={{ position: 'absolute', left: xOf(y) - 14, color: c.mute, fontFamily: font.mono, fontSize: 9 }}>{y}</Text>
                ))}
              </View>
            </View>

            {/* Events lane — all family events on their own row */}
            {mode === 'events' && eventLane.length ? (
              <View style={{ flexDirection: 'row', height: ROW_H, marginBottom: 2 }}>
                <View style={{ width: LABEL_W, justifyContent: 'center', paddingLeft: 6 }}>
                  <Text style={{ color: c.accent, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.4 }}>EVENTS</Text>
                </View>
                <View style={{ width: contentW, height: ROW_H }}>
                  {eventLane.map(({ ev, year }) => (
                    <Pressable key={ev.id} onPress={() => { setEvTip(ev); setTip(null); setSelId(null); }}
                      style={{ position: 'absolute', left: xOf(year) - 11, top: ROW_H / 2 - 11, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft, borderWidth: 1.5, borderColor: c.accent }}>
                      <Icon name="calendar" size={11} color={c.accent} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
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
              const isSel = m.id === selId;
              const relLbl = highlight?.get(m.id);
              const dim = !!highlight && !highlight.has(m.id) && !isSel;
              const t = genderTint(c, m.gender);
              const barColor = isMe ? c.accent : t.ink;
              const events = eventsOf.get(m.id) ?? [];
              return (
                <View key={m.id}>
                  {newGen ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                      <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.6, width: LABEL_W, paddingLeft: 6 }}>GEN {row.gen + 1}</Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: c.lineSoft }} />
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', height: ROW_H, opacity: dim ? 0.32 : 1, backgroundColor: isSel ? c.accentSoft : 'transparent', borderRadius: 10 }}>
                    {/* Label — name always visible; relationship to the focused person when highlighted */}
                    <Pressable onPress={() => tapRow(m.id)} style={{ width: LABEL_W, flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 4, paddingRight: 6 }}>
                      <Avatar m={m} size={26} ring={isSel ? c.accent : undefined} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text numberOfLines={1} style={{ color: isSel ? c.accent : c.ink, fontFamily: font.sansSemi, fontSize: 11.5, flexShrink: 1 }}>{m.name}</Text>
                          {isMe ? (
                            <View style={{ backgroundColor: c.accent, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3 }}>
                              <Text style={{ color: c.accentInk, fontFamily: font.sansHeavy, fontSize: 7 }}>YOU</Text>
                            </View>
                          ) : null}
                        </View>
                        {relLbl && !isSel ? (
                          <Text numberOfLines={1} style={{ color: c.teal, fontFamily: font.sansBold, fontSize: 9 }}>{relLbl}</Text>
                        ) : years ? (
                          <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 9 }}>{b ? (dY ? `${b}–${dY}` : `b.${b}`) : '—'}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                    {/* Track — Svg draws; a transparent overlay handles taps so the
                        SVG element never receives RN responder props (web warning). */}
                    <View style={{ width: contentW, height: ROW_H }}>
                      <Svg width={contentW} height={ROW_H} pointerEvents="none">
                        <Defs>
                          <LinearGradient id={`fade-${m.id}`} x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor={barColor} stopOpacity="0.8" />
                            <Stop offset="0.78" stopColor={barColor} stopOpacity="0.7" />
                            <Stop offset="1" stopColor={barColor} stopOpacity="0" />
                          </LinearGradient>
                        </Defs>
                        {b != null && mode === 'dot' ? (
                          <Circle cx={xOf(b)} cy={ROW_H / 2} r={6} fill={barColor} stroke={c.bg} strokeWidth={2} />
                        ) : null}
                        {b != null && mode !== 'dot' ? (
                          <>
                            {alive ? (
                              // Living: fading tail extending past today — "infinite rod".
                              <Rect x={xOf(b)} y={ROW_H / 2 - 6} width={Math.max((end - b) * pxPerYear + 40, 10)} height={12} rx={6}
                                fill={`url(#fade-${m.id})`} />
                            ) : (
                              <Rect x={xOf(b)} y={ROW_H / 2 - 6} width={Math.max((end - b) * pxPerYear, 8)} height={12} rx={6}
                                fill={barColor} opacity={0.5} />
                            )}
                            {/* birth cap */}
                            <Rect x={xOf(b)} y={ROW_H / 2 - 7} width={4} height={14} rx={2} fill={barColor} />
                          </>
                        ) : null}
                      </Svg>
                      <Pressable onPress={() => tapRow(m.id)} style={StyleSheet.absoluteFill} />
                      {mode === 'events' ? events.map((ev, i) => (
                        <Pressable key={i} onPress={() => { setSelId(m.id); setTip({ text: ev.label }); }}
                          style={{
                            position: 'absolute', left: xOf(ev.year) - 9, top: ROW_H / 2 - 9, width: 18, height: 18,
                            borderRadius: 9, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: c.bg, borderWidth: 1.5, borderColor: ev.color,
                          }}>
                          <Icon name={ev.icon} size={10} stroke={2} color={ev.color} />
                        </Pressable>
                      )) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Tooltip / selection */}
      {tip ? (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 16 }} pointerEvents="box-none">
          <GlassSurface rounded={radius.lg}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
              <Text style={{ color: c.ink, flex: 1, fontFamily: font.sansMed, fontSize: 13 }}>{tip.text}</Text>
              {selId ? (
                <Pressable onPress={() => { const m = adjacency.get(selId); if (m) onOpenProfile(m); }} style={{ backgroundColor: c.accent, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 12 }}>Profile →</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => { setTip(null); setSelId(null); }} hitSlop={10}><Icon name="close" size={17} color={c.mute} /></Pressable>
            </View>
          </GlassSurface>
        </View>
      ) : null}

      {/* Event detail card (tap an events-lane marker) */}
      {evTip ? (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 16 }} pointerEvents="box-none">
          <GlassSurface rounded={radius.lg}>
            <View style={{ padding: 12, gap: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="calendar" size={16} color={c.accent} />
                <Text style={{ color: c.ink, flex: 1, fontFamily: font.sansBold, fontSize: 14 }}>{evTip.title}</Text>
                <Pressable onPress={() => setEvTip(null)} hitSlop={10}><Icon name="close" size={16} color={c.mute} /></Pressable>
              </View>
              <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>{evTip.date}{evTip.location ? ` · ${evTip.location}` : ''}</Text>
              {evTip.description ? <Text style={{ color: c.inkSoft, fontFamily: font.sans, fontSize: 12.5, lineHeight: 18 }}>{evTip.description}</Text> : null}
              {evTip.driveUrl ? (
                <Pressable onPress={() => Linking.openURL(evTip.driveUrl!).catch(() => {})} style={{ alignSelf: 'flex-start', marginTop: 3, backgroundColor: c.accent, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 6 }}>
                  <Text style={{ color: c.accentInk, fontFamily: font.sansBold, fontSize: 12 }}>Open link →</Text>
                </Pressable>
              ) : null}
            </View>
          </GlassSurface>
        </View>
      ) : null}

      {/* Event legend (events mode) */}
      {mode === 'events' && !tip ? (
        <View style={{ position: 'absolute', left: 12, bottom: 16 }} pointerEvents="none">
          <GlassSurface rounded={radius.md}>
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
              {([['cake', 'Birth', c.teal], ['ring', 'Marriage', c.rose], ['heart', 'Child', c.accent], ['flower', 'Passing', c.amber]] as [IconName, string, string][]).map(([ic, lb, col]) => (
                <View key={lb} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name={ic} size={11} stroke={2} color={col} />
                  <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 9.5 }}>{lb}</Text>
                </View>
              ))}
            </View>
          </GlassSurface>
        </View>
      ) : null}
    </View>
  );
}
