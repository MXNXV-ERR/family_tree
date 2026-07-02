// Visualization name labels (pure). When the "first names" display setting is
// on, every node shows just the first name — unless two people share it, in
// which case each gets a last-name initial ("Ravi K."). If even that collides
// (Ravi Kumar / Ravi Krishnan) those people fall back to their full name.
export interface Named { id: string; name: string }

const firstOf = (name: string) => name.trim().split(/\s+/)[0] ?? name.trim();

export function displayLabels(members: Named[], firstOnly: boolean): Map<string, string> {
  const out = new Map<string, string>();
  if (!firstOnly) {
    for (const m of members) out.set(m.id, m.name);
    return out;
  }

  const firstCounts = new Map<string, number>();
  for (const m of members) {
    const f = firstOf(m.name).toLowerCase();
    firstCounts.set(f, (firstCounts.get(f) ?? 0) + 1);
  }

  // Duplicated first names pick up a last-name initial.
  const draft = new Map<string, string>();
  for (const m of members) {
    const parts = m.name.trim().split(/\s+/);
    const f = parts[0] ?? m.name;
    if ((firstCounts.get(f.toLowerCase()) ?? 0) <= 1 || parts.length < 2) {
      draft.set(m.id, f);
      continue;
    }
    draft.set(m.id, `${f} ${parts[parts.length - 1][0].toUpperCase()}.`);
  }

  // Initials that STILL collide (same first + same last initial) → full name.
  const draftCounts = new Map<string, number>();
  for (const v of draft.values()) draftCounts.set(v.toLowerCase(), (draftCounts.get(v.toLowerCase()) ?? 0) + 1);
  for (const m of members) {
    const v = draft.get(m.id)!;
    const collides = (draftCounts.get(v.toLowerCase()) ?? 0) > 1 && v !== firstOf(m.name);
    out.set(m.id, collides ? m.name : v);
  }
  return out;
}
