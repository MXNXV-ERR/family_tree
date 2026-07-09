// Shared age-order editing: the whole family snapshot into per-generation
// lists, reorder with arrows within a generation only, diffed into
// `birthOrder` (1..n per generation) writes on save. Used by the
// SiblingOrderSheet (bottom sheet / desktop drawer) and the Master Edit
// grid's "Age order" tab. Members with a real birth date still follow their
// date everywhere (adjacency.compareByAge — year wins); the arrows matter
// for the ones without one.
import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme, radius, font } from '../theme/theme';
import { GlassSurface } from '../theme/GlassSurface';
import { Icon } from '../ui/Icon';
import { computeGenerations, compareByAge, yearOf } from '../shared/adjacency';
import type { Member, Relationship } from '../shared/types';

export function useAgeOrder(members: Member[], relationships: Relationship[]) {
  const gens = useMemo(() => computeGenerations(members, relationships), [members, relationships]);
  // Snapshot into editable per-generation lists (live listener updates are
  // ignored while editing — the save is the source of truth).
  const snapshot = () => {
    const by = new Map<number, Member[]>();
    for (const m of members) {
      const g = gens.get(m.id) ?? 0;
      let arr = by.get(g);
      if (!arr) by.set(g, (arr = []));
      arr.push(m);
    }
    for (const arr of by.values()) arr.sort(compareByAge);
    return by;
  };
  const [groups, setGroups] = useState<Map<number, Member[]>>(snapshot);
  const [dirty, setDirty] = useState(false);

  const move = (g: number, idx: number, dir: -1 | 1) => {
    setGroups((prev) => {
      const arr = [...(prev.get(g) ?? [])];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      const next = new Map(prev);
      next.set(g, arr);
      return next;
    });
    setDirty(true);
  };

  const buildChanges = () => {
    const changes: { id: string; data: Partial<Member> }[] = [];
    for (const arr of groups.values()) {
      arr.forEach((m, i) => { if (m.birthOrder !== i + 1) changes.push({ id: m.id, data: { birthOrder: i + 1 } }); });
    }
    return changes;
  };

  const reset = () => { setGroups(snapshot()); setDirty(false); };

  // After a successful save with the editor still open: stamp the snapshot's
  // birthOrder to what was just written so buildChanges() diffs cleanly again.
  const markSaved = () => {
    setGroups((prev) => {
      const next = new Map<number, Member[]>();
      for (const [g, arr] of prev) next.set(g, arr.map((m, i) => ({ ...m, birthOrder: i + 1 })));
      return next;
    });
    setDirty(false);
  };

  const genKeys = [...groups.keys()].sort((a, b) => a - b);
  return { groups, genKeys, move, dirty, buildChanges, reset, markSaved };
}

// Pure list UI — no ScrollView of its own; the host controls scrolling.
export function AgeOrderGroups({ order, highlightId }: {
  order: ReturnType<typeof useAgeOrder>; highlightId?: string;
}) {
  const { c } = useTheme();
  return (
    <>
      <Text style={{ color: c.mute, fontFamily: font.sans, fontSize: 12, lineHeight: 17 }}>
        Use the arrows for members without a birth date. Anyone with a date keeps following it — a real date always wins over this order.
      </Text>
      {order.genKeys.map((g) => {
        const arr = order.groups.get(g)!;
        return (
          <GlassSurface key={g} rounded={radius.lg}>
            <View style={{ padding: 14, gap: 8 }}>
              <Text style={{ color: c.mute, fontFamily: font.monoMed, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Generation {g + 1} · eldest first
              </Text>
              {arr.map((m, i) => {
                const y = yearOf(m.birthDate);
                const hl = m.id === highlightId;
                return (
                  <View key={m.id} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10,
                    borderRadius: radius.md, borderWidth: 1, borderColor: hl ? c.accent : c.line, backgroundColor: c.paper,
                  }}>
                    <Text style={{ color: c.faint, fontFamily: font.monoMed, fontSize: 11, width: 18 }}>{i + 1}</Text>
                    <Text numberOfLines={1} style={{ flex: 1, color: c.ink, fontFamily: font.sansSemi, fontSize: 13.5 }}>{m.name}</Text>
                    <Text style={{ color: y ? c.teal : c.faint, fontFamily: font.mono, fontSize: 11 }}>{y ?? '—'}</Text>
                    <Pressable disabled={i === 0} onPress={() => order.move(g, i, -1)} hitSlop={6}
                      style={{ padding: 5, opacity: i === 0 ? 0.25 : 1, transform: [{ rotate: '180deg' }] }}>
                      <Icon name="chevD" size={15} color={c.inkSoft} />
                    </Pressable>
                    <Pressable disabled={i === arr.length - 1} onPress={() => order.move(g, i, 1)} hitSlop={6}
                      style={{ padding: 5, opacity: i === arr.length - 1 ? 0.25 : 1 }}>
                      <Icon name="chevD" size={15} color={c.inkSoft} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </GlassSurface>
        );
      })}
    </>
  );
}
