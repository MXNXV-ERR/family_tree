// Pure export builders (no platform IO). Produce strings/base64 for each format;
// the platform exporter writes + shares them. View SVGs are generated from the
// layout math (clean vectors, no foreignObject) in a light "paper" or dark
// palette, with member photos embedded when they're inline data URIs (remote
// URLs fall back to initials — external refs don't load inside svg-as-img and
// would taint the PNG canvas).
import * as XLSX from 'xlsx';
import type { Member, Relationship } from './types';
import { buildAdjacency, lifespan, initials, computeGenerations, yearOf, compareByAge } from './adjacency';
import { layoutPyramid, NODE_W, NODE_H } from './treeLayout';
import { layoutRadial } from './radialLayout';
import { layoutNetwork } from './networkLayout';
import { displayLabels } from './displayName';

export interface TreeExport {
  version: 1;
  exportedAt: string;
  members: Member[];
  relationships: Relationship[];
}

export function buildJSON(members: Member[], relationships: Relationship[]): string {
  const data: TreeExport = { version: 1, exportedAt: new Date().toISOString(), members, relationships };
  return JSON.stringify(data, null, 2);
}

const MEMBER_COLS = ['id', 'name', 'gender', 'birthDate', 'deathDate', 'phone', 'email', 'address', 'location', 'occupation', 'maidenName', 'placeOfBirth'] as const;

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// One CSV with a Members section and a Relationships section (re-import parses both).
export function buildCSV(members: Member[], relationships: Relationship[]): string {
  const memHeader = MEMBER_COLS.join(',');
  const memRows = members.map((m) => MEMBER_COLS.map((k) => csvCell((m as any)[k])).join(','));
  const relHeader = 'fromId,toId,type,status,marriageDate';
  const relRows = relationships.map((r) => [r.fromId, r.toId, r.type, r.status ?? '', r.marriageDate ?? ''].map(csvCell).join(','));
  return `# MEMBERS\n${memHeader}\n${memRows.join('\n')}\n\n# RELATIONSHIPS\n${relHeader}\n${relRows.join('\n')}\n`;
}

// xlsx workbook as base64 (Members + Relationships sheets).
export function buildXLSXBase64(members: Member[], relationships: Relationship[]): string {
  const wb = XLSX.utils.book_new();
  const mSheet = XLSX.utils.json_to_sheet(members.map((m) => {
    const row: Record<string, unknown> = {};
    MEMBER_COLS.forEach((k) => (row[k] = (m as any)[k] ?? ''));
    return row;
  }));
  const rSheet = XLSX.utils.json_to_sheet(relationships.map((r) => ({ fromId: r.fromId, toId: r.toId, type: r.type, status: r.status ?? '' })));
  XLSX.utils.book_append_sheet(wb, mSheet, 'Members');
  XLSX.utils.book_append_sheet(wb, rSheet, 'Relationships');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

// ---------------------------------------------------------------------------
// View SVGs — themed, photo-aware
// ---------------------------------------------------------------------------

export type ExportTheme = 'light' | 'dark';
export type ExportView = 'tree' | 'radial' | 'timeline' | 'network';

export interface ViewSVGOpts {
  focusId?: string;   // radial centre
  depth?: number;     // radial ring depth (1–5)
  theme?: ExportTheme;
}

interface Pal {
  bg: string; card: string; ink: string; mute: string; line: string; accent: string;
  m: string; f: string; mB: string; fB: string;          // gender fills + borders
  parent: string; partner: string; sibling: string;      // edge kinds
}

const PALS: Record<ExportTheme, Pal> = {
  dark: {
    bg: '#0d0d14', card: '#15151f', ink: '#ece6d6', mute: '#847d6c', line: '#2a2a36', accent: '#8f8bff',
    m: '#1a1f2e', f: '#28181d', mB: '#33406b', fB: '#6b3346',
    parent: '#8f8bff', partner: '#ff8caf', sibling: '#6fb1ff',
  },
  light: {
    bg: '#faf7ef', card: '#fffdf8', ink: '#2b2620', mute: '#8c8475', line: '#e3ddcf', accent: '#5a4ce0',
    m: '#eef1fa', f: '#faeef2', mB: '#b9c4e6', fB: '#e6b9c8',
    parent: '#5a4ce0', partner: '#c8456f', sibling: '#3f72c8',
  },
};

const SANS = 'system-ui,Segoe UI,Helvetica,Arial,sans-serif';
const xmlEsc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// Only inline data URIs render inside svg-as-img and rasterise without tainting
// the canvas; anything else (https, file) falls back to the initials avatar.
const embeddablePhoto = (m: Member) => (m.photoUrl && m.photoUrl.startsWith('data:') ? m.photoUrl : null);

// Circular avatar: photo (clipped) when embeddable, else initials on a gender
// tint. Appends its clipPath to `defs`; `idc` keeps ids unique per document.
function avatarSVG(m: Member, cx: number, cy: number, r: number, P: Pal, defs: string[], idc: { n: number }, ringColor?: string, ringW = 1.5): string {
  const fill = m.gender === 'female' ? P.f : m.gender === 'male' ? P.m : P.card;
  const ring = ringColor ?? (m.gender === 'female' ? P.fB : m.gender === 'male' ? P.mB : P.line);
  const photo = embeddablePhoto(m);
  let inner: string;
  if (photo) {
    const id = `av${idc.n++}`;
    defs.push(`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`);
    inner = `<image x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" href="${photo}" xlink:href="${photo}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`;
  } else {
    inner = `<text x="${cx}" y="${cy + r * 0.32}" text-anchor="middle" fill="${P.ink}" font-family="${SANS}" font-size="${Math.round(r * 0.78)}" font-weight="700">${xmlEsc(initials(m.name))}</text>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>${inner}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ring}" stroke-width="${ringW}"/>`;
}

const svgDoc = (W: number, H: number, P: Pal, defs: string[], body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
  + (defs.length ? `<defs>${defs.join('')}</defs>` : '')
  + `<rect width="${W}" height="${H}" fill="${P.bg}"/>${body}</svg>`;

const emptySVG = (P: Pal) =>
  svgDoc(420, 200, P, [], `<text x="210" y="104" text-anchor="middle" fill="${P.mute}" font-family="${SANS}" font-size="14">Nothing to export yet</text>`);

// Pyramid tree: connector lines + node cards (avatar · name · years).
export function buildTreeSVG(members: Member[], relationships: Relationship[], theme: ExportTheme = 'light'): string {
  const P = PALS[theme];
  if (!members.length) return emptySVG(P);
  const adj = buildAdjacency(members, relationships);
  const { positions, lines, width, height } = layoutPyramid(members, adj);
  const defs: string[] = [];
  const idc = { n: 0 };
  const linePaths = lines.map((l) => `<path d="${l.d}" fill="none" stroke="${P.parent}" stroke-width="1.5" opacity="0.55"/>`).join('');
  const nodes = [...positions.entries()].map(([id, p]) => {
    const m = adj.get(id); if (!m) return '';
    const border = m.gender === 'female' ? P.fB : m.gender === 'male' ? P.mB : P.line;
    const fill = m.gender === 'female' ? P.f : m.gender === 'male' ? P.m : P.card;
    return `<g transform="translate(${p.x},${p.y})">`
      + `<rect width="${NODE_W}" height="${NODE_H}" rx="12" fill="${fill}" stroke="${border}"/>`
      + avatarSVG(m, 26, NODE_H / 2, 16, P, defs, idc)
      + `<text x="48" y="${NODE_H / 2 - 3}" fill="${P.ink}" font-family="${SANS}" font-size="12.5" font-weight="700">${xmlEsc(clip(m.name, 14))}</text>`
      + `<text x="48" y="${NODE_H / 2 + 13}" fill="${P.mute}" font-family="${SANS}" font-size="10.5">${xmlEsc(lifespan(m))}</text>`
      + `</g>`;
  }).join('');
  return svgDoc(width, height, P, defs, linePaths + nodes);
}

// Radial rings around a chosen centre person, unlockable depth 1–5.
export function buildRadialSVG(members: Member[], relationships: Relationship[], focusId?: string, depth = 2, theme: ExportTheme = 'light'): string {
  const P = PALS[theme];
  const adj = buildAdjacency(members, relationships);
  const focus = focusId && adj.get(focusId) ? focusId : (members[0]?.id ?? '');
  if (!focus) return emptySVG(P);
  const { positions, ringRadii, nodes } = layoutRadial(adj, focus, Math.max(1, Math.min(5, Math.round(depth))));
  const PAD = 120;
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  positions.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
  const W = Math.round(maxX - minX + PAD * 2);
  const H = Math.round(maxY - minY + PAD * 2);
  const ox = -minX + PAD, oy = -minY + PAD;
  const defs: string[] = [];
  const idc = { n: 0 };
  const rings = ringRadii.map((r) => `<circle cx="${ox}" cy="${oy}" r="${r}" fill="none" stroke="${P.accent}" stroke-width="1.5" opacity="0.25"/>`).join('');
  const edges = [...nodes.entries()].map(([id, n]) => {
    if (n.depth === 0) return '';
    const from = (n.viaId ? positions.get(n.viaId) : positions.get(focus)) ?? positions.get(focus)!;
    const to = positions.get(id); if (!to) return '';
    return `<line x1="${(from.x + ox).toFixed(1)}" y1="${(from.y + oy).toFixed(1)}" x2="${(to.x + ox).toFixed(1)}" y2="${(to.y + oy).toFixed(1)}" stroke="${P.accent}" stroke-width="1.3" opacity="0.4"/>`;
  }).join('');
  const cards = [...positions.entries()].map(([id, p]) => {
    const m = adj.get(id); if (!m) return '';
    const isFocus = id === focus;
    const r = isFocus ? 30 : 22;
    const cx = p.x + ox, cy = p.y + oy;
    return `<g>`
      + avatarSVG(m, cx, cy, r, P, defs, idc, isFocus ? P.accent : undefined, isFocus ? 2.5 : 1.5)
      + `<text x="${cx}" y="${cy + r + 15}" text-anchor="middle" fill="${P.ink}" font-family="${SANS}" font-size="11" font-weight="600">${xmlEsc(clip(m.name, 18))}</text>`
      + `</g>`;
  }).join('');
  return svgDoc(W, H, P, defs, rings + edges + cards);
}

// Timeline: one lifespan bar per member on a shared year axis.
export function buildTimelineSVG(members: Member[], _relationships: Relationship[], theme: ExportTheme = 'light'): string {
  const P = PALS[theme];
  const rows = members
    .map((m) => ({ m, b: yearOf(m.birthDate), d: yearOf(m.deathDate) }))
    .filter((x): x is { m: Member; b: number; d: number | undefined } => !!x.b)
    .sort((a, b) => a.b - b.b);
  if (!rows.length) return emptySVG(P);
  const nowY = new Date().getFullYear();
  const minYear = Math.min(...rows.map((x) => x.b));
  const maxYear = Math.max(nowY, ...rows.map((x) => x.d ?? nowY));
  const leftPad = 190, rightPad = 40, topPad = 56, rowH = 32, axisH = 34, plotW = 760;
  const W = leftPad + plotW + rightPad;
  const H = topPad + rows.length * rowH + axisH;
  const span = Math.max(1, maxYear - minYear);
  const xFor = (y: number) => leftPad + ((y - minYear) / span) * plotW;
  const defs: string[] = [];
  const idc = { n: 0 };
  const grid: string[] = [];
  for (let y = Math.ceil(minYear / 10) * 10; y <= maxYear; y += 10) {
    const x = xFor(y).toFixed(1);
    grid.push(`<line x1="${x}" y1="${topPad - 10}" x2="${x}" y2="${H - axisH}" stroke="${P.line}" stroke-width="1" opacity="0.6"/>`);
    grid.push(`<text x="${x}" y="${H - axisH + 20}" text-anchor="middle" fill="${P.mute}" font-family="${SANS}" font-size="11">${y}</text>`);
  }
  const bars = rows.map((x, i) => {
    const y = topPad + i * rowH;
    const x1 = xFor(x.b), x2 = xFor(x.d ?? nowY);
    const fill = x.m.gender === 'female' ? P.f : x.m.gender === 'male' ? P.m : P.card;
    const stroke = x.m.gender === 'female' ? P.fB : x.m.gender === 'male' ? P.mB : P.line;
    return `<g transform="translate(0,${y})">`
      + avatarSVG(x.m, 24, 0, 11, P, defs, idc)
      + `<text x="42" y="4" fill="${P.ink}" font-family="${SANS}" font-size="12" font-weight="600">${xmlEsc(clip(x.m.name, 19))}</text>`
      + `<rect x="${x1.toFixed(1)}" y="-7" width="${Math.max(3, x2 - x1).toFixed(1)}" height="14" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`
      + `<circle cx="${x1.toFixed(1)}" cy="0" r="4" fill="${P.accent}"/>`
      + (x.d ? `<circle cx="${x2.toFixed(1)}" cy="0" r="3" fill="${P.mute}"/>` : '')
      + `</g>`;
  }).join('');
  return svgDoc(W, H, P, defs,
    `<text x="${leftPad}" y="32" fill="${P.ink}" font-family="${SANS}" font-size="15" font-weight="700">Timeline · ${minYear}–present</text>`
    + grid.join('') + bars);
}

// Network: the spring-graph layout with kin-coloured edges + legend.
export function buildNetworkSVG(members: Member[], relationships: Relationship[], theme: ExportTheme = 'light'): string {
  const P = PALS[theme];
  if (!members.length) return emptySVG(P);
  const positions = layoutNetwork(members, relationships);
  const PAD = 130;
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  positions.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
  const W = Math.round(maxX - minX + PAD * 2);
  const H = Math.round(maxY - minY + PAD * 2);
  const ox = -minX + PAD, oy = -minY + PAD;
  const defs: string[] = [];
  const idc = { n: 0 };
  const edgeColor = (t: Relationship['type']) => (t === 'parent' ? P.parent : t === 'spouse' ? P.partner : P.sibling);
  const edges = relationships
    .filter((r) => positions.has(r.fromId) && positions.has(r.toId))
    .map((r) => {
      const a = positions.get(r.fromId)!, b = positions.get(r.toId)!;
      const dash = r.type === 'spouse' && r.status === 'divorced' ? ' stroke-dasharray="5,4"' : '';
      return `<line x1="${(a.x + ox).toFixed(1)}" y1="${(a.y + oy).toFixed(1)}" x2="${(b.x + ox).toFixed(1)}" y2="${(b.y + oy).toFixed(1)}" stroke="${edgeColor(r.type)}" stroke-width="1.3" opacity="0.5"${dash}/>`;
    }).join('');
  const labels = displayLabels(members, true); // dense graph → first names (dupes keep an initial)
  const nodes = members.filter((m) => positions.has(m.id)).map((m) => {
    const p = positions.get(m.id)!;
    const cx = p.x + ox, cy = p.y + oy;
    return `<g>`
      + avatarSVG(m, cx, cy, 15, P, defs, idc)
      + `<text x="${cx + 20}" y="${cy + 4}" fill="${P.ink}" font-family="${SANS}" font-size="11" font-weight="600">${xmlEsc(clip(labels.get(m.id) ?? m.name, 14))}</text>`
      + `</g>`;
  }).join('');
  const legend = `<g transform="translate(14,14)">`
    + `<rect width="118" height="72" rx="10" fill="${P.card}" stroke="${P.line}"/>`
    + ([['Parent', P.parent], ['Partner', P.partner], ['Sibling', P.sibling]] as const).map(([lb, col], i) =>
      `<line x1="12" y1="${20 + i * 19}" x2="30" y2="${20 + i * 19}" stroke="${col}" stroke-width="2.5"/>`
      + `<text x="38" y="${24 + i * 19}" fill="${P.ink}" font-family="${SANS}" font-size="11">${lb}</text>`).join('')
    + `</g>`;
  return svgDoc(W, H, P, defs, edges + nodes + legend);
}

// Dispatch: build the standalone SVG for whichever view the user chose.
export function buildViewSVG(view: ExportView, members: Member[], relationships: Relationship[], opts: ViewSVGOpts = {}): string {
  const theme = opts.theme ?? 'light';
  if (view === 'radial') return buildRadialSVG(members, relationships, opts.focusId, opts.depth ?? 2, theme);
  if (view === 'timeline') return buildTimelineSVG(members, relationships, theme);
  if (view === 'network') return buildNetworkSVG(members, relationships, theme);
  return buildTreeSVG(members, relationships, theme);
}

// ---------------------------------------------------------------------------
// PDF booklet
// ---------------------------------------------------------------------------

const htmlEsc = xmlEsc;
// SVG pages embed as data URIs — print WebViews render them as crisp vectors,
// no rasterisation step needed on either platform.
const svgSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export interface BookletSection { label: string; desc: string; svg: string }

// Designed PDF booklet: cover with monogram + stats, one page per view
// snapshot, then a generation-by-generation directory with photos, contact,
// relationships and stories.
export function buildBookletHTML(
  members: Member[],
  relationships: Relationship[],
  treeName = 'Family Tree',
  sections: BookletSection[] = [],
): string {
  const adj = buildAdjacency(members, relationships);
  const gens = computeGenerations(members, relationships);
  const couples = Math.round(relationships.filter((r) => r.type === 'spouse').length / 2);
  const genCount = members.length ? Math.max(...[...gens.values()]) + 1 : 0;
  const years = members.flatMap((m) => [yearOf(m.birthDate), yearOf(m.deathDate)]).filter((y): y is number => !!y);
  const span = years.length ? `${Math.min(...years)} – present` : '—';
  const living = members.filter((m) => !m.deathDate).length;
  const mono = (treeName.trim()[0] ?? 'F').toUpperCase();

  const marriage = new Map<string, string>();
  relationships.forEach((r) => {
    if (r.type === 'spouse' && r.marriageDate) marriage.set(`${r.fromId}|${r.toId}`, r.marriageDate.slice(0, 4));
  });

  const byGen = new Map<number, Member[]>();
  members.forEach((m) => {
    const g = gens.get(m.id) ?? 0;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(m);
  });

  // Directory avatars are plain <img>, so any URL scheme works here.
  const avatar = (m: Member) => (m.photoUrl
    ? `<img class="pav" src="${htmlEsc(m.photoUrl)}"/>`
    : `<span class="avatar">${htmlEsc(initials(m.name))}</span>`);

  const card = (m: Member) => {
    const ps = adj.parents(m.id).map((id) => adj.get(id)?.name).filter(Boolean) as string[];
    const sp = [...adj.currentSpouses(m.id), ...adj.exSpouses(m.id)].map((id) => {
      const p = adj.get(id);
      if (!p) return null;
      const yr = marriage.get(`${m.id}|${id}`);
      const ex = adj.exSpouses(m.id).includes(id);
      return `${htmlEsc(p.name)}${yr ? ` (m. ${yr})` : ''}${ex ? ' (former)' : ''}`;
    }).filter(Boolean) as string[];
    const ch = adj.children(m.id).map((id) => adj.get(id)?.name).filter(Boolean) as string[];
    const sib = adj.siblings(m.id).map((id) => adj.get(id)?.name).filter(Boolean) as string[];
    const contact = [m.phone, m.email, m.address || m.location].filter(Boolean).map((x) => htmlEsc(String(x))).join(' · ');
    const facts = [
      m.occupation && `<span class="fact">⚒ ${htmlEsc(m.occupation)}</span>`,
      m.placeOfBirth && `<span class="fact">⌂ born in ${htmlEsc(m.placeOfBirth)}</span>`,
      m.maidenName && `<span class="fact">née ${htmlEsc(m.maidenName)}</span>`,
    ].filter(Boolean).join('');
    const rels = [
      ps.length ? `<div><b>Parents</b> ${ps.map(htmlEsc).join(', ')}</div>` : '',
      sp.length ? `<div><b>Partner</b> ${sp.join(', ')}</div>` : '',
      ch.length ? `<div><b>Children</b> ${ch.map(htmlEsc).join(', ')}</div>` : '',
      sib.length ? `<div><b>Siblings</b> ${sib.map(htmlEsc).join(', ')}</div>` : '',
    ].join('');
    return `<div class="card">
      <div class="row1">
        ${avatar(m)}
        <div>
          <div class="name">${htmlEsc(m.name)}${m.deathDate ? ' ✝' : ''}</div>
          <div class="years">${htmlEsc(lifespan(m))}${m.gender ? ` · ${m.gender}` : ''}</div>
        </div>
      </div>
      ${facts ? `<div class="facts">${facts}</div>` : ''}
      ${contact ? `<div class="contact">${contact}</div>` : ''}
      ${rels ? `<div class="rels">${rels}</div>` : ''}
      ${m.favoriteQuote ? `<div class="quote">“${htmlEsc(m.favoriteQuote)}”</div>` : ''}
      ${m.about ? `<div class="about">${htmlEsc(m.about)}</div>` : ''}
    </div>`;
  };

  const genSections = [...byGen.keys()].sort((a, b) => a - b).map((g) => {
    const list = byGen.get(g)!.slice().sort(compareByAge);
    return `<section class="gen">
      <h2><span class="genline"></span>Generation ${g + 1}<span class="genline"></span></h2>
      ${list.map(card).join('')}
    </section>`;
  }).join('');

  const viewPages = sections.map((s) => `
    <section class="vp">
      <div class="vphead">
        <h2 class="vptitle">${htmlEsc(s.label)}</h2>
        <p class="vpdesc">${htmlEsc(s.desc)}</p>
      </div>
      <img class="vpimg" src="${svgSrc(s.svg)}"/>
    </section>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 16mm 13mm; }
    body{font-family:Georgia,'Times New Roman',serif;color:#2b2620;margin:0;padding:24px;background:#fff}
    .cover{text-align:center;padding:46px 0 20px;page-break-after:always}
    .mono{width:84px;height:84px;border:1.5px solid #cfc7b4;border-radius:26px;display:inline-flex;align-items:center;justify-content:center;font-style:italic;font-size:44px;color:#5a4ce0;background:#fffdf8;margin-bottom:20px}
    .eyebrow{font:600 10px ui-monospace,monospace;letter-spacing:.26em;text-transform:uppercase;color:#8c8475}
    .cover h1{font-size:46px;font-style:italic;font-weight:600;margin:10px 0 6px;letter-spacing:-.01em}
    .cover .date{color:#8c8475;font-size:12.5px}
    .rule{width:64px;height:1px;background:#cfc7b4;margin:26px auto}
    .stats{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:8px 0 6px}
    .stat{border:1px solid #e3ddcf;border-radius:12px;padding:12px 20px;text-align:center;background:#fffdf8}
    .stat b{display:block;font-size:24px}
    .stat span{font:500 9.5px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#8c8475}
    .contents{margin-top:30px;color:#564e42;font-size:12.5px;line-height:2}
    .contents b{font:600 10px ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:#8c8475;display:block;margin-bottom:6px}
    .vp{page-break-before:always;padding-top:8px}
    .vphead{display:flex;align-items:baseline;gap:14px;border-bottom:1px solid #e3ddcf;padding-bottom:8px;margin-bottom:14px}
    .vptitle{font-style:italic;font-weight:600;font-size:24px;margin:0}
    .vpdesc{color:#8c8475;font-size:11.5px;margin:0}
    .vpimg{width:100%;border:1px solid #e3ddcf;border-radius:14px;background:#fffdf8}
    .gen{page-break-before:always;margin-top:6px}
    h2{display:flex;align-items:center;gap:12px;font-style:italic;font-weight:600;font-size:20px;color:#2b2620}
    .genline{flex:1;height:1px;background:#e3ddcf}
    .card{border:1px solid #e3ddcf;border-radius:12px;padding:12px 14px;margin-bottom:10px;page-break-inside:avoid;background:#fffdf8}
    .row1{display:flex;align-items:center;gap:11px}
    .avatar{width:40px;height:40px;border-radius:99px;background:#efeadd;border:1px solid #e3ddcf;display:inline-flex;align-items:center;justify-content:center;font:700 13px system-ui;color:#564e42;flex-shrink:0}
    .pav{width:40px;height:40px;border-radius:99px;object-fit:cover;border:1px solid #e3ddcf;flex-shrink:0}
    .name{font-weight:700;font-size:15.5px}
    .years{font:500 11px ui-monospace,monospace;color:#8c8475;margin-top:1px}
    .facts{margin-top:7px;font-size:11.5px;color:#564e42}
    .fact{margin-right:12px}
    .contact{margin-top:4px;font:500 10.5px ui-monospace,monospace;color:#8c8475}
    .rels{margin-top:7px;font-size:11.5px;color:#2b2620;line-height:1.55}
    .rels b{font-weight:700;color:#8c8475;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-right:4px}
    .quote{margin-top:7px;font-style:italic;color:#564e42;font-size:12px}
    .about{margin-top:5px;font-size:11.5px;color:#564e42;line-height:1.5}
    .foot{margin-top:26px;text-align:center;font:500 10px ui-monospace,monospace;color:#b3aa98}
  </style></head><body>
    <div class="cover">
      <div class="mono">${htmlEsc(mono)}</div>
      <div class="eyebrow">Family record</div>
      <h1>${htmlEsc(treeName)}</h1>
      <div class="date">Compiled ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      <div class="rule"></div>
      <div class="stats">
        <div class="stat"><b>${members.length}</b><span>Members</span></div>
        <div class="stat"><b>${living}</b><span>Living</span></div>
        <div class="stat"><b>${couples}</b><span>Couples</span></div>
        <div class="stat"><b>${genCount}</b><span>Generations</span></div>
        <div class="stat"><b>${htmlEsc(span)}</b><span>Span</span></div>
      </div>
      <div class="contents"><b>In this booklet</b>${sections.map((s) => htmlEsc(s.label)).join(' · ')}${sections.length ? ' · ' : ''}Family directory</div>
    </div>
    ${viewPages}
    ${genSections}
    <div class="foot">Generated by Family Tree · ${members.length} people · ${relationships.length} links</div>
  </body></html>`;
}

export const exportSummary = (members: Member[]) => `${members.length} members${members.length ? ` (e.g. ${initials(members[0].name)})` : ''}`;

// Fill-in-and-import CSV template. The id column lets relationship rows refer
// to members; any unique text works (p1, p2…). Members-only files (no
// RELATIONSHIPS section) import fine too.
export function buildCSVTemplate(): string {
  return [
    '# MEMBERS',
    'id,name,gender,birthDate,deathDate,phone,email,address,location,occupation,maidenName,placeOfBirth',
    'p1,Asha Sharma,female,1948-02-11,,, asha@example.com,,Mumbai,Teacher,Verma,Pune',
    'p2,Ravi Sharma,male,1944-07-30,2018-03-12,,,,,Engineer,,Delhi',
    'p3,Nikhil Sharma,male,1972-10-05,,+91 98765 43210,nikhil@example.com,,Bengaluru,Designer,,Mumbai',
    '',
    '# RELATIONSHIPS',
    'fromId,toId,type,status,marriageDate',
    'p3,p1,parent,,',
    'p3,p2,parent,,',
    'p1,p2,spouse,current,1970-12-02',
    'p2,p1,spouse,current,1970-12-02',
    '',
  ].join('\n');
}
