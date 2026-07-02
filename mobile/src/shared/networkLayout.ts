// Force-directed (Fruchterman–Reingold) layout — pure, dependency-free. Lays the
// whole family out as a spring/repulsion network so clusters and cross-family
// links read at a glance (the "Network" visualization, à la a force graph).
// O(n²) per tick — fine for a family-sized graph (hundreds of nodes).
import type { Member, Relationship } from './types';

export type NetPos = { x: number; y: number };

export function layoutNetwork(
  members: Member[], relationships: Relationship[],
  opts?: { iterations?: number; area?: number },
): Map<string, NetPos> {
  const ids = members.map((m) => m.id);
  const n = ids.length;
  const pos = new Map<string, NetPos>();
  if (!n) return pos;

  const area = opts?.area ?? Math.max(600 * 600, n * 9000);
  const W = Math.sqrt(area);
  const k = Math.sqrt(area / n);            // ideal edge length
  // Deterministic seed on a circle so the layout is stable across re-renders.
  ids.forEach((id, i) => {
    const a = (i / n) * Math.PI * 2;
    pos.set(id, { x: Math.cos(a) * W * 0.4, y: Math.sin(a) * W * 0.4 });
  });

  const idx = new Set(ids);
  const edges = relationships
    .filter((r) => idx.has(r.fromId) && idx.has(r.toId) && r.fromId !== r.toId)
    .map((r) => [r.fromId, r.toId] as const);

  const iterations = opts?.iterations ?? 300;
  let temp = W * 0.1;
  const cool = temp / (iterations + 1);
  const disp = new Map<string, NetPos>(ids.map((id) => [id, { x: 0, y: 0 }]));

  for (let it = 0; it < iterations; it++) {
    for (const id of ids) { const d = disp.get(id)!; d.x = 0; d.y = 0; }
    // repulsion between every pair
    for (let i = 0; i < n; i++) {
      const a = pos.get(ids[i])!, da = disp.get(ids[i])!;
      for (let j = i + 1; j < n; j++) {
        const b = pos.get(ids[j])!;
        let dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const force = (k * k) / d;
        dx = (dx / d) * force; dy = (dy / d) * force;
        da.x += dx; da.y += dy;
        const db = disp.get(ids[j])!; db.x -= dx; db.y -= dy;
      }
    }
    // attraction along edges
    for (const [u, v] of edges) {
      const a = pos.get(u)!, b = pos.get(v)!;
      let dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const force = (d * d) / k;
      dx = (dx / d) * force; dy = (dy / d) * force;
      const da = disp.get(u)!, db = disp.get(v)!;
      da.x -= dx; da.y -= dy; db.x += dx; db.y += dy;
    }
    // move by displacement (capped by temperature) + a touch of centering
    for (const id of ids) {
      const dsp = disp.get(id)!, p = pos.get(id)!;
      const d = Math.hypot(dsp.x, dsp.y) || 0.01;
      p.x += (dsp.x / d) * Math.min(d, temp);
      p.y += (dsp.y / d) * Math.min(d, temp);
      p.x *= 0.999; p.y *= 0.999;
    }
    temp = Math.max(temp - cool, W * 0.001);
  }
  return pos;
}
