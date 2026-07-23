// One member's life as a vertical timeline: birth, marriages, each child's birth,
// death, and any custom family events linked to them. Vertical distance between
// events is proportional to the real time gap (clamped), so empty stretches read
// long and clusters stay tight — the same idea as the family TimelineView, per
// member. Icons render via EventGlyph (built-in or emoji).
import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTheme, font, radius } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { EventGlyph } from './EventIcon';
import { yearFrac, yearOf } from '../shared/adjacency';
import type { Adjacency } from '../shared/adjacency';
import type { Member, Relationship, FamilyEvent } from '../shared/types';

type LE = { frac: number; year?: number; icon: string; iconKind?: 'glyph' | 'emoji'; color: string; label: string; sub?: string };

const PX_PER_YEAR = 7;   // vertical scale
const MIN_GAP = 46;      // same-year events still separate
const MAX_GAP = 130;     // cap an otherwise huge empty stretch

export function LifeTimeline({ member, adjacency, relationships, events }: {
  member: Member; adjacency: Adjacency; relationships: Relationship[]; events?: FamilyEvent[];
}) {
  const { c } = useTheme();

  const items = useMemo<LE[]>(() => {
    const out: LE[] = [];
    const b = yearFrac(member.birthDate);
    if (b != null) out.push({ frac: b, year: yearOf(member.birthDate), icon: 'cake', color: c.teal, label: 'Born', sub: member.placeOfBirth });
    relationships.forEach((r) => {
      if (r.type !== 'spouse' || r.fromId !== member.id || !r.marriageDate) return;
      const f = yearFrac(r.marriageDate); const sp = adjacency.get(r.toId);
      if (f != null && sp) out.push({ frac: f, year: yearOf(r.marriageDate), icon: 'ring', color: c.rose, label: `Married ${sp.name}` });
    });
    adjacency.children(member.id).forEach((cid) => {
      const ch = adjacency.get(cid); const f = yearFrac(ch?.birthDate);
      if (f != null && ch) out.push({ frac: f, year: yearOf(ch?.birthDate), icon: 'heart', color: c.accent, label: `${ch.name} born` });
    });
    const d = yearFrac(member.deathDate);
    if (d != null) out.push({ frac: d, year: yearOf(member.deathDate), icon: 'flower', color: c.amber, label: 'Passed away' });
    (events ?? []).forEach((ev) => {
      if (!ev.memberIds?.includes(member.id)) return;
      const f = yearFrac(ev.date);
      if (f != null) out.push({ frac: f, year: yearOf(ev.date), icon: ev.icon ?? 'calendar', iconKind: ev.iconKind, color: c.accent, label: ev.title, sub: ev.location });
    });
    return out.sort((a, z) => a.frac - z.frac);
  }, [member, adjacency, relationships, events, c]);

  if (items.length === 0) {
    return (
      <GlassSurface rounded={radius.lg}>
        <Text style={{ color: c.mute, fontFamily: font.sans, textAlign: 'center', padding: 26 }}>No dated life events yet.</Text>
      </GlassSurface>
    );
  }

  // Proportional vertical positions with min/max clamp.
  const tops: number[] = [];
  let y = 0;
  items.forEach((it, i) => {
    if (i > 0) y += Math.min(MAX_GAP, Math.max(MIN_GAP, (it.frac - items[i - 1].frac) * PX_PER_YEAR));
    tops.push(y);
  });
  const totalH = (tops[tops.length - 1] ?? 0) + 36;

  return (
    <GlassSurface rounded={radius.lg}>
      <View style={{ padding: 16 }}>
        <View style={{ height: totalH }}>
          {/* rail */}
          <View style={{ position: 'absolute', left: 17, top: 10, bottom: 10, width: 2, backgroundColor: c.lineSoft }} />
          {items.map((it, i) => (
            <View key={i} style={{ position: 'absolute', top: tops[i], left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 34, alignItems: 'center' }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.bg, borderWidth: 1.5, borderColor: it.color, alignItems: 'center', justifyContent: 'center' }}>
                  <EventGlyph icon={it.icon} iconKind={it.iconKind} size={15} color={it.color} />
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.sansSemi, fontSize: 14.5, flexShrink: 1 }}>{it.label}</Text>
                  {it.year != null ? <Text style={{ color: c.mute, fontFamily: font.mono, fontSize: 11 }}>{it.year}</Text> : null}
                </View>
                {it.sub ? <Text numberOfLines={1} style={{ color: c.mute, fontFamily: font.sans, fontSize: 12, marginTop: 1 }}>{it.sub}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      </View>
    </GlassSurface>
  );
}
