// Pure relationship planner (Phase 2). Given current members + edges and a
// requested link between two EXISTING members, returns the edges to create,
// with cascade semantics ported from the web `familyActions`, plus hard-block
// errors and soft warnings — each with a human reason.
//
// Edge convention (CLAUDE.md): parent = {fromId: CHILD, toId: PARENT};
// spouse + sibling are bidirectional (two docs).
import type { Member, Relationship } from './types';

export type LinkKind = 'child' | 'parent' | 'spouse' | 'sibling';

export type NewEdge = Omit<Relationship, 'id'>;

export interface LinkPlan {
  ok: boolean;
  error?: string;       // hard block — nothing is written
  warnings: string[];   // soft — user may proceed anyway
  edges: NewEdge[];     // edges to create (deduped against existing)
}

const nameOf = (members: Member[], id: string) => members.find((m) => m.id === id)?.name ?? 'this person';
const yr = (d?: string) => (d ? Number(d.slice(0, 4)) : undefined);

// The graph helpers only read type/fromId/toId/status, so they work on both
// stored Relationships and not-yet-saved NewEdges (closure / import planning).
type EdgeLike = Pick<Relationship, 'type' | 'fromId' | 'toId'> & { status?: Relationship['status'] };

// parent edges: fromId = child, toId = parent.
const parentsOf = (rels: EdgeLike[], id: string) =>
  rels.filter((r) => r.type === 'parent' && r.fromId === id).map((r) => r.toId);
const childrenOf = (rels: EdgeLike[], id: string) =>
  rels.filter((r) => r.type === 'parent' && r.toId === id).map((r) => r.fromId);
const currentSpousesOf = (rels: EdgeLike[], id: string) =>
  rels.filter((r) => r.type === 'spouse' && r.fromId === id && r.status !== 'divorced').map((r) => r.toId);

// Walk parent edges upward to collect all ancestors of `id`.
function ancestorsOf(rels: EdgeLike[], id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...parentsOf(rels, id)];
  while (stack.length) {
    const p = stack.pop()!;
    if (seen.has(p)) continue;
    seen.add(p);
    stack.push(...parentsOf(rels, p));
  }
  return seen;
}

const hasParentEdge = (rels: EdgeLike[], child: string, parent: string) =>
  rels.some((r) => r.type === 'parent' && r.fromId === child && r.toId === parent);
const hasSpouseEdge = (rels: EdgeLike[], a: string, b: string) =>
  rels.some((r) => r.type === 'spouse' && r.fromId === a && r.toId === b);
const hasSiblingEdge = (rels: EdgeLike[], a: string, b: string) =>
  rels.some((r) => r.type === 'sibling' && r.fromId === a && r.toId === b);

// Build the plan. `aId`/`bId` are existing member ids; `kind` is A's role w.r.t. B.
export function planRelationship(
  members: Member[],
  rels: Relationship[],
  aId: string,
  bId: string,
  kind: LinkKind,
  status: 'current' | 'divorced' = 'current',
  marriageDate?: string,
): LinkPlan {
  const warnings: string[] = [];
  const A = nameOf(members, aId);
  const B = nameOf(members, bId);

  if (!aId || !bId) return { ok: false, error: 'Pick both people to link.', warnings, edges: [] };
  if (aId === bId) return { ok: false, error: "Can't link a person to themselves.", warnings, edges: [] };

  // Normalize to a canonical child→parent pair for parent/child kinds.
  if (kind === 'parent') return planRelationship(members, rels, bId, aId, 'child', status); // A parent of B == B child of A
  if (kind === 'child') return planParent(members, rels, aId, bId, A, B, warnings);
  if (kind === 'spouse') return planSpouse(members, rels, aId, bId, A, B, status, warnings, marriageDate);
  return planSibling(members, rels, aId, bId, A, B, warnings);
}

// A is child of B.
function planParent(members: Member[], rels: Relationship[], childId: string, parentId: string, child: string, parent: string, warnings: string[]): LinkPlan {
  if (hasParentEdge(rels, childId, parentId))
    return { ok: false, error: `${child} is already recorded as ${parent}'s child.`, warnings, edges: [] };

  // Cycle: making child→parent would close a loop if child is already an ancestor of parent.
  if (ancestorsOf(rels, parentId).has(childId))
    return { ok: false, error: `${parent} is already a descendant of ${child}; this link would create a loop.`, warnings, edges: [] };

  // Age sanity (soft).
  const cy = yr(members.find((m) => m.id === childId)?.birthDate);
  const py = yr(members.find((m) => m.id === parentId)?.birthDate);
  if (cy !== undefined && py !== undefined && cy < py)
    warnings.push(`${child} was born before ${parent} — check the dates.`);

  const edges: NewEdge[] = [{ fromId: childId, toId: parentId, type: 'parent' }];

  // Cascade: also link the child to the parent's current spouse(s) as a parent.
  for (const sp of currentSpousesOf(rels, parentId)) {
    if (sp !== childId && !hasParentEdge(rels, childId, sp))
      edges.push({ fromId: childId, toId: sp, type: 'parent' });
  }
  // Cascade: bidirectional sibling links to the parent's other children.
  for (const sib of childrenOf(rels, parentId)) {
    if (sib === childId) continue;
    if (!hasSiblingEdge(rels, childId, sib)) edges.push({ fromId: childId, toId: sib, type: 'sibling' });
    if (!hasSiblingEdge(rels, sib, childId)) edges.push({ fromId: sib, toId: childId, type: 'sibling' });
  }
  return { ok: true, warnings, edges };
}

function planSpouse(members: Member[], rels: Relationship[], aId: string, bId: string, A: string, B: string, status: 'current' | 'divorced', warnings: string[], marriageDate?: string): LinkPlan {
  if (hasSpouseEdge(rels, aId, bId) || hasSpouseEdge(rels, bId, aId))
    return { ok: false, error: `${A} and ${B} are already linked as spouses.`, warnings, edges: [] };

  if (status === 'current') {
    const aSp = currentSpousesOf(rels, aId).find((s) => s !== bId);
    const bSp = currentSpousesOf(rels, bId).find((s) => s !== aId);
    if (aSp) return { ok: false, error: `${A} already has a current spouse (${nameOf(members, aSp)}). Mark that marriage divorced first.`, warnings, edges: [] };
    if (bSp) return { ok: false, error: `${B} already has a current spouse (${nameOf(members, bSp)}). Mark that marriage divorced first.`, warnings, edges: [] };
  }

  const md = marriageDate?.trim() || undefined;
  const edges: NewEdge[] = [
    { fromId: aId, toId: bId, type: 'spouse', status, ...(md ? { marriageDate: md } : {}) },
    { fromId: bId, toId: aId, type: 'spouse', status, ...(md ? { marriageDate: md } : {}) },
  ];
  // Cascade only for a current marriage: each partner becomes a parent of the other's existing children.
  if (status === 'current') {
    for (const c of childrenOf(rels, aId)) if (!hasParentEdge(rels, c, bId)) edges.push({ fromId: c, toId: bId, type: 'parent' });
    for (const c of childrenOf(rels, bId)) if (!hasParentEdge(rels, c, aId)) edges.push({ fromId: c, toId: aId, type: 'parent' });
  }
  return { ok: true, warnings, edges };
}

function planSibling(members: Member[], rels: Relationship[], aId: string, bId: string, A: string, B: string, warnings: string[]): LinkPlan {
  if (hasSiblingEdge(rels, aId, bId) || hasSiblingEdge(rels, bId, aId))
    return { ok: false, error: `${A} and ${B} are already recorded as siblings.`, warnings, edges: [] };

  const edges: NewEdge[] = [
    { fromId: aId, toId: bId, type: 'sibling' },
    { fromId: bId, toId: aId, type: 'sibling' },
  ];
  // Cascade: share parents both ways (a sibling shares the same parents).
  for (const p of parentsOf(rels, bId)) if (p !== aId && !hasParentEdge(rels, aId, p)) edges.push({ fromId: aId, toId: p, type: 'parent' });
  for (const p of parentsOf(rels, aId)) if (p !== bId && !hasParentEdge(rels, bId, p)) edges.push({ fromId: bId, toId: p, type: 'parent' });
  return { ok: true, warnings, edges };
}

// ---------------------------------------------------------------------------
// Graph closure — scan the WHOLE graph and return every implied edge that is
// missing, applying the same cascade rules as planRelationship to a fixpoint:
//   (a) current spouses co-parent each other's children (the "wife has a child
//       ⇒ the husband is also a parent" case), and
//   (b) children of the same parent are siblings.
// Used after a CSV import (which writes literal edges and skips planRelationship)
// and available as a one-shot repair. Pure: never mutates its inputs.
export function inferImpliedEdges(members: Member[], rels: EdgeLike[]): NewEdge[] {
  const ids = new Set(members.map((m) => m.id));
  const work: EdgeLike[] = rels.map((r) => ({ type: r.type, fromId: r.fromId, toId: r.toId, status: r.status }));
  const added: NewEdge[] = [];
  const push = (e: NewEdge) => { work.push(e); added.push(e); };

  let changed = true;
  let guard = 0;
  while (changed && guard++ < 50) {
    changed = false;

    // (a) current spouses co-parent each other's existing children. Done in both
    // directions per edge so a single (non-mirrored) spouse row still cascades.
    for (const sp of work.filter((r) => r.type === 'spouse' && r.status !== 'divorced')) {
      const a = sp.fromId, b = sp.toId;
      if (!ids.has(a) || !ids.has(b)) continue;
      for (const child of childrenOf(work, a)) {
        if (child !== b && !hasParentEdge(work, child, b)) { push({ fromId: child, toId: b, type: 'parent' }); changed = true; }
      }
      for (const child of childrenOf(work, b)) {
        if (child !== a && !hasParentEdge(work, child, a)) { push({ fromId: child, toId: a, type: 'parent' }); changed = true; }
      }
    }

    // (b) children of the same parent become bidirectional siblings.
    for (const m of members) {
      const kids = childrenOf(work, m.id);
      for (let i = 0; i < kids.length; i++) {
        for (let j = i + 1; j < kids.length; j++) {
          const x = kids[i], y = kids[j];
          if (!hasSiblingEdge(work, x, y)) { push({ fromId: x, toId: y, type: 'sibling' }); changed = true; }
          if (!hasSiblingEdge(work, y, x)) { push({ fromId: y, toId: x, type: 'sibling' }); changed = true; }
        }
      }
    }
  }
  return added;
}

// ---------------------------------------------------------------------------
// Unlink planner — the inverse of planRelationship. Given a relationship between
// two members, returns the relationship DOC ids to delete: the direct edge(s)
// for that kind, PLUS inferred sibling edges that this removal leaves
// unsupported (a sibling pair that shared a parent before but no longer does).
// Parent/spouse primary edges are kept so children aren't orphaned.
export interface UnlinkPlan { ids: string[]; }

export function planUnlink(
  members: Member[],
  rels: Relationship[],
  aId: string,
  bId: string,
  kind: LinkKind,
): UnlinkPlan {
  const toDelete = new Set<string>();

  if (kind === 'parent' || kind === 'child') {
    // child→parent edge convention; normalise A/B to child + parent.
    const childId = kind === 'child' ? aId : bId;
    const parentId = kind === 'child' ? bId : aId;
    for (const r of rels) if (r.type === 'parent' && r.fromId === childId && r.toId === parentId) toDelete.add(r.id);
  } else {
    // spouse + sibling are bidirectional — delete both docs.
    for (const r of rels) {
      if (r.type !== kind) continue;
      if ((r.fromId === aId && r.toId === bId) || (r.fromId === bId && r.toId === aId)) toDelete.add(r.id);
    }
  }

  const remaining = rels.filter((r) => !toDelete.has(r.id));
  const sharesParent = (set: EdgeLike[], x: string, y: string) => {
    const px = new Set(parentsOf(set, x));
    return parentsOf(set, y).some((p) => px.has(p));
  };
  // Prune sibling edges that lost their only shared parent because of this
  // removal (inferred); leave parentless / manually-added siblings untouched.
  for (const r of remaining) {
    if (r.type !== 'sibling') continue;
    if (sharesParent(rels, r.fromId, r.toId) && !sharesParent(remaining, r.fromId, r.toId)) toDelete.add(r.id);
  }

  return { ids: [...toDelete] };
}
