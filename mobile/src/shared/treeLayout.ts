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
export type Line = { d: string; kind: 'parent' };
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
