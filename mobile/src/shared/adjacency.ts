// In-memory family graph used by all three visualizations.
// Pure logic — ported verbatim from the web app (no DOM dependency).
import type { Member, Relationship } from './types';

export type SpouseEntry = { id: string; status: 'current' | 'divorced' };

export type Adjacency = {
  byId: Map<string, Member>;
  get(id: string): Member | undefined;
  parents(id: string): string[];
  children(id: string): string[];
  spouses(id: string): SpouseEntry[];
  currentSpouses(id: string): string[];
  exSpouses(id: string): string[];
  siblings(id: string): string[];
  grandparents(id: string): string[];
  grandchildren(id: string): string[];
  distance(fromId: string, toId: string): number;
  neighborhood(centerId: string, maxDepth: number): Map<string, NeighborNode>;
};

export type NeighborNode = {
  id: string;
  depth: number;
  label: string;
  viaId?: string;
  viaRel?: string;
};

// Distinct couples = unique unordered spouse pairs of CURRENT marriages between
// members that still exist. Skipping dangling edges (an endpoint was deleted —
// deleteMember now cleans these, but old data still has them) and divorced pairs
// stops the count from over-reporting; the {fromId,toId} dedupe handles the
// bidirectional/duplicated spouse docs.
export function countCouples(members: Member[], relationships: Relationship[]): number {
  const ids = new Set(members.map((m) => m.id));
  const pairs = new Set<string>();
  for (const r of relationships)
    if (r.type === 'spouse' && r.status !== 'divorced' && ids.has(r.fromId) && ids.has(r.toId))
      pairs.add([r.fromId, r.toId].sort().join('|'));
  return pairs.size;
}

export function buildAdjacency(members: Member[], relationships: Relationship[]): Adjacency {
  const byId = new Map(members.map((m) => [m.id, m]));
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const spouses = new Map<string, SpouseEntry[]>();

  members.forEach((m) => {
    parents.set(m.id, []);
    children.set(m.id, []);
    spouses.set(m.id, []);
  });

  relationships.forEach((r) => {
    if (!byId.has(r.fromId) || !byId.has(r.toId)) return; // skip dangling
    if (r.type === 'parent') {
      const ps = parents.get(r.fromId);
      if (ps && !ps.includes(r.toId)) ps.push(r.toId);
      const cs = children.get(r.toId);
      if (cs && !cs.includes(r.fromId)) cs.push(r.fromId);
    } else if (r.type === 'spouse') {
      const status = (r.status ?? 'current') as 'current' | 'divorced';
      const a = spouses.get(r.fromId);
      if (a && !a.some((s) => s.id === r.toId)) a.push({ id: r.toId, status });
      const b = spouses.get(r.toId);
      if (b && !b.some((s) => s.id === r.fromId)) b.push({ id: r.fromId, status });
    }
  });

  const siblings = new Map<string, string[]>();
  members.forEach((m) => {
    const sibs = new Set<string>();
    (parents.get(m.id) || []).forEach((pid) => {
      (children.get(pid) || []).forEach((cid) => {
        if (cid !== m.id) sibs.add(cid);
      });
    });
    siblings.set(m.id, [...sibs]);
  });

  const labelRelationship = (parentLabel: string, edge: string, parentDepth: number): string => {
    if (parentDepth === 0) return edge;
    if (parentLabel === 'parent' && edge === 'parent') return 'grandparent';
    if (parentLabel === 'parent' && edge === 'sibling') return 'aunt/uncle';
    if (parentLabel === 'parent' && edge === 'partner') return 'parent';
    if (parentLabel === 'child' && edge === 'child') return 'grandchild';
    if (parentLabel === 'child' && edge === 'partner') return 'in-law';
    if (parentLabel === 'sibling' && edge === 'partner') return 'in-law';
    if (parentLabel === 'sibling' && edge === 'child') return 'niece/nephew';
    if (parentLabel === 'partner' && edge === 'parent') return 'in-law';
    if (parentLabel === 'partner' && edge === 'sibling') return 'in-law';
    if (parentLabel === 'grandparent' && edge === 'parent') return 'great-grandparent';
    if (parentLabel === 'grandchild' && edge === 'child') return 'great-grandchild';
    if (parentLabel === 'aunt/uncle' && edge === 'child') return 'cousin';
    return 'relative';
  };

  return {
    byId,
    get: (id) => byId.get(id),
    parents: (id) => parents.get(id) || [],
    children: (id) => children.get(id) || [],
    spouses: (id) => spouses.get(id) || [],
    currentSpouses: (id) => (spouses.get(id) || []).filter((s) => s.status === 'current').map((s) => s.id),
    exSpouses: (id) => (spouses.get(id) || []).filter((s) => s.status === 'divorced').map((s) => s.id),
    siblings: (id) => siblings.get(id) || [],
    grandparents: (id) => {
      const out = new Set<string>();
      (parents.get(id) || []).forEach((p) => (parents.get(p) || []).forEach((gp) => out.add(gp)));
      return [...out];
    },
    grandchildren: (id) => {
      const out = new Set<string>();
      (children.get(id) || []).forEach((c) => (children.get(c) || []).forEach((gc) => out.add(gc)));
      return [...out];
    },
    distance: (fromId, toId) => {
      if (fromId === toId) return 0;
      const visited = new Set([fromId]);
      let frontier: string[] = [fromId];
      let d = 0;
      while (frontier.length) {
        d++;
        const next: string[] = [];
        for (const id of frontier) {
          const neighbors = new Set([
            ...(parents.get(id) || []),
            ...(children.get(id) || []),
            ...(spouses.get(id) || []).map((s) => s.id),
            ...(siblings.get(id) || []),
          ]);
          for (const n of neighbors) {
            if (visited.has(n)) continue;
            if (n === toId) return d;
            visited.add(n);
            next.push(n);
          }
        }
        frontier = next;
        if (d > 12) return Infinity;
      }
      return Infinity;
    },
    neighborhood: (centerId, maxDepth) => {
      const out = new Map<string, NeighborNode>();
      const visited = new Set([centerId]);
      let frontier: NeighborNode[] = [{ id: centerId, depth: 0, label: 'focus' }];
      while (frontier.length) {
        const next: NeighborNode[] = [];
        for (const node of frontier) {
          out.set(node.id, node);
          if (node.depth >= maxDepth) continue;
          const groups: Array<{ ids: string[]; label: string }> = [
            { ids: parents.get(node.id) || [], label: 'parent' },
            { ids: children.get(node.id) || [], label: 'child' },
            { ids: (spouses.get(node.id) || []).filter((s) => s.status === 'current').map((s) => s.id), label: 'partner' },
            { ids: (spouses.get(node.id) || []).filter((s) => s.status === 'divorced').map((s) => s.id), label: 'ex-partner' },
            { ids: siblings.get(node.id) || [], label: 'sibling' },
          ];
          for (const g of groups) {
            for (const id of g.ids) {
              if (visited.has(id)) continue;
              visited.add(id);
              const rel = labelRelationship(node.label, g.label, node.depth);
              next.push({ id, depth: node.depth + 1, label: rel, viaId: node.id, viaRel: g.label });
            }
          }
        }
        frontier = next;
      }
      return out;
    },
  };
}

export function computeGenerations(members: Member[], relationships: Relationship[]): Map<string, number> {
  const parents = new Map<string, string[]>();
  const spouses = new Map<string, string[]>();
  members.forEach((m) => {
    parents.set(m.id, []);
    spouses.set(m.id, []);
  });
  relationships.forEach((r) => {
    if (r.type === 'parent') parents.get(r.fromId)?.push(r.toId);
    if (r.type === 'spouse') {
      spouses.get(r.fromId)?.push(r.toId);
      spouses.get(r.toId)?.push(r.fromId);
    }
  });

  const memo = new Map<string, number | null>();
  const gen = (id: string): number | null => {
    if (memo.has(id)) return memo.get(id) ?? null;
    memo.set(id, 0);
    const ps = parents.get(id) || [];
    const inTree = ps.filter((p) => parents.has(p));
    const g: number | null = inTree.length === 0 ? null : Math.max(...inTree.map((p) => gen(p) ?? 0)) + 1;
    memo.set(id, g);
    return g;
  };
  members.forEach((m) => gen(m.id));

  let changed = true;
  let safety = 4;
  while (changed && safety-- > 0) {
    changed = false;
    members.forEach((m) => {
      if (memo.get(m.id) !== null) return;
      const sp = (spouses.get(m.id) || [])
        .map((s) => memo.get(s))
        .filter((g): g is number => g !== null && g !== undefined);
      if (sp.length > 0) {
        memo.set(m.id, Math.max(...sp));
        changed = true;
      }
    });
  }
  members.forEach((m) => {
    if (memo.get(m.id) === null) memo.set(m.id, 0);
  });
  const numericMemo = new Map<string, number>();
  memo.forEach((v, k) => numericMemo.set(k, v ?? 0));
  const min = Math.min(...[...numericMemo.values()]);
  if (min !== 0) numericMemo.forEach((v, k) => numericMemo.set(k, v - min));
  return numericMemo;
}

export const yearOf = (d?: string): number | undefined => (d ? Number(d.slice(0, 4)) : undefined);

// Age ordering for siblings / generation rows. Birth YEAR always wins when both
// are dated; the manual `birthOrder` (set via the sibling-order sheet) only
// decides among members whose years can't — so entering a real date later never
// leaves a stale manual arrangement in charge.
export function compareByAge(a?: Member, b?: Member): number {
  const ya = yearOf(a?.birthDate), yb = yearOf(b?.birthDate);
  if (ya != null && yb != null && ya !== yb) return ya - yb;
  const oa = a?.birthOrder, ob = b?.birthOrder;
  if (oa != null && ob != null && oa !== ob) return oa - ob;
  if (ya != null && yb == null) return -1; // dated members ahead of unknowns
  if (yb != null && ya == null) return 1;
  return (a?.id ?? '').localeCompare(b?.id ?? '');
}

export const lifespan = (m: Member): string => {
  const b = yearOf(m.birthDate);
  const d = yearOf(m.deathDate);
  if (!b) return '';
  if (d) return `${b} – ${d}`;
  return `b. ${b}`;
};

export const initials = (name: string): string =>
  name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
