// Tree layout math — ported verbatim from the web TreeView (pure, DOM-free).
// Three layouts: pyramid (oldest at top), inverted (ancestors of focus),
// hourglass (ancestors + descendants of focus). Rendering is RN-side.
import type { Member } from './types';
import type { Adjacency } from './adjacency';
import { yearOf } from './adjacency';

export const NODE_W = 122, NODE_H = 76, COUPLE_GAP = 18;
export const COUPLE_W = NODE_W * 2 + COUPLE_GAP;
export const SIB_GAP = 28;
export const ROW_H = 160;

export type Pos = { x: number; y: number; isInLaw?: boolean };
export type CouplePill = { x: number; y: number; ids: [string, string]; status: 'current' | 'divorced' };
// ownerId = the parent-unit anchor the connector belongs to; the combined view
// tints each family's connectors with that family's colour (ids are namespaced).
export type Line = { d: string; kind: 'parent'; ownerId?: string };
export type LayoutResult = {
  positions: Map<string, Pos>;
  couplePills: CouplePill[];
  lines: Line[];
  width: number;
  height: number;
};

function makeKidsOf(adjacency: Adjacency) {
  return (id: string): string[] =>
    adjacency.children(id).slice().sort((a, b) => {
      const ya = yearOf(adjacency.get(a)?.birthDate) ?? 9999;
      const yb = yearOf(adjacency.get(b)?.birthDate) ?? 9999;
      if (ya !== yb) return ya - yb;
      return a.localeCompare(b);
    });
}

function makeGetPrimary(adjacency: Adjacency) {
  return (childId: string): string | undefined => {
    const ps = adjacency.parents(childId);
    if (ps.length === 0) return undefined;
    const sorted = ps.slice().sort((a, b) => {
      const aRoots = adjacency.parents(a).length > 0;
      const bRoots = adjacency.parents(b).length > 0;
      if (aRoots !== bRoots) return aRoots ? -1 : 1;
      const A = adjacency.get(a), B = adjacency.get(b);
      if ((A?.gender === 'male') !== (B?.gender === 'male')) return A?.gender === 'male' ? -1 : 1;
      return a.localeCompare(b);
    });
    return sorted[0];
  };
}

export function layoutPyramid(members: Member[], adjacency: Adjacency): LayoutResult {
  const getPrimary = makeGetPrimary(adjacency);
  const kidsOf = makeKidsOf(adjacency);
  const roots = members.filter((m) => adjacency.parents(m.id).length === 0);

  const marriedIn = (id: string): boolean => {
    const partners = [...adjacency.currentSpouses(id), ...adjacency.exSpouses(id)];
    return partners.length > 0 && partners.some((pid) => adjacency.parents(pid).length > 0);
  };
  const trueRoots = roots.filter((r) => !marriedIn(r.id));
  const effectiveRoots = trueRoots.length > 0 ? trueRoots : roots;

  const rootCouples: Array<{ id: string; partnerId?: string }> = [];
  const consumed = new Set<string>();
  effectiveRoots.forEach((r) => {
    if (consumed.has(r.id)) return;
    consumed.add(r.id);
    const partnerId = adjacency.currentSpouses(r.id).find((pid) => effectiveRoots.find((p) => p.id === pid));
    if (partnerId) consumed.add(partnerId);
    const myKids = kidsOf(r.id).filter((c) => getPrimary(c) === r.id).length;
    const partnerKids = partnerId ? kidsOf(partnerId).filter((c) => getPrimary(c) === partnerId).length : 0;
    if (partnerId && partnerKids > myKids) rootCouples.push({ id: partnerId, partnerId: r.id });
    else rootCouples.push({ id: r.id, partnerId });
  });

  const positions = new Map<string, Pos>();
  const couplePills: CouplePill[] = [];
  const lines: Line[] = [];
  const widths = new Map<string, number>();

  const computeWidth = (id: string): number => {
    if (widths.has(id)) return widths.get(id)!;
    if (positions.has(id)) { widths.set(id, 0); return 0; }
    const partner = adjacency.currentSpouses(id)[0] || adjacency.exSpouses(id)[0];
    const selfW = partner ? COUPLE_W : NODE_W;
    const kids = kidsOf(id).filter((c) => getPrimary(c) === id && !positions.has(c));
    if (kids.length === 0) { widths.set(id, selfW); return selfW; }
    const childW = kids.map(computeWidth).reduce((a, b) => a + b, 0) + SIB_GAP * (kids.length - 1);
    const w = Math.max(selfW, childW);
    widths.set(id, w);
    return w;
  };

  const place = (id: string, depth: number, leftX: number): void => {
    if (positions.has(id)) return;
    const w = widths.get(id)!;
    const partner = adjacency.currentSpouses(id)[0] || adjacency.exSpouses(id)[0];
    const isDivorced = !adjacency.currentSpouses(id)[0] && !!adjacency.exSpouses(id)[0];
    const selfW = partner ? COUPLE_W : NODE_W;
    const unitCenter = leftX + w / 2;
    const meX = unitCenter - selfW / 2;
    const meY = depth * ROW_H;
    positions.set(id, { x: meX, y: meY });
    if (partner && !positions.has(partner)) {
      positions.set(partner, { x: meX + NODE_W + COUPLE_GAP, y: meY, isInLaw: true });
      couplePills.push({ x: meX, y: meY, ids: [id, partner], status: isDivorced ? 'divorced' : 'current' });
    } else if (partner) {
      couplePills.push({ x: meX, y: meY, ids: [id, partner], status: isDivorced ? 'divorced' : 'current' });
    }

    const kids = kidsOf(id).filter((c) => getPrimary(c) === id && !positions.has(c));
    if (kids.length === 0) return;

    const childW = kids.map((k) => widths.get(k)!).reduce((a, b) => a + b, 0) + SIB_GAP * (kids.length - 1);
    let cursor = leftX + (w - childW) / 2;
    const childCenters: number[] = [];
    kids.forEach((k) => {
      place(k, depth + 1, cursor);
      const kw = widths.get(k)!;
      childCenters.push(cursor + kw / 2);
      cursor += kw + SIB_GAP;
    });

    const coupleCx = meX + selfW / 2;
    const coupleBottom = meY + NODE_H;
    const sibBarY = meY + NODE_H + (ROW_H - NODE_H) / 2;
    const nextRowY = (depth + 1) * ROW_H;

    lines.push({ d: `M ${coupleCx} ${coupleBottom} L ${coupleCx} ${sibBarY}`, kind: 'parent' });
    if (childCenters.length > 1) {
      lines.push({ d: `M ${Math.min(...childCenters)} ${sibBarY} L ${Math.max(...childCenters)} ${sibBarY}`, kind: 'parent' });
    }
    kids.forEach((k, i) => {
      const kPartner = adjacency.currentSpouses(k)[0] || adjacency.exSpouses(k)[0];
      const kSelfW = kPartner ? COUPLE_W : NODE_W;
      const kp = positions.get(k);
      const kCx = kp ? kp.x + kSelfW / 2 : childCenters[i];
      lines.push({ d: `M ${childCenters[i]} ${sibBarY} L ${childCenters[i]} ${nextRowY - 2} M ${childCenters[i]} ${nextRowY - 2} L ${kCx} ${nextRowY}`, kind: 'parent' });
    });
  };

  let cursor = 0;
  rootCouples.forEach((rc) => {
    widths.clear();
    const w = computeWidth(rc.id);
    if (w === 0) return;
    place(rc.id, 0, cursor);
    cursor += w + SIB_GAP * 3;
  });

  let maxX = 0, maxY = 0;
  positions.forEach((p) => {
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + NODE_H);
  });

  const leftovers = members.filter((m) => !positions.has(m.id));
  if (leftovers.length > 0) {
    const y = maxY === 0 ? 0 : maxY + (ROW_H - NODE_H);
    let x = 0;
    leftovers.forEach((m) => {
      positions.set(m.id, { x, y });
      x += NODE_W + SIB_GAP;
    });
    maxX = Math.max(maxX, x - SIB_GAP);
    maxY = y + NODE_H;
  }

  return { positions, couplePills, lines, width: maxX + 40, height: maxY + 40 };
}

// Generation level per member, RELATIVE and spouse-consistent: signed BFS where
// a parent is one level up (−1), a child one down (+1), and a spouse/sibling the
// SAME level (0). Unlike depth-from-root, this guarantees a married couple shares
// a row even when their two families have different ancestral depths — so the
// families fuse at the marriage instead of drifting apart. Each disconnected
// component is levelled on its own, then all are shifted so the minimum is 0.
function relativeGenerations(members: Member[], adjacency: Adjacency, inSet: Set<string>): Map<string, number> {
  const level = new Map<string, number>();
  for (const m of members) {
    if (level.has(m.id)) continue;
    level.set(m.id, 0);
    const queue: string[] = [m.id];
    while (queue.length) {
      const id = queue.shift()!;
      const L = level.get(id)!;
      const step = (nid: string, dl: number) => { if (inSet.has(nid) && !level.has(nid)) { level.set(nid, L + dl); queue.push(nid); } };
      for (const p of adjacency.parents(id)) step(p, -1);
      for (const ch of adjacency.children(id)) step(ch, +1);
      for (const s of adjacency.currentSpouses(id)) step(s, 0);
      for (const s of adjacency.exSpouses(id)) step(s, 0);
      for (const sb of adjacency.siblings(id)) step(sb, 0);
    }
  }
  let min = 0;
  for (const v of level.values()) min = Math.min(min, v);
  if (min !== 0) for (const [k, v] of level) level.set(k, v - min);
  return level;
}

// Layered (Sugiyama-style) layout: bands the WHOLE connected graph by global
// generation, keeps married couples together as one unit, and orders/positions
// by barycenter so parents sit over their children. Unlike layoutPyramid (which
// packs each ancestral root's subtree side-by-side), a graph connected through a
// marriage / shared person renders as ONE integrated tree — the two families'
// ancestries converge on the couple that joins them. Used by the combined view.
export function layoutLayered(members: Member[], adjacency: Adjacency): LayoutResult {
  const positions = new Map<string, Pos>();
  const couplePills: CouplePill[] = [];
  const lines: Line[] = [];
  if (!members.length) return { positions, couplePills, lines, width: 40, height: 40 };

  const inSet = new Set(members.map((m) => m.id));
  const gen = relativeGenerations(members, adjacency, inSet);
  const genOf = (id: string) => gen.get(id) ?? 0;
  const maxGen = members.reduce((mx, m) => Math.max(mx, genOf(m.id)), 0);
  const hasParents = (id: string) => adjacency.parents(id).some((p) => inSet.has(p));

  const spouseSameRow = (id: string): string | undefined => {
    for (const s of [...adjacency.currentSpouses(id), ...adjacency.exSpouses(id)])
      if (inSet.has(s) && genOf(s) === genOf(id)) return s;
    return undefined;
  };

  // A couple (both on the same row) is one placement unit; the anchor is the
  // partner with blood parents here (keeps a married-in spouse on the outside).
  const unitOf = new Map<string, string>();
  const unitPartner = new Map<string, string | undefined>();
  for (const m of members) {
    if (unitOf.has(m.id)) continue;
    const sp = spouseSameRow(m.id);
    if (sp && !unitOf.has(sp)) {
      let anchor = m.id, other = sp;
      const mMale = adjacency.get(m.id)?.gender === 'male';
      if (hasParents(sp) && !hasParents(m.id)) { anchor = sp; other = m.id; }
      else if (hasParents(m.id) === hasParents(sp) && !mMale && adjacency.get(sp)?.gender === 'male') { anchor = sp; other = m.id; }
      unitOf.set(anchor, anchor); unitOf.set(other, anchor);
      unitPartner.set(anchor, other);
    } else {
      unitOf.set(m.id, m.id);
      unitPartner.set(m.id, undefined);
    }
  }
  const anchors = members.map((m) => m.id).filter((id) => unitOf.get(id) === id);
  const unitWidth = (a: string) => (unitPartner.get(a) ? COUPLE_W : NODE_W);
  const membersOf = (a: string) => [a, unitPartner.get(a)].filter(Boolean) as string[];

  // Parent / child units (blood edges), so a couple's parents include BOTH
  // spouses' families — that's what pulls the two ancestries onto the couple.
  const unitParents = (a: string): string[] => {
    const ps = new Set<string>();
    for (const id of membersOf(a)) for (const p of adjacency.parents(id)) if (inSet.has(p)) ps.add(unitOf.get(p)!);
    return [...ps];
  };
  const unitChildren = (a: string): string[] => {
    const cs = new Set<string>();
    for (const id of membersOf(a)) for (const ch of adjacency.children(id)) if (inSet.has(ch)) cs.add(unitOf.get(ch)!);
    return [...cs];
  };

  const layerAnchors: string[][] = Array.from({ length: maxGen + 1 }, () => []);
  for (const a of anchors) layerAnchors[genOf(a)].push(a);

  // Ordering — each lower layer is ordered by its parent's position FIRST, so all
  // children of one couple stay contiguous (tight sib bars — interleaving other
  // families between siblings was what stretched connectors across the canvas),
  // then by birth year. A unit whose parents span two families sorts under the
  // earlier parent; x-centering below then pulls it between both.
  const orderIdx = new Map<string, number>();
  const setOrder = (layer: string[]) => layer.forEach((a, i) => orderIdx.set(a, i));
  const byYear = (a: string) => yearOf(adjacency.get(a)?.birthDate) ?? 9999;
  layerAnchors[0].sort((x, y) => byYear(x) - byYear(y) || x.localeCompare(y));
  setOrder(layerAnchors[0]);
  for (let g = 1; g <= maxGen; g++) {
    const parentKey = (a: string) => {
      const ps = unitParents(a).filter((p) => orderIdx.has(p)).map((p) => orderIdx.get(p)!);
      return ps.length ? Math.min(...ps) : Number.MAX_SAFE_INTEGER;
    };
    layerAnchors[g].sort((x, y) => parentKey(x) - parentKey(y) || byYear(x) - byYear(y) || x.localeCompare(y));
    setOrder(layerAnchors[g]);
  }

  // X coordinates — start packed, then pull each unit toward the mean centre of
  // its parents + children, resolving overlaps left-to-right. A few passes.
  const x = new Map<string, number>();
  for (let g = 0; g <= maxGen; g++) {
    let cx = 0;
    for (const a of layerAnchors[g]) { x.set(a, cx); cx += unitWidth(a) + SIB_GAP; }
  }
  const centreOf = (a: string) => x.get(a)! + unitWidth(a) / 2;
  const desired = (a: string) => {
    const nb = [...unitParents(a), ...unitChildren(a)].filter((n) => x.has(n));
    if (!nb.length) return x.get(a)!;
    return nb.reduce((s, n) => s + centreOf(n), 0) / nb.length - unitWidth(a) / 2;
  };
  // Pass count scales with graph size (big multi-family unions need more sweeps
  // to pull the joined ancestries together); overlap resolution alternates
  // direction so the layout doesn't drift rightward.
  const passes = Math.min(60, 14 + Math.floor(anchors.length / 2));
  for (let pass = 0; pass < passes; pass++) {
    for (let g = 0; g <= maxGen; g++) {
      const layer = layerAnchors[g];
      for (const a of layer) x.set(a, desired(a));
      if (pass % 2 === 0) {
        for (let i = 1; i < layer.length; i++) {
          const prev = layer[i - 1], cur = layer[i];
          const minX = x.get(prev)! + unitWidth(prev) + SIB_GAP;
          if (x.get(cur)! < minX) x.set(cur, minX);
        }
      } else {
        for (let i = layer.length - 2; i >= 0; i--) {
          const cur = layer[i], next = layer[i + 1];
          const maxX = x.get(next)! - unitWidth(cur) - SIB_GAP;
          if (x.get(cur)! > maxX) x.set(cur, maxX);
        }
      }
    }
  }
  let minX = Infinity;
  for (const a of anchors) minX = Math.min(minX, x.get(a)!);
  const shift = isFinite(minX) ? 20 - minX : 20;

  for (const a of anchors) {
    const ax = x.get(a)! + shift, y = genOf(a) * ROW_H;
    const partner = unitPartner.get(a);
    if (partner) {
      positions.set(a, { x: ax, y });
      positions.set(partner, { x: ax + NODE_W + COUPLE_GAP, y, isInLaw: !hasParents(partner) });
      const div = !adjacency.currentSpouses(a).includes(partner) && adjacency.exSpouses(a).includes(partner);
      couplePills.push({ x: ax, y, ids: [a, partner], status: div ? 'divorced' : 'current' });
    } else {
      positions.set(a, { x: ax, y });
    }
  }

  // Parent → children connectors (couple centre → sib bar → each child).
  // Sibling bars of DIFFERENT families share the corridor between two rows;
  // give each overlapping bar its own lane (a few px apart) so two families'
  // connectors run close and parallel instead of merging into one long line.
  const lanes: { x1: number; x2: number; lane: number }[][] = Array.from({ length: maxGen + 1 }, () => []);
  for (const a of anchors) {
    const kids = unitChildren(a);
    if (!kids.length) continue;
    const p = positions.get(a)!;
    const g = genOf(a);
    const coupleCx = p.x + unitWidth(a) / 2;
    const coupleBottom = p.y + NODE_H;
    const nextRowY = (g + 1) * ROW_H;
    const centers = kids.map((k) => (positions.get(k)!.x + unitWidth(k) / 2)).sort((m, n) => m - n);
    const x1 = Math.min(coupleCx, ...centers), x2 = Math.max(coupleCx, ...centers);
    const taken = new Set(lanes[g].filter((b) => b.x1 <= x2 + 10 && b.x2 >= x1 - 10).map((b) => b.lane));
    let lane = 0;
    while (taken.has(lane)) lane++;
    lanes[g].push({ x1, x2, lane });
    const sibBarY = coupleBottom + (ROW_H - NODE_H) / 2 + Math.min(lane, 8) * 7;
    lines.push({ d: `M ${coupleCx} ${coupleBottom} L ${coupleCx} ${sibBarY}`, kind: 'parent', ownerId: a });
    if (centers.length > 1) lines.push({ d: `M ${Math.min(...centers)} ${sibBarY} L ${Math.max(...centers)} ${sibBarY}`, kind: 'parent', ownerId: a });
    for (const cx of centers) lines.push({ d: `M ${cx} ${sibBarY} L ${cx} ${nextRowY}`, kind: 'parent', ownerId: a });
  }

  let maxX = 0, maxY = 0;
  positions.forEach((p) => { maxX = Math.max(maxX, p.x + NODE_W); maxY = Math.max(maxY, p.y + NODE_H); });
  return { positions, couplePills, lines, width: maxX + 40, height: maxY + 40 };
}

export function layoutInverted(focusId: string, adjacency: Adjacency, maxDepth = 4): LayoutResult {
  const positions = new Map<string, Pos>();
  const lines: Line[] = [];

  let actualMaxDepth = 0;
  const probe = (id: string, d: number): void => {
    if (d > maxDepth) return;
    const ps = adjacency.parents(id);
    if (ps.length === 0) return;
    actualMaxDepth = Math.max(actualMaxDepth, d);
    ps.forEach((p) => probe(p, d + 1));
  };
  probe(focusId, 1);
  const usedDepth = Math.max(1, actualMaxDepth);

  const colW = NODE_W + SIB_GAP;
  const maxSlots = Math.pow(2, usedDepth);
  const totalWidth = maxSlots * colW - SIB_GAP;
  const rowOf = (d: number) => (usedDepth - d) * ROW_H;

  positions.set(focusId, { x: (totalWidth - NODE_W) / 2, y: rowOf(0) });

  const placeAncestors = (memberId: string, depth: number, slotIdx: number): void => {
    if (depth > usedDepth) return;
    const ps = adjacency.parents(memberId);
    if (ps.length === 0) return;
    const sorted = ps.slice().sort((a, b) => {
      const A = adjacency.get(a), B = adjacency.get(b);
      if ((A?.gender === 'male') !== (B?.gender === 'male')) return A?.gender === 'male' ? -1 : 1;
      return 0;
    }).slice(0, 2);
    const slotW = totalWidth / Math.pow(2, depth);
    sorted.forEach((pid, i) => {
      const subSlot = slotIdx * 2 + i;
      const x = subSlot * slotW + (slotW - NODE_W) / 2;
      const y = rowOf(depth);
      positions.set(pid, { x, y });
      const childPos = positions.get(memberId);
      if (childPos) {
        const cx = x + NODE_W / 2, cy = y + NODE_H;
        const ccx = childPos.x + NODE_W / 2, ccy = childPos.y;
        const midY = (cy + ccy) / 2;
        lines.push({ d: `M ${cx} ${cy} L ${cx} ${midY} L ${ccx} ${midY} L ${ccx} ${ccy}`, kind: 'parent' });
      }
      placeAncestors(pid, depth + 1, subSlot);
    });
  };
  placeAncestors(focusId, 1, 0);

  return { positions, couplePills: [], lines, width: totalWidth + 40, height: rowOf(0) + NODE_H + 40 };
}

function shiftPath(d: string, dx: number, dy: number): string {
  return d.replace(/([ML])\s*(-?\d+(\.\d+)?)\s*(-?\d+(\.\d+)?)/g, (_, cmd: string, x: string, _2: string, y: string) =>
    `${cmd} ${Number(x) + dx} ${Number(y) + dy}`,
  );
}

export function layoutHourglass(focusId: string, members: Member[], adjacency: Adjacency, maxAncestors = 3): LayoutResult {
  const ancestorLayout = layoutInverted(focusId, adjacency, maxAncestors);
  const kidsOf = makeKidsOf(adjacency);

  const widths = new Map<string, number>();
  const positions = new Map<string, Pos>();
  const lines: Line[] = [];
  const couplePills: CouplePill[] = [];

  const w = (id: string): number => {
    if (widths.has(id)) return widths.get(id)!;
    const p = adjacency.currentSpouses(id)[0] || adjacency.exSpouses(id)[0];
    const selfW = p ? COUPLE_W : NODE_W;
    const kids = kidsOf(id);
    if (kids.length === 0) { widths.set(id, selfW); return selfW; }
    const cW = kids.map(w).reduce((a, b) => a + b, 0) + SIB_GAP * (kids.length - 1);
    const out = Math.max(selfW, cW);
    widths.set(id, out);
    return out;
  };

  const place = (id: string, depth: number, leftX: number): void => {
    const myW = w(id);
    const p = adjacency.currentSpouses(id)[0] || adjacency.exSpouses(id)[0];
    const isDiv = !adjacency.currentSpouses(id)[0] && !!adjacency.exSpouses(id)[0];
    const selfW = p ? COUPLE_W : NODE_W;
    const cx = leftX + myW / 2;
    const meX = cx - selfW / 2;
    const meY = depth * ROW_H;
    positions.set(id, { x: meX, y: meY });
    if (p) {
      positions.set(p, { x: meX + NODE_W + COUPLE_GAP, y: meY });
      couplePills.push({ x: meX, y: meY, ids: [id, p], status: isDiv ? 'divorced' : 'current' });
    }
    const kids = kidsOf(id);
    if (!kids.length) return;
    const cW = kids.map((k) => w(k)).reduce((a, b) => a + b, 0) + SIB_GAP * (kids.length - 1);
    let cursor = leftX + (myW - cW) / 2;
    const childCenters: number[] = [];
    kids.forEach((k) => {
      place(k, depth + 1, cursor);
      childCenters.push(cursor + w(k) / 2);
      cursor += w(k) + SIB_GAP;
    });
    const coupleCx = meX + selfW / 2;
    const coupleBottom = meY + NODE_H;
    const sibBarY = meY + NODE_H + (ROW_H - NODE_H) / 2;
    const nextRowY = (depth + 1) * ROW_H;
    lines.push({ d: `M ${coupleCx} ${coupleBottom} L ${coupleCx} ${sibBarY}`, kind: 'parent' });
    if (childCenters.length > 1) {
      lines.push({ d: `M ${Math.min(...childCenters)} ${sibBarY} L ${Math.max(...childCenters)} ${sibBarY}`, kind: 'parent' });
    }
    kids.forEach((k, i) => {
      const kP = adjacency.currentSpouses(k)[0] || adjacency.exSpouses(k)[0];
      const kSelfW = kP ? COUPLE_W : NODE_W;
      const kp = positions.get(k);
      const kCx = kp ? kp.x + kSelfW / 2 : childCenters[i];
      lines.push({ d: `M ${childCenters[i]} ${sibBarY} L ${childCenters[i]} ${nextRowY - 2} L ${kCx} ${nextRowY}`, kind: 'parent' });
    });
  };
  place(focusId, 0, 0);

  let dMaxX = 0, dMaxY = 0;
  positions.forEach((p) => { dMaxX = Math.max(dMaxX, p.x + NODE_W); dMaxY = Math.max(dMaxY, p.y + NODE_H); });

  const merged = { positions: new Map<string, Pos>(), couplePills: [] as CouplePill[], lines: [] as Line[] };
  const ancestorFocusPos = ancestorLayout.positions.get(focusId)!;
  const finalWidth = Math.max(ancestorLayout.width, dMaxX);
  const ancestorOffset = (finalWidth - ancestorLayout.width) / 2;
  const descOffset = (finalWidth - dMaxX) / 2;

  ancestorLayout.positions.forEach((p, id) => {
    if (id === focusId) return;
    merged.positions.set(id, { x: p.x + ancestorOffset, y: p.y });
  });
  ancestorLayout.lines.forEach((l) => merged.lines.push({ ...l, d: shiftPath(l.d, ancestorOffset, 0) }));

  positions.forEach((p, id) => merged.positions.set(id, { x: p.x + descOffset, y: p.y + ancestorFocusPos.y }));
  lines.forEach((l) => merged.lines.push({ ...l, d: shiftPath(l.d, descOffset, ancestorFocusPos.y) }));
  couplePills.forEach((c) => merged.couplePills.push({ ...c, x: c.x + descOffset, y: c.y + ancestorFocusPos.y }));

  let maxX = 0, maxY = 0;
  merged.positions.forEach((p) => { maxX = Math.max(maxX, p.x + NODE_W); maxY = Math.max(maxY, p.y + NODE_H); });

  return { positions: merged.positions, couplePills: merged.couplePills, lines: merged.lines, width: maxX + 40, height: maxY + 40 };
}
