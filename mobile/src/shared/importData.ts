// Import parsers (JSON / CSV / XLSX) + merge planning. Merge skips a member when
// one with the same name + birthDate already exists (req: merge, skip dupes).
import * as XLSX from 'xlsx';
import type { Member, Relationship } from './types';

export interface ParsedTree { members: Member[]; relationships: Relationship[]; }

export function parseJSON(text: string): ParsedTree {
  const data = JSON.parse(text);
  return { members: data.members ?? [], relationships: data.relationships ?? [] };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// Parse the two-section CSV produced by buildCSV / the template. Also accepts
// a plain members-only CSV (just a header row containing `name`, no section
// markers) so spreadsheets exported elsewhere import directly.
export function parseCSV(text: string): ParsedTree {
  const lines = text.split(/\r?\n/);
  const hasSections = /^#\s*MEMBERS/im.test(text);
  const members: Member[] = []; const relationships: Relationship[] = [];
  let section: 'none' | 'members' | 'rels' = hasSections ? 'none' : 'members';
  let header: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#\s*MEMBERS/i.test(line)) { section = 'members'; header = []; continue; }
    if (/^#\s*RELATIONSHIPS/i.test(line)) { section = 'rels'; header = []; continue; }
    const cells = parseCsvLine(raw);
    if (!header.length) { header = cells.map((c) => c.trim()); continue; }
    if (section === 'members') {
      const row: any = {};
      header.forEach((h, i) => { if (cells[i]) row[h] = cells[i]; });
      if (row.name) members.push(row as Member);
    } else if (section === 'rels') {
      const row: any = {};
      header.forEach((h, i) => { if (cells[i]) row[h] = cells[i]; });
      if (row.fromId && row.toId && row.type) relationships.push(row as Relationship);
    }
  }
  return { members, relationships };
}

export function parseXLSXBase64(b64: string): ParsedTree {
  const wb = XLSX.read(b64, { type: 'base64' });
  const mSheet = wb.Sheets['Members'] ?? wb.Sheets[wb.SheetNames[0]];
  const rSheet = wb.Sheets['Relationships'] ?? wb.Sheets[wb.SheetNames[1]];
  const members = (mSheet ? XLSX.utils.sheet_to_json<any>(mSheet) : []).filter((r) => r.name) as Member[];
  const relationships = (rSheet ? XLSX.utils.sheet_to_json<any>(rSheet) : []).filter((r) => r.fromId && r.toId && r.type) as Relationship[];
  return { members, relationships };
}

export interface MergePlan {
  newMembers: { importId: string; data: Omit<Member, 'id'> }[]; // to add; placeholder = `new:${importId}`
  newRelationships: { fromId: string; toId: string; type: Relationship['type']; status?: Relationship['status']; marriageDate?: string }[];
  skipped: number;                          // duplicate members skipped
  idMap: Record<string, string>;            // imported member id -> existing id or `new:<importId>`
}

// Plan a merge: dedupe members by name+birthDate against existing; keep an id map
// so imported relationships can be rewired to whatever id ends up in Firestore.
// Relationships that already exist (same resolved endpoints + type) are skipped.
export function planMerge(existing: Member[], incoming: ParsedTree, existingRels: Relationship[] = []): MergePlan {
  const keyOf = (m: { name?: string; birthDate?: string }) => `${(m.name ?? '').trim().toLowerCase()}|${m.birthDate ?? ''}`;
  const existingByKey = new Map(existing.map((m) => [keyOf(m), m.id]));

  const idMap: Record<string, string> = {};
  const newMembers: MergePlan['newMembers'] = [];
  let skipped = 0;

  incoming.members.forEach((m, i) => {
    const importId = m.id || `row${i}`; // members-only CSVs may have no id column
    const k = keyOf(m);
    const dup = existingByKey.get(k);
    if (dup) { idMap[importId] = dup; skipped++; return; }
    // Placeholder id: marks "will be created"; real id assigned at write time.
    const placeholder = `new:${importId}`;
    idMap[importId] = placeholder;
    const { id, ...rest } = m as any;
    newMembers.push({ importId, data: rest });
    existingByKey.set(k, placeholder);
  });

  // Seed the seen-set with edges that already exist so re-imports don't double them.
  const seenEdge = new Set<string>(existingRels.map((r) => `${r.fromId}|${r.toId}|${r.type}`));
  const newRelationships: MergePlan['newRelationships'] = [];
  for (const r of incoming.relationships) {
    const from = idMap[r.fromId] ?? r.fromId;
    const to = idMap[r.toId] ?? r.toId;
    const sig = `${from}|${to}|${r.type}`;
    if (seenEdge.has(sig)) continue;
    seenEdge.add(sig);
    newRelationships.push({ fromId: from, toId: to, type: r.type, status: r.status, marriageDate: r.marriageDate });
  }

  return { newMembers, newRelationships, skipped, idMap };
}
