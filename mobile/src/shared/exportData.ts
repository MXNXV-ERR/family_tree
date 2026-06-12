// Pure export builders (no platform IO). Produce strings/base64 for each format;
// the platform exporter writes + shares them. Tree SVG is generated from the
// layout math (clean vector, no foreignObject).
import * as XLSX from 'xlsx';
import type { Member, Relationship } from './types';
import { buildAdjacency, lifespan, initials } from './adjacency';
import { layoutPyramid, NODE_W, NODE_H } from './treeLayout';

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
  const relHeader = 'fromId,toId,type,status';
  const relRows = relationships.map((r) => [r.fromId, r.toId, r.type, r.status ?? ''].map(csvCell).join(','));
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

// HTML roster + embedded tree image (data URI) for the PDF.
export function buildDirectoryHTML(members: Member[], relationships: Relationship[], treeImgDataUri?: string): string {
  const adj = buildAdjacency(members, relationships);
  const rows = members.slice().sort((a, b) => a.name.localeCompare(b.name)).map((m) => {
    const rel: string[] = [];
    const ps = adj.parents(m.id).map((id) => adj.get(id)?.name).filter(Boolean);
    const sp = [...adj.currentSpouses(m.id), ...adj.exSpouses(m.id)].map((id) => adj.get(id)?.name).filter(Boolean);
    const ch = adj.children(m.id).map((id) => adj.get(id)?.name).filter(Boolean);
    if (ps.length) rel.push(`Parents: ${ps.join(', ')}`);
    if (sp.length) rel.push(`Partner: ${sp.join(', ')}`);
    if (ch.length) rel.push(`Children: ${ch.join(', ')}`);
    return `<tr><td><b>${xmlEsc(m.name)}</b></td><td>${xmlEsc(lifespan(m))}</td><td>${xmlEsc(m.occupation ?? '')}</td><td>${xmlEsc(rel.join(' · '))}</td></tr>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,system-ui,sans-serif;color:#1a1a1a;padding:24px}
    h1{margin:0 0 4px} .sub{color:#666;margin-bottom:18px}
    table{width:100%;border-collapse:collapse;font-size:12px} td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}
    img{max-width:100%;border:1px solid #ddd;border-radius:8px;margin-bottom:20px}
  </style></head><body>
    <h1>Family Tree</h1>
    <div class="sub">${members.length} members · ${relationships.length} links · ${new Date().toLocaleDateString()}</div>
    ${treeImgDataUri ? `<img src="${treeImgDataUri}"/>` : ''}
    <table><thead><tr><th>Name</th><th>Years</th><th>Occupation</th><th>Relationships</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
}

export const exportSummary = (members: Member[]) => `${members.length} members${members.length ? ` (e.g. ${initials(members[0].name)})` : ''}`;
