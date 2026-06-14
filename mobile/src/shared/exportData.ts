// Pure export builders (no platform IO). Produce strings/base64 for each format;
// the platform exporter writes + shares them. Tree SVG is generated from the
// layout math (clean vector, no foreignObject).
import * as XLSX from 'xlsx';
import type { Member, Relationship } from './types';
import { buildAdjacency, lifespan, initials, computeGenerations, yearOf } from './adjacency';
import { layoutPyramid, NODE_W, NODE_H } from './treeLayout';
import { layoutRadial } from './radialLayout';

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

const DARK = { bg: '#0d0d14', paper: '#15151f', ink: '#ece6d6', mute: '#847d6c', line: '#2a2a36', accent: '#8b8bff', m: '#1a1f2e', f: '#28181d' };
const xmlEsc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));

// Standalone SVG of the pyramid tree.
export function buildTreeSVG(members: Member[], relationships: Relationship[]): string {
  const adj = buildAdjacency(members, relationships);
  const { positions, lines, width, height } = layoutPyramid(members, adj);
  const linePaths = lines.map((l) => `<path d="${l.d}" fill="none" stroke="${DARK.accent}" stroke-width="1.5" opacity="0.5"/>`).join('');
  const nodes = [...positions.entries()].map(([id, p]) => {
    const m = adj.get(id); if (!m) return '';
    const fill = m.gender === 'female' ? DARK.f : DARK.m;
    return `<g transform="translate(${p.x},${p.y})">`
      + `<rect width="${NODE_W}" height="${NODE_H}" rx="12" fill="${fill}" stroke="${DARK.line}"/>`
      + `<text x="10" y="30" fill="${DARK.ink}" font-family="sans-serif" font-size="13" font-weight="700">${xmlEsc(m.name.slice(0, 16))}</text>`
      + `<text x="10" y="50" fill="${DARK.mute}" font-family="sans-serif" font-size="11">${xmlEsc(lifespan(m))}</text>`
      + `</g>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<rect width="${width}" height="${height}" fill="${DARK.bg}"/>${linePaths}${nodes}</svg>`;
}

const emptySVG = () =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="420" height="200" viewBox="0 0 420 200">`
  + `<rect width="420" height="200" fill="${DARK.bg}"/><text x="210" y="104" text-anchor="middle" fill="${DARK.mute}" font-family="sans-serif" font-size="14">Nothing to export yet</text></svg>`;

// Standalone SVG of the radial view (focus person centred, relatives on rings).
export function buildRadialSVG(members: Member[], relationships: Relationship[], focusId?: string, depth = 1): string {
  const adj = buildAdjacency(members, relationships);
  const focus = focusId && adj.get(focusId) ? focusId : (members[0]?.id ?? '');
  if (!focus) return emptySVG();
  const { positions, ringRadii, nodes } = layoutRadial(adj, focus, Math.max(1, Math.min(3, Math.round(depth))));
  const PAD = 110;
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  positions.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
  const W = Math.round(maxX - minX + PAD * 2);
  const H = Math.round(maxY - minY + PAD * 2);
  const ox = -minX + PAD, oy = -minY + PAD;
  const rings = ringRadii.map((r) => `<circle cx="${ox}" cy="${oy}" r="${r}" fill="none" stroke="${DARK.accent}" stroke-width="1.5" opacity="0.28"/>`).join('');
  const edges = [...nodes.entries()].map(([id, n]) => {
    if (n.depth === 0) return '';
    const from = (n.viaId ? positions.get(n.viaId) : positions.get(focus)) ?? positions.get(focus)!;
    const to = positions.get(id); if (!to) return '';
    return `<line x1="${(from.x + ox).toFixed(1)}" y1="${(from.y + oy).toFixed(1)}" x2="${(to.x + ox).toFixed(1)}" y2="${(to.y + oy).toFixed(1)}" stroke="${DARK.accent}" stroke-width="1.4" opacity="0.4"/>`;
  }).join('');
  const cards = [...positions.entries()].map(([id, p]) => {
    const m = adj.get(id); if (!m) return '';
    const isFocus = id === focus;
    const r = isFocus ? 30 : 22;
    const fill = m.gender === 'female' ? DARK.f : m.gender === 'male' ? DARK.m : DARK.paper;
    return `<g transform="translate(${(p.x + ox).toFixed(1)},${(p.y + oy).toFixed(1)})">`
      + `<circle r="${r}" fill="${fill}" stroke="${isFocus ? DARK.accent : DARK.line}" stroke-width="${isFocus ? 2.5 : 1.5}"/>`
      + `<text y="4" text-anchor="middle" fill="${DARK.ink}" font-family="sans-serif" font-size="${isFocus ? 13 : 11}" font-weight="700">${xmlEsc(initials(m.name))}</text>`
      + `<text y="${r + 16}" text-anchor="middle" fill="${DARK.ink}" font-family="sans-serif" font-size="11" font-weight="600">${xmlEsc(m.name.slice(0, 18))}</text>`
      + `</g>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="${DARK.bg}"/>${rings}${edges}${cards}</svg>`;
}

// Standalone SVG of the timeline view (one lifespan bar per member, year axis).
export function buildTimelineSVG(members: Member[], _relationships: Relationship[]): string {
  const rows = members
    .map((m) => ({ m, b: yearOf(m.birthDate), d: yearOf(m.deathDate) }))
    .filter((x): x is { m: Member; b: number; d: number | undefined } => !!x.b)
    .sort((a, b) => a.b - b.b);
  if (!rows.length) return emptySVG();
  const nowY = new Date().getFullYear();
  const minYear = Math.min(...rows.map((x) => x.b));
  const maxYear = Math.max(nowY, ...rows.map((x) => x.d ?? nowY));
  const leftPad = 175, rightPad = 40, topPad = 56, rowH = 30, axisH = 34, plotW = 760;
  const W = leftPad + plotW + rightPad;
  const H = topPad + rows.length * rowH + axisH;
  const span = Math.max(1, maxYear - minYear);
  const xFor = (y: number) => leftPad + ((y - minYear) / span) * plotW;
  const grid: string[] = [];
  for (let y = Math.ceil(minYear / 10) * 10; y <= maxYear; y += 10) {
    const x = xFor(y).toFixed(1);
    grid.push(`<line x1="${x}" y1="${topPad - 10}" x2="${x}" y2="${H - axisH}" stroke="${DARK.line}" stroke-width="1" opacity="0.5"/>`);
    grid.push(`<text x="${x}" y="${H - axisH + 20}" text-anchor="middle" fill="${DARK.mute}" font-family="sans-serif" font-size="11">${y}</text>`);
  }
  const bars = rows.map((x, i) => {
    const y = topPad + i * rowH;
    const x1 = xFor(x.b), x2 = xFor(x.d ?? nowY);
    const fill = x.m.gender === 'female' ? DARK.f : x.m.gender === 'male' ? DARK.m : DARK.paper;
    return `<g transform="translate(0,${y})">`
      + `<text x="${leftPad - 12}" y="4" text-anchor="end" fill="${DARK.ink}" font-family="sans-serif" font-size="12" font-weight="600">${xmlEsc(x.m.name.slice(0, 24))}</text>`
      + `<rect x="${x1.toFixed(1)}" y="-7" width="${Math.max(3, x2 - x1).toFixed(1)}" height="14" rx="7" fill="${fill}" stroke="${DARK.accent}" stroke-width="1.2"/>`
      + `<circle cx="${x1.toFixed(1)}" cy="0" r="4" fill="${DARK.accent}"/>`
      + (x.d ? `<circle cx="${x2.toFixed(1)}" cy="0" r="3" fill="${DARK.mute}"/>` : '')
      + `</g>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="${DARK.bg}"/>`
    + `<text x="${leftPad}" y="32" fill="${DARK.ink}" font-family="sans-serif" font-size="15" font-weight="700">Timeline · ${minYear}–present</text>`
    + `${grid.join('')}${bars}</svg>`;
}

export type ExportView = 'tree' | 'radial' | 'timeline';

// Dispatch: build the standalone SVG for whichever view the user chose.
export function buildViewSVG(view: ExportView, members: Member[], relationships: Relationship[], focusId?: string, depth = 1): string {
  if (view === 'radial') return buildRadialSVG(members, relationships, focusId, depth);
  if (view === 'timeline') return buildTimelineSVG(members, relationships);
  return buildTreeSVG(members, relationships);
}

// Full PDF summary document: cover with stats, tree snapshot, then a
// generation-by-generation directory with contact, story and relationships.
export function buildDirectoryHTML(
  members: Member[],
  relationships: Relationship[],
  treeImgDataUri?: string,
  treeName = 'Family Tree',
): string {
  const adj = buildAdjacency(members, relationships);
  const gens = computeGenerations(members, relationships);
  const couples = Math.round(relationships.filter((r) => r.type === 'spouse').length / 2);
  const genCount = members.length ? Math.max(...[...gens.values()]) + 1 : 0;
  const years = members.flatMap((m) => [yearOf(m.birthDate), yearOf(m.deathDate)]).filter((y): y is number => !!y);
  const span = years.length ? `${Math.min(...years)} – present` : '—';
  const living = members.filter((m) => !m.deathDate).length;

  // marriage year lookup for "Partner (m. 1994)"
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

  const card = (m: Member) => {
    const ps = adj.parents(m.id).map((id) => adj.get(id)?.name).filter(Boolean);
    const sp = [...adj.currentSpouses(m.id), ...adj.exSpouses(m.id)].map((id) => {
      const p = adj.get(id);
      if (!p) return null;
      const yr = marriage.get(`${m.id}|${id}`);
      const ex = adj.exSpouses(m.id).includes(id);
      return `${p.name}${yr ? ` (m. ${yr})` : ''}${ex ? ' (former)' : ''}`;
    }).filter(Boolean);
    const ch = adj.children(m.id).map((id) => adj.get(id)?.name).filter(Boolean);
    const sib = adj.siblings(m.id).map((id) => adj.get(id)?.name).filter(Boolean);
    const contact = [m.phone, m.email, m.address || m.location].filter(Boolean).map((x) => xmlEsc(String(x))).join(' · ');
    const facts = [
      m.occupation && `<span class="fact">💼 ${xmlEsc(m.occupation)}</span>`,
      m.placeOfBirth && `<span class="fact">⌂ born in ${xmlEsc(m.placeOfBirth)}</span>`,
      m.maidenName && `<span class="fact">née ${xmlEsc(m.maidenName)}</span>`,
    ].filter(Boolean).join('');
    const rels = [
      ps.length ? `<div><b>Parents</b> ${ps.map(xmlEsc as any).join(', ')}</div>` : '',
      sp.length ? `<div><b>Partner</b> ${sp.join(', ')}</div>` : '',
      ch.length ? `<div><b>Children</b> ${ch.map(xmlEsc as any).join(', ')}</div>` : '',
      sib.length ? `<div><b>Siblings</b> ${sib.map(xmlEsc as any).join(', ')}</div>` : '',
    ].join('');
    return `<div class="card">
      <div class="row1">
        <span class="avatar">${xmlEsc(initials(m.name))}</span>
        <div>
          <div class="name">${xmlEsc(m.name)}${m.deathDate ? ' ✝' : ''}</div>
          <div class="years">${xmlEsc(lifespan(m))}${m.gender ? ` · ${m.gender}` : ''}</div>
        </div>
      </div>
      ${facts ? `<div class="facts">${facts}</div>` : ''}
      ${contact ? `<div class="contact">${contact}</div>` : ''}
      ${rels ? `<div class="rels">${rels}</div>` : ''}
      ${m.favoriteQuote ? `<div class="quote">“${xmlEsc(m.favoriteQuote)}”</div>` : ''}
      ${m.about ? `<div class="about">${xmlEsc(m.about)}</div>` : ''}
    </div>`;
  };

  const sections = [...byGen.keys()].sort((a, b) => a - b).map((g) => {
    const list = byGen.get(g)!.slice().sort((a, b) => (yearOf(a.birthDate) ?? 9999) - (yearOf(b.birthDate) ?? 9999));
    return `<section class="gen">
      <h2><span class="genline"></span>Generation ${g + 1}<span class="genline"></span></h2>
      <div class="cards">${list.map(card).join('')}</div>
    </section>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 18mm 14mm; }
    body{font-family:Georgia,'Times New Roman',serif;color:#2b2620;margin:0;padding:28px}
    .cover{text-align:center;padding:22px 0 8px}
    .cover .eyebrow{font:600 10px/-1 ui-monospace,monospace;letter-spacing:.22em;text-transform:uppercase;color:#8c8475}
    .cover h1{font-size:40px;font-style:italic;font-weight:600;margin:8px 0 4px;letter-spacing:-.01em}
    .cover .date{color:#8c8475;font-size:12px}
    .stats{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:18px 0 6px}
    .stat{border:1px solid #e3ddcf;border-radius:12px;padding:10px 18px;text-align:center;background:#fffdf8}
    .stat b{display:block;font-size:22px}
    .stat span{font:500 9.5px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#8c8475}
    .treewrap{margin:18px 0 6px;text-align:center}
    .treewrap img{max-width:100%;border:1px solid #e3ddcf;border-radius:12px}
    .gen{page-break-before:auto;margin-top:22px}
    h2{display:flex;align-items:center;gap:12px;font-style:italic;font-weight:600;font-size:19px;color:#2b2620}
    .genline{flex:1;height:1px;background:#e3ddcf}
    .cards{display:block}
    .card{border:1px solid #e3ddcf;border-radius:12px;padding:12px 14px;margin-bottom:10px;page-break-inside:avoid;background:#fffdf8}
    .row1{display:flex;align-items:center;gap:10px}
    .avatar{width:34px;height:34px;border-radius:99px;background:#efeadd;border:1px solid #e3ddcf;display:inline-flex;align-items:center;justify-content:center;font:700 12px system-ui;color:#564e42;flex-shrink:0}
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
      <div class="eyebrow">Family record</div>
      <h1>${xmlEsc(treeName)}</h1>
      <div class="date">Exported ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      <div class="stats">
        <div class="stat"><b>${members.length}</b><span>Members</span></div>
        <div class="stat"><b>${living}</b><span>Living</span></div>
        <div class="stat"><b>${couples}</b><span>Couples</span></div>
        <div class="stat"><b>${genCount}</b><span>Generations</span></div>
        <div class="stat"><b>${xmlEsc(span)}</b><span>Span</span></div>
      </div>
    </div>
    ${treeImgDataUri ? `<div class="treewrap"><img src="${treeImgDataUri}"/></div>` : ''}
    ${sections}
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
