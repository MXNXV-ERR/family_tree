// Radial layout math — ported verbatim from the web RadialView (pure).
// Places the focus person at origin with relatives on concentric rings,
// spacing driven by card width and relaxed so cards don't overlap.
import type { Adjacency, NeighborNode } from './adjacency';

const SECTORS: Record<string, { center: number; max: number }> = {
  parent:  { center: -Math.PI / 2, max: Math.PI * 0.6 },
  partner: { center: 0,            max: Math.PI * 0.4 },
  child:   { center: Math.PI / 2,  max: Math.PI * 0.6 },
  sibling: { center: Math.PI,      max: Math.PI * 0.5 },
};

function arc(center: number, span: number, count: number): number[] {
  if (count <= 1) return [center];
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, i) => center - span / 2 + i * step);
}

function relaxRing(items: Array<{ id: string; angle: number }>, minGap: number) {
  if (items.length < 2) return;
  const TAU = Math.PI * 2;
  items.sort((a, b) => a.angle - b.angle);
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let i = 1; i < items.length; i++) {
      const gap = items[i].angle - items[i - 1].angle;
      if (gap < minGap) {
        const push = (minGap - gap) / 2;
        items[i - 1].angle -= push;
        items[i].angle += push;
        moved = true;
      }
    }
    const wrapGap = items[0].angle + TAU - items[items.length - 1].angle;
    if (wrapGap < minGap && items.length * minGap < TAU) {
      const push = (minGap - wrapGap) / 2;
      items[0].angle += push;
      items[items.length - 1].angle -= push;
      moved = true;
    }
    if (!moved) break;
    items.sort((a, b) => a.angle - b.angle);
  }
}

export type RadialPos = { x: number; y: number; depth: number; angle: number };

export type RadialLayout = {
  positions: Map<string, RadialPos>;
  nodes: Map<string, NeighborNode>;
  ringRadii: number[];
};

export function layoutRadial(adjacency: Adjacency, focusId: string, maxDepth: number): RadialLayout {
  const nodes = adjacency.neighborhood(focusId, maxDepth);

  const ring1: Record<string, string[]> = {};
  let ring1Count = 0;
  for (const [id, n] of nodes) {
    if (n.depth !== 1) continue;
    const key = n.label === 'ex-partner' ? 'partner' : n.label;
    (ring1[key] = ring1[key] || []).push(id);
    ring1Count++;
  }

  const CARD_ARC_1 = 160 + 40;
  const CARD_ARC_N = 120 + 44;
  let ring1Radius = 250;
  for (const key in ring1) {
    const sec = SECTORS[key] || { center: Math.PI / 2, max: Math.PI / 2 };
    const need = (CARD_ARC_1 * (ring1[key].length - 1)) / Math.max(sec.max, 0.1);
    ring1Radius = Math.max(ring1Radius, Math.min(560, need));
  }
  ring1Radius += Math.max(0, ring1Count - 7) * 10;
  const TAU = Math.PI * 2;
  // Floor ring 1 by its full-circle occupancy too, so relaxRing never has to
  // overlap cards it physically can't separate within the sector.
  ring1Radius = Math.max(ring1Radius, (CARD_ARC_1 * ring1Count) / TAU);
  const STEP = 210;
  // Precompute each ring's radius: at least STEP beyond the previous ring, and big
  // enough that every card on that ring fits around the full circle without overlap.
  // (The old fixed-step radius let dense outer rings collide — the "overlap" flaw.)
  const depthCount: number[] = [];
  for (const [, n] of nodes) if (n.depth >= 1) depthCount[n.depth] = (depthCount[n.depth] || 0) + 1;
  const radii: number[] = [];
  radii[1] = ring1Radius;
  for (let d = 2; d <= maxDepth; d++) {
    const need = ((depthCount[d] || 0) * CARD_ARC_N) / TAU;
    radii[d] = Math.max(radii[d - 1] + STEP, need);
  }
  const radiusOf = (d: number) => (d <= 0 ? 0 : radii[d] ?? ring1Radius + (d - 1) * STEP);

  const pos = new Map<string, RadialPos>();
  pos.set(focusId, { x: 0, y: 0, depth: 0, angle: 0 });

  const ring1Items: Array<{ id: string; angle: number }> = [];
  const perNode1 = CARD_ARC_1 / ring1Radius;
  for (const key in ring1) {
    const sec = SECTORS[key] || { center: Math.PI / 2, max: Math.PI / 2 };
    const ids = ring1[key];
    const span = Math.min(perNode1 * (ids.length - 1), sec.max);
    const angles = arc(sec.center, span, ids.length);
    ids.forEach((id, i) => ring1Items.push({ id, angle: angles[i] }));
  }
  relaxRing(ring1Items, perNode1 * 0.9);
  ring1Items.forEach(({ id, angle }) => {
    pos.set(id, { x: Math.cos(angle) * ring1Radius, y: Math.sin(angle) * ring1Radius, depth: 1, angle });
  });

  for (let d = 2; d <= maxDepth; d++) {
    const r = radiusOf(d);
    const minGap = CARD_ARC_N / r;
    const byVia: Record<string, string[]> = {};
    for (const [id, n] of nodes) {
      if (n.depth !== d || !n.viaId) continue;
      (byVia[n.viaId] = byVia[n.viaId] || []).push(id);
    }
    const items: Array<{ id: string; angle: number }> = [];
    for (const viaId in byVia) {
      const via = pos.get(viaId);
      if (!via) continue;
      const ids = byVia[viaId];
      const angles = arc(via.angle, minGap * (ids.length - 1), ids.length);
      ids.forEach((id, i) => items.push({ id, angle: angles[i] }));
    }
    relaxRing(items, minGap);
    items.forEach(({ id, angle }) => {
      pos.set(id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r, depth: d, angle });
    });
  }

  const ringRadii = Array.from({ length: maxDepth }, (_, i) => radiusOf(i + 1));
  return { positions: pos, nodes, ringRadii };
}
