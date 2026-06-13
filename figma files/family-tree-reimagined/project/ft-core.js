/* ft-core.js — adjacency + layout math for the visualizers.
   Pure JS, attached to window.FTCore. Layouts return:
   { nodes:[{id,x,y}], couples:[{x,y,w,status}], links:[{d}], width, height, focusId } */
(function () {
  const NODE_W = 158, NODE_H = 64, GAPX = 46, COUPLE_GAP = 10, GENV = 132, PAD = 60;
  const COUPLE_W = NODE_W * 2 + COUPLE_GAP;

  function buildAdj(members, rels) {
    const byId = new Map(members.map((m) => [m.id, m]));
    const parents = new Map(), children = new Map(), spouses = new Map();
    const add = (map, k, v) => { if (!map.has(k)) map.set(k, []); if (!map.get(k).includes(v)) map.get(k).push(v); };
    for (const r of rels) {
      if (r.type === 'parent') { add(parents, r.from, r.to); add(children, r.to, r.from); }
      else if (r.type === 'spouse') { add(spouses, r.a, r.b); add(spouses, r.b, r.a); spouses.get(r.a).status = r.status; }
    }
    const spouseStatus = new Map();
    for (const r of rels) if (r.type === 'spouse') { spouseStatus.set(r.a + '|' + r.b, r.status); spouseStatus.set(r.b + '|' + r.a, r.status); }
    const siblings = (id) => {
      const ps = parents.get(id) || [];
      const sib = new Set();
      for (const p of ps) for (const c of (children.get(p) || [])) if (c !== id) sib.add(c);
      return [...sib];
    };
    return {
      get: (id) => byId.get(id),
      parents: (id) => parents.get(id) || [],
      children: (id) => children.get(id) || [],
      spouses: (id) => spouses.get(id) || [],
      siblings,
      status: (a, b) => spouseStatus.get(a + '|' + b) || 'current',
      all: members,
    };
  }

  // ---- units: a couple or single, the layout atom ----
  function buildUnits(members, adj) {
    const placed = new Set();
    const units = new Map();
    const unitOf = new Map();
    for (const m of members) {
      if (placed.has(m.id)) continue;
      const partner = adj.spouses(m.id).find((p) => !placed.has(p) && members.some((x) => x.id === p));
      const mem = partner ? [m.id, partner] : [m.id];
      const uid = 'u_' + m.id;
      units.set(uid, { id: uid, members: mem, x: 0, y: 0 });
      mem.forEach((id) => { placed.add(id); unitOf.set(id, uid); });
    }
    // child units + parent links
    const parentOfUnit = new Map();
    for (const u of units.values()) {
      const kids = new Set();
      for (const mid of u.members) for (const c of adj.children(mid)) {
        const cu = unitOf.get(c);
        if (cu && cu !== u.id) kids.add(cu);
      }
      u.childUnits = [...kids];
      for (const cu of u.childUnits) if (!parentOfUnit.has(cu)) parentOfUnit.set(cu, u.id);
    }
    const roots = [...units.values()].filter((u) => !parentOfUnit.has(u.id));
    return { units, unitOf, parentOfUnit, roots };
  }

  const unitW = (u) => (u.members.length === 2 ? COUPLE_W : NODE_W);

  function elbow(x1, y1, x2, y2) {
    const my = (y1 + y2) / 2;
    return `M${x1} ${y1} V${my} H${x2} V${y2}`;
  }

  function assemble(units, focusId) {
    const nodes = [], couples = [], links = [];
    let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    const centerX = (u) => u.x + unitW(u) / 2;
    for (const u of units) {
      u.members.forEach((id, i) => {
        const x = u.x + i * (NODE_W + COUPLE_GAP);
        nodes.push({ id, x, y: u.y });
        minX = Math.min(minX, x); maxX = Math.max(maxX, x + NODE_W); maxY = Math.max(maxY, u.y + NODE_H);
      });
      if (u.members.length === 2) couples.push({ x: u.x - 6, y: u.y - 6, w: COUPLE_W + 12, status: u._status || 'current' });
    }
    for (const u of units) {
      const kids = u._kids || [];
      for (const k of kids) {
        links.push({ d: elbow(centerX(u), u.y + NODE_H, centerX(k), k.y) });
      }
    }
    // normalize
    const dx = PAD - minX, dy = PAD;
    for (const n of nodes) { n.x += dx; n.y += dy; }
    for (const c of couples) { c.x += dx; c.y += dy; }
    const shiftLinks = links.map((l) => ({ d: shiftPath(l.d, dx, dy) }));
    return {
      nodes, couples, links: shiftLinks, focusId,
      width: (maxX - minX) + PAD * 2, height: maxY + PAD * 2,
    };
  }

  function shiftPath(d, dx, dy) {
    return d.replace(/([MV H])\s*(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?/g, (m, cmd, a, b) => {
      if (cmd === 'M') return `M${(+a + dx).toFixed(1)} ${(+b + dy).toFixed(1)}`;
      if (cmd === 'V') return `V${(+a + dy).toFixed(1)}`;
      if (cmd === 'H') return `H${(+a + dx).toFixed(1)}`;
      return m;
    });
  }

  // ---------- PYRAMID (all roots, descendants down) ----------
  // Leaves take a global cursor (so nothing ever overlaps horizontally); a
  // parent centres over its children, but if that centre would collide with the
  // unit already placed to its left at the same depth, the whole subtree is
  // pushed right. This is what stops couple-cards from overlapping siblings.
  function layoutDescendants(members, adj, rootUnitIds) {
    const { units, parentOfUnit, roots } = buildUnits(members, adj);
    const useRoots = rootUnitIds ? rootUnitIds.map((id) => units.get(id)).filter(Boolean) : roots;
    let cursor = 0;
    const visited = new Set();
    const lastRight = new Map(); // depth -> right edge of last placed unit
    function shiftSub(u, dx) {
      u.x += dx;
      const r = u.x + unitW(u);
      lastRight.set(u._depth, Math.max(lastRight.get(u._depth) ?? -Infinity, r));
      cursor = Math.max(cursor, r + GAPX);
      for (const k of (u._kids || [])) shiftSub(k, dx);
    }
    function place(u, depth) {
      if (visited.has(u.id)) return u.x + unitW(u) / 2;
      visited.add(u.id);
      u._depth = depth;
      u.y = depth * GENV;
      const kids = (u.childUnits || []).map((k) => units.get(k)).filter((k) => k && parentOfUnit.get(k.id) === u.id && !visited.has(k.id));
      u._kids = kids;
      u._status = u.members.length === 2 ? adj.status(u.members[0], u.members[1]) : 'current';
      const minX = (lastRight.get(depth) ?? -Infinity) + GAPX;
      if (kids.length === 0) {
        u.x = Math.max(cursor, minX);
        cursor = u.x + unitW(u) + GAPX;
      } else {
        const centers = kids.map((k) => place(k, depth + 1));
        const c = (Math.min(...centers) + Math.max(...centers)) / 2;
        u.x = c - unitW(u) / 2;
        if (u.x < minX) shiftSub(u, minX - u.x);
      }
      lastRight.set(depth, Math.max(lastRight.get(depth) ?? -Infinity, u.x + unitW(u)));
      return u.x + unitW(u) / 2;
    }
    for (const r of useRoots) place(r, 0);
    return assemble([...units.values()].filter((u) => visited.has(u.id)), null);
  }

  // ---------- ANCESTORS (focus at bottom, fan up) ----------
  function layoutAncestors(focusId, adj) {
    const pos = new Map(); // id -> {x, depth}
    let cursor = 0, maxDepth = 0;
    const seen = new Set();
    function climb(id, depth) {
      if (seen.has(id)) { return pos.get(id).cx; }
      seen.add(id);
      maxDepth = Math.max(maxDepth, depth);
      const ps = adj.parents(id);
      let cx;
      if (ps.length === 0) { cx = cursor + NODE_W / 2; cursor += NODE_W + GAPX; }
      else { const cs = ps.map((p) => climb(p, depth + 1)); cx = (Math.min(...cs) + Math.max(...cs)) / 2; }
      pos.set(id, { cx, depth });
      return cx;
    }
    climb(focusId, 0);
    const nodes = [], links = [];
    let minX = Infinity, maxX = -Infinity;
    for (const [id, p] of pos) {
      const x = p.cx - NODE_W / 2, y = (maxDepth - p.depth) * GENV;
      nodes.push({ id, x, y });
      minX = Math.min(minX, x); maxX = Math.max(maxX, x + NODE_W);
    }
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    for (const [id, p] of pos) {
      const child = nodeById.get(id);
      for (const par of adj.parents(id)) {
        const pn = nodeById.get(par);
        if (pn) links.push({ d: elbow(child.x + NODE_W / 2, child.y, pn.x + NODE_W / 2, pn.y + NODE_H) });
      }
    }
    const dx = PAD - minX, dy = PAD;
    nodes.forEach((n) => { n.x += dx; n.y += dy; });
    const links2 = links.map((l) => ({ d: shiftPath(l.d, dx, dy) }));
    return { nodes, couples: [], links: links2, focusId, width: (maxX - minX) + PAD * 2, height: (maxDepth + 1) * GENV + PAD * 2 };
  }

  // ---------- HOURGLASS (ancestors up + descendants down) ----------
  function layoutHourglass(focusId, members, adj) {
    const anc = layoutAncestors(focusId, adj);
    const { unitOf } = buildUnits(members, adj);
    const desc = layoutDescendants(members, adj, [unitOf.get(focusId)]);
    // align focus
    const af = anc.nodes.find((n) => n.id === focusId);
    const df = desc.nodes.find((n) => n.id === focusId);
    if (!af || !df) return anc;
    const shiftX = af.x - df.x;
    const shiftY = af.y - df.y;
    const dnodes = desc.nodes.filter((n) => n.id !== focusId).map((n) => ({ ...n, x: n.x + shiftX, y: n.y + shiftY }));
    const dcouples = desc.couples.map((c) => ({ ...c, x: c.x + shiftX, y: c.y + shiftY }));
    const dlinks = desc.links.map((l) => ({ d: shiftPath(l.d, shiftX, shiftY) }));
    let nodes = [...anc.nodes, ...dnodes];
    let couples = [...anc.couples, ...dcouples];
    let links = [...anc.links, ...dlinks];
    // renormalize
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((n) => { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + NODE_W); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + NODE_H); });
    const dx = PAD - minX, dy = PAD - minY;
    nodes = nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
    couples = couples.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
    links = links.map((l) => ({ d: shiftPath(l.d, dx, dy) }));
    return { nodes, couples, links, focusId, width: (maxX - minX) + PAD * 2, height: (maxY - minY) + PAD * 2 };
  }

  // ---------- RADIAL ----------
  function layoutRadial(focusId, adj) {
    const RING = 150;
    const depth = new Map([[focusId, 0]]);
    const parentOf = new Map();
    const q = [focusId];
    const neigh = (id) => [...adj.parents(id), ...adj.children(id), ...adj.spouses(id)];
    while (q.length) {
      const id = q.shift();
      for (const n of neigh(id)) if (!depth.has(n)) { depth.set(n, depth.get(id) + 1); parentOf.set(n, id); q.push(n); }
    }
    const rings = new Map();
    for (const [id, d] of depth) { if (!rings.has(d)) rings.set(d, []); rings.get(d).push(id); }
    const pos = new Map();
    const cx = 0, cy = 0;
    pos.set(focusId, { x: cx, y: cy });
    for (const [d, ids] of rings) {
      if (d === 0) continue;
      const r = d * RING;
      ids.forEach((id, i) => {
        const a = (i / ids.length) * Math.PI * 2 - Math.PI / 2 + d * 0.4;
        pos.set(id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      });
    }
    const nodes = [], links = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [id, p] of pos) {
      const x = p.x - NODE_W / 2, y = p.y - NODE_H / 2;
      nodes.push({ id, x, y });
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + NODE_W); maxY = Math.max(maxY, y + NODE_H);
    }
    for (const [id, par] of parentOf) {
      const a = pos.get(id), b = pos.get(par);
      links.push({ d: `M${a.x} ${a.y} L${b.x} ${b.y}` });
    }
    const dx = PAD - minX, dy = PAD - minY;
    nodes.forEach((n) => { n.x += dx; n.y += dy; });
    const rings2 = [...rings.keys()].filter((d) => d > 0).map((d) => ({ r: d * RING, cx: cx + dx, cy: cy + dy }));
    const links2 = links.map((l) => ({ d: shiftPath2(l.d, dx, dy) }));
    return { nodes, couples: [], links: links2, rings: rings2, focusId, width: (maxX - minX) + PAD * 2, height: (maxY - minY) + PAD * 2 };
  }

  function shiftPath2(d, dx, dy) {
    return d.replace(/([ML])\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (m, cmd, a, b) => `${cmd}${(+a + dx).toFixed(1)} ${(+b + dy).toFixed(1)}`);
  }

  // ---------- TIMELINE ----------
  function layoutTimeline(members, adj) {
    const withYear = members.filter((m) => m.birthDate).map((m) => ({ id: m.id, year: +m.birthDate }));
    withYear.sort((a, b) => a.year - b.year);
    const minYear = Math.floor(withYear[0].year / 10) * 10;
    const maxYear = Math.ceil(withYear[withYear.length - 1].year / 10) * 10;
    const PXY = 12, laneH = NODE_H + 26;
    const x = (yr) => (yr - minYear) * PXY + PAD;
    const lanes = []; // last right edge per lane
    const nodes = [];
    for (const w of withYear) {
      const nx = x(w.year);
      let lane = lanes.findIndex((right) => nx - right > 24);
      if (lane === -1) { lane = lanes.length; lanes.push(0); }
      lanes[lane] = nx + NODE_W;
      nodes.push({ id: w.id, x: nx, y: PAD + 60 + lane * laneH, year: w.year });
    }
    const width = x(maxYear) + NODE_W + PAD;
    const height = PAD + 60 + lanes.length * laneH + PAD;
    const decades = [];
    for (let y = minYear; y <= maxYear; y += 10) decades.push({ x: x(y), year: y });
    return { nodes, couples: [], links: [], decades, height, width, minYear, maxYear };
  }

  function initials(name) { return name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase(); }
  function lifespan(m) { if (!m.birthDate) return '—'; return m.deathDate ? `${m.birthDate} – ${m.deathDate}` : `b. ${m.birthDate}`; }
  function yearOf(d) { return d ? parseInt(String(d).slice(0, 4), 10) : undefined; }

  // ---------- generations (bloodline depth; spouses inherit partner's gen) ----------
  function computeGenerations(members, rels) {
    const parents = new Map(), spouses = new Map();
    members.forEach((m) => { parents.set(m.id, []); spouses.set(m.id, []); });
    rels.forEach((r) => {
      if (r.type === 'parent') { if (parents.has(r.from)) parents.get(r.from).push(r.to); }
      else if (r.type === 'spouse') { if (spouses.has(r.a)) spouses.get(r.a).push(r.b); if (spouses.has(r.b)) spouses.get(r.b).push(r.a); }
    });
    const memo = new Map();
    const gen = (id) => {
      if (memo.has(id)) return memo.get(id);
      memo.set(id, 0);
      const ps = (parents.get(id) || []).filter((p) => parents.has(p));
      const g = ps.length === 0 ? null : Math.max(...ps.map((p) => gen(p) ?? 0)) + 1;
      memo.set(id, g); return g;
    };
    members.forEach((m) => gen(m.id));
    let changed = true, safety = 5;
    while (changed && safety-- > 0) {
      changed = false;
      members.forEach((m) => {
        if (memo.get(m.id) !== null) return;
        const sp = (spouses.get(m.id) || []).map((s) => memo.get(s)).filter((g) => g !== null && g !== undefined);
        if (sp.length) { memo.set(m.id, Math.max(...sp)); changed = true; }
      });
    }
    members.forEach((m) => { if (memo.get(m.id) == null) memo.set(m.id, 0); });
    const vals = [...memo.values()]; const min = Math.min(...vals);
    if (min !== 0) memo.forEach((v, k) => memo.set(k, v - min));
    return memo;
  }

  // ---------- kinship neighborhood (BFS w/ relationship labels) ----------
  function relLabel(parentLabel, edge, parentDepth) {
    if (parentDepth === 0) return edge;
    if (parentLabel === 'parent'  && edge === 'parent')  return 'grandparent';
    if (parentLabel === 'parent'  && edge === 'sibling') return 'aunt/uncle';
    if (parentLabel === 'parent'  && edge === 'partner') return 'parent';
    if (parentLabel === 'child'   && edge === 'child')   return 'grandchild';
    if (parentLabel === 'child'   && edge === 'partner') return 'in-law';
    if (parentLabel === 'sibling' && edge === 'partner') return 'in-law';
    if (parentLabel === 'sibling' && edge === 'child')   return 'niece/nephew';
    if (parentLabel === 'partner' && edge === 'parent')  return 'in-law';
    if (parentLabel === 'partner' && edge === 'sibling') return 'in-law';
    if (parentLabel === 'grandparent' && edge === 'parent') return 'great-grandparent';
    if (parentLabel === 'grandchild'  && edge === 'child')  return 'great-grandchild';
    if (parentLabel === 'aunt/uncle'  && edge === 'child')  return 'cousin';
    return 'relative';
  }
  function neighborhood(focusId, maxDepth, adj) {
    const out = new Map();
    const visited = new Set([focusId]);
    let frontier = [{ id: focusId, depth: 0, label: 'focus' }];
    while (frontier.length) {
      const next = [];
      for (const node of frontier) {
        out.set(node.id, node);
        if (node.depth >= maxDepth) continue;
        const sp = adj.spouses(node.id);
        const current = sp.filter((id) => adj.status(node.id, id) !== 'divorced');
        const ex = sp.filter((id) => adj.status(node.id, id) === 'divorced');
        const groups = [
          { ids: adj.parents(node.id), label: 'parent' },
          { ids: adj.children(node.id), label: 'child' },
          { ids: current, label: 'partner' },
          { ids: ex, label: 'ex-partner' },
          { ids: adj.siblings(node.id), label: 'sibling' },
        ];
        for (const g of groups) for (const id of g.ids) {
          if (visited.has(id)) continue;
          visited.add(id);
          next.push({ id, depth: node.depth + 1, label: relLabel(node.label, g.label, node.depth), viaId: node.id, viaRel: g.label });
        }
      }
      frontier = next;
    }
    return out;
  }

  // ---------- RADIAL v2 (sector-based, lines fan from the focus) ----------
  const SECTORS = {
    parent:  { center: -Math.PI / 2, max: Math.PI * 0.62 },
    partner: { center: 0,            max: Math.PI * 0.40 },
    child:   { center: Math.PI / 2,  max: Math.PI * 0.62 },
    sibling: { center: Math.PI,      max: Math.PI * 0.50 },
  };
  function arcAngles(center, span, count) {
    if (count <= 1) return [center];
    const step = span / (count - 1);
    return Array.from({ length: count }, (_, i) => center - span / 2 + i * step);
  }
  function relaxRing(items, minGap) {
    if (items.length < 2) return;
    const TAU = Math.PI * 2;
    items.sort((a, b) => a.angle - b.angle);
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (let i = 1; i < items.length; i++) {
        const gap = items[i].angle - items[i - 1].angle;
        if (gap < minGap) { const p = (minGap - gap) / 2; items[i - 1].angle -= p; items[i].angle += p; moved = true; }
      }
      const wrap = items[0].angle + TAU - items[items.length - 1].angle;
      if (wrap < minGap && items.length * minGap < TAU) { const p = (minGap - wrap) / 2; items[0].angle += p; items[items.length - 1].angle -= p; moved = true; }
      if (!moved) break;
      items.sort((a, b) => a.angle - b.angle);
    }
  }
  function layoutRadial2(focusId, adj, maxDepth) {
    const nodes = neighborhood(focusId, maxDepth, adj);
    const ring1 = {}; let ring1Count = 0;
    for (const [id, n] of nodes) {
      if (n.depth !== 1) continue;
      const key = n.viaRel === 'ex-partner' ? 'partner' : n.viaRel;
      (ring1[key] = ring1[key] || []).push(id); ring1Count++;
    }
    const CARD_ARC_1 = 200, CARD_ARC_N = 150;
    let ring1Radius = 250;
    for (const key in ring1) {
      const sec = SECTORS[key] || { center: Math.PI / 2, max: Math.PI / 2 };
      const need = (CARD_ARC_1 * (ring1[key].length - 1)) / Math.max(sec.max, 0.1);
      ring1Radius = Math.max(ring1Radius, Math.min(560, need));
    }
    ring1Radius += Math.max(0, ring1Count - 7) * 10;
    const STEP = 200;
    const radiusOf = (d) => (d <= 0 ? 0 : ring1Radius + (d - 1) * STEP);
    const pos = new Map();
    pos.set(focusId, { x: 0, y: 0, depth: 0, angle: 0 });
    const ring1Items = [];
    const perNode1 = CARD_ARC_1 / ring1Radius;
    for (const key in ring1) {
      const sec = SECTORS[key] || { center: Math.PI / 2, max: Math.PI / 2 };
      const ids = ring1[key];
      const span = Math.min(perNode1 * (ids.length - 1), sec.max);
      const angles = arcAngles(sec.center, span, ids.length);
      ids.forEach((id, i) => ring1Items.push({ id, angle: angles[i] }));
    }
    relaxRing(ring1Items, perNode1 * 0.9);
    ring1Items.forEach(({ id, angle }) => pos.set(id, { x: Math.cos(angle) * ring1Radius, y: Math.sin(angle) * ring1Radius, depth: 1, angle }));
    for (let d = 2; d <= maxDepth; d++) {
      const r = radiusOf(d);
      const minGap = CARD_ARC_N / r;
      const byVia = {};
      for (const [id, n] of nodes) { if (n.depth !== d || !n.viaId) continue; (byVia[n.viaId] = byVia[n.viaId] || []).push(id); }
      const items = [];
      for (const viaId in byVia) {
        const via = pos.get(viaId); if (!via) continue;
        const ids = byVia[viaId];
        const angles = arcAngles(via.angle, minGap * (ids.length - 1), ids.length);
        ids.forEach((id, i) => items.push({ id, angle: angles[i] }));
      }
      relaxRing(items, minGap);
      items.forEach(({ id, angle }) => pos.set(id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r, depth: d, angle }));
    }
    const ringRadii = Array.from({ length: maxDepth }, (_, i) => radiusOf(i + 1));
    const lines = [];
    for (const [id, n] of nodes) {
      if (n.depth === 0) continue;
      const from = n.viaId ? pos.get(n.viaId) : pos.get(focusId);
      const to = pos.get(id);
      if (!from || !to) continue;
      lines.push({ id, from, to, label: n.label, viaRel: n.viaRel });
    }
    return { positions: pos, nodes, ringRadii, lines, focusId };
  }

  window.FTCore = {
    buildAdj, layoutDescendants, layoutAncestors, layoutHourglass, layoutRadial, layoutRadial2, layoutTimeline,
    neighborhood, computeGenerations, yearOf,
    initials, lifespan, NODE_W, NODE_H, COUPLE_W, GENV,
  };
})();
