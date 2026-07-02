// GEDCOM 5.5.1 (subset) — parse + emit, pure and DOM-free. Covers what family
// apps actually exchange: INDI (NAME/SEX/BIRT/DEAT/OCCU/EMAIL/PHON + PLAC) and
// FAM (HUSB/WIFE/CHIL/MARR/DIV). Parsing returns the same ParsedTree the other
// importers produce, so planMerge/commitMerge handle dedupe + id rewiring.
import type { Member, Relationship } from './types';
import type { ParsedTree } from './importData';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// GEDCOM date ("12 MAR 1978", "MAR 1978", "1978", with optional ABT/EST/BEF/AFT
// qualifier) → the app's ISO-ish strings (YYYY-MM-DD / YYYY-MM / YYYY).
function fromGedcomDate(v: string): string | undefined {
  const t = v.trim().toUpperCase().replace(/^(ABT|EST|CAL|BEF|AFT|FROM|TO)\.?\s+/, '');
  let m = /^(\d{1,2})\s+([A-Z]{3})\s+(\d{3,4})$/.exec(t);
  if (m) {
    const mo = MONTHS.indexOf(m[2]);
    if (mo >= 0) return `${m[3].padStart(4, '0')}-${String(mo + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = /^([A-Z]{3})\s+(\d{3,4})$/.exec(t);
  if (m) {
    const mo = MONTHS.indexOf(m[1]);
    if (mo >= 0) return `${m[2].padStart(4, '0')}-${String(mo + 1).padStart(2, '0')}`;
  }
  m = /^(\d{3,4})$/.exec(t);
  if (m) return m[1].padStart(4, '0');
  return undefined;
}

// App date string → GEDCOM ("1978-03-12" → "12 MAR 1978", "1978-03" → "MAR 1978").
function toGedcomDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(iso.trim());
  if (!m) return undefined;
  const y = m[1];
  const mo = m[2] ? MONTHS[Number(m[2]) - 1] : undefined;
  const d = m[3] ? String(Number(m[3])) : undefined;
  if (mo && d) return `${d} ${mo} ${y}`;
  if (mo) return `${mo} ${y}`;
  return y;
}

interface GedLine { level: number; xref?: string; tag: string; value: string }

function parseLines(text: string): GedLine[] {
  const out: GedLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s(.*))?$/.exec(line);
    if (!m) continue;
    out.push({ level: Number(m[1]), xref: m[2]?.replace(/@/g, ''), tag: m[3].toUpperCase(), value: m[4] ?? '' });
  }
  return out;
}

export function parseGEDCOM(text: string): ParsedTree {
  const lines = parseLines(text);
  const members: Member[] = [];
  const relationships: Relationship[] = [];
  const memberById = new Map<string, Member>();

  // record boundaries: level-0 lines
  let i = 0;
  const takeRecord = (): GedLine[] => {
    const start = i;
    i++;
    while (i < lines.length && lines[i].level > 0) i++;
    return lines.slice(start, i);
  };

  const famRecords: GedLine[][] = [];
  while (i < lines.length) {
    const rec = takeRecord();
    const head = rec[0];
    if (head.tag === 'INDI' && head.xref) {
      const m: Member = { id: head.xref, name: '', gender: 'other' };
      let ctx = '';
      for (const l of rec.slice(1)) {
        if (l.level === 1) {
          ctx = l.tag;
          if (l.tag === 'NAME') m.name = l.value.replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
          else if (l.tag === 'SEX') m.gender = l.value.trim().toUpperCase().startsWith('M') ? 'male' : l.value.trim().toUpperCase().startsWith('F') ? 'female' : 'other';
          else if (l.tag === 'OCCU') m.occupation = l.value.trim();
          else if (l.tag === 'EMAIL') m.email = l.value.trim();
          else if (l.tag === 'PHON') m.phone = l.value.trim();
        } else if (l.level === 2 && l.tag === 'DATE') {
          const d = fromGedcomDate(l.value);
          if (d && ctx === 'BIRT') m.birthDate = d;
          if (d && ctx === 'DEAT') m.deathDate = d;
        } else if (l.level === 2 && l.tag === 'PLAC') {
          if (ctx === 'BIRT') m.placeOfBirth = l.value.trim();
        }
      }
      if (m.name) { members.push(m); memberById.set(m.id, m); }
    } else if (head.tag === 'FAM') {
      famRecords.push(rec);
    }
  }

  let relSeq = 0;
  const rel = (fromId: string, toId: string, type: Relationship['type'], extra?: Partial<Relationship>) => {
    relationships.push({ id: `ged${relSeq++}`, fromId, toId, type, ...extra });
  };

  for (const rec of famRecords) {
    let husb = '', wife = '', marriageDate: string | undefined, divorced = false;
    const children: string[] = [];
    let ctx = '';
    for (const l of rec.slice(1)) {
      if (l.level === 1) {
        ctx = l.tag;
        const ref = l.value.replace(/@/g, '').trim();
        if (l.tag === 'HUSB') husb = ref;
        else if (l.tag === 'WIFE') wife = ref;
        else if (l.tag === 'CHIL') children.push(ref);
        else if (l.tag === 'DIV') divorced = true;
      } else if (l.level === 2 && l.tag === 'DATE' && ctx === 'MARR') {
        marriageDate = fromGedcomDate(l.value);
      }
    }
    const has = (id: string) => memberById.has(id);
    if (husb && wife && has(husb) && has(wife)) {
      const extra: Partial<Relationship> = {};
      if (marriageDate) extra.marriageDate = marriageDate;
      if (divorced) extra.status = 'divorced';
      rel(husb, wife, 'spouse', extra);
      rel(wife, husb, 'spouse', extra);
    }
    for (const ch of children) {
      if (!has(ch)) continue;
      if (husb && has(husb)) rel(ch, husb, 'parent'); // fromId = CHILD, toId = PARENT
      if (wife && has(wife)) rel(ch, wife, 'parent');
    }
  }

  return { members, relationships };
}

// ---- emit ----

const esc = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

export function buildGEDCOM(members: Member[], relationships: Relationship[], treeName = 'Family Tree'): string {
  const idOf = new Map<string, string>();
  members.forEach((m, idx) => idOf.set(m.id, `I${idx + 1}`));

  const out: string[] = [
    '0 HEAD',
    '1 SOUR FamilyTreeApp',
    `2 NAME ${esc(treeName)}`,
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
  ];

  // family units: couple (sorted spouse pair) or single parent → children
  type Fam = { husb?: string; wife?: string; single?: string; children: Set<string>; marriageDate?: string; divorced?: boolean };
  const fams = new Map<string, Fam>();
  const byId = new Map(members.map((m) => [m.id, m]));

  const coupleKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const seenSpouse = new Set<string>();
  for (const r of relationships) {
    if (r.type !== 'spouse' || !byId.has(r.fromId) || !byId.has(r.toId)) continue;
    const key = coupleKey(r.fromId, r.toId);
    if (seenSpouse.has(key)) continue;
    seenSpouse.add(key);
    const [a, b] = key.split('|');
    const ga = byId.get(a)!.gender, gb = byId.get(b)!.gender;
    const husb = ga === 'male' ? a : gb === 'male' ? b : a;
    const wife = husb === a ? b : a;
    fams.set(key, { husb, wife, children: new Set(), marriageDate: r.marriageDate, divorced: r.status === 'divorced' });
  }

  // child → its parents (via parent edges)
  const parentsOf = new Map<string, string[]>();
  for (const r of relationships) {
    if (r.type !== 'parent' || !byId.has(r.fromId) || !byId.has(r.toId)) continue;
    const arr = parentsOf.get(r.fromId) ?? [];
    if (!arr.includes(r.toId)) arr.push(r.toId);
    parentsOf.set(r.fromId, arr);
  }
  for (const [child, ps] of parentsOf) {
    if (ps.length >= 2) {
      const key = coupleKey(ps[0], ps[1]);
      const fam = fams.get(key) ?? ((): Fam => {
        const ga = byId.get(ps[0])!.gender;
        const f: Fam = { husb: ga === 'male' ? ps[0] : ps[1], wife: ga === 'male' ? ps[1] : ps[0], children: new Set() };
        fams.set(key, f);
        return f;
      })();
      fam.children.add(child);
    } else if (ps.length === 1) {
      const key = `single|${ps[0]}`;
      const fam = fams.get(key) ?? ((): Fam => { const f: Fam = { single: ps[0], children: new Set() }; fams.set(key, f); return f; })();
      fam.children.add(child);
    }
  }

  // INDI records (with family pointers)
  const famIds = new Map<string, string>();
  let fSeq = 0;
  for (const key of fams.keys()) famIds.set(key, `F${++fSeq}`);
  const famsOfSpouse = new Map<string, string[]>();
  const famsOfChild = new Map<string, string[]>();
  for (const [key, fam] of fams) {
    const fid = famIds.get(key)!;
    for (const s of [fam.husb, fam.wife, fam.single]) {
      if (!s) continue;
      famsOfSpouse.set(s, [...(famsOfSpouse.get(s) ?? []), fid]);
    }
    for (const ch of fam.children) famsOfChild.set(ch, [...(famsOfChild.get(ch) ?? []), fid]);
  }

  for (const m of members) {
    const id = idOf.get(m.id)!;
    out.push(`0 @${id}@ INDI`);
    const parts = esc(m.name).split(/\s+/);
    const surname = parts.length > 1 ? parts[parts.length - 1] : '';
    const given = surname ? parts.slice(0, -1).join(' ') : parts.join(' ');
    out.push(`1 NAME ${given}${surname ? ` /${surname}/` : ''}`);
    out.push(`1 SEX ${m.gender === 'male' ? 'M' : m.gender === 'female' ? 'F' : 'U'}`);
    const b = toGedcomDate(m.birthDate);
    if (b || m.placeOfBirth) {
      out.push('1 BIRT');
      if (b) out.push(`2 DATE ${b}`);
      if (m.placeOfBirth) out.push(`2 PLAC ${esc(m.placeOfBirth)}`);
    }
    const d = toGedcomDate(m.deathDate);
    if (d) { out.push('1 DEAT'); out.push(`2 DATE ${d}`); }
    if (m.occupation) out.push(`1 OCCU ${esc(m.occupation)}`);
    if (m.email) out.push(`1 EMAIL ${esc(m.email)}`);
    if (m.phone) out.push(`1 PHON ${esc(m.phone)}`);
    for (const fid of famsOfSpouse.get(m.id) ?? []) out.push(`1 FAMS @${fid}@`);
    for (const fid of famsOfChild.get(m.id) ?? []) out.push(`1 FAMC @${fid}@`);
  }

  for (const [key, fam] of fams) {
    const fid = famIds.get(key)!;
    out.push(`0 @${fid}@ FAM`);
    if (fam.husb) out.push(`1 HUSB @${idOf.get(fam.husb)}@`);
    if (fam.wife) out.push(`1 WIFE @${idOf.get(fam.wife)}@`);
    if (fam.single) {
      const g = byId.get(fam.single)!.gender;
      out.push(`1 ${g === 'female' ? 'WIFE' : 'HUSB'} @${idOf.get(fam.single)}@`);
    }
    for (const ch of fam.children) out.push(`1 CHIL @${idOf.get(ch)}@`);
    const md = toGedcomDate(fam.marriageDate);
    if (md) { out.push('1 MARR'); out.push(`2 DATE ${md}`); }
    if (fam.divorced) out.push('1 DIV Y');
  }

  out.push('0 TRLR');
  return out.join('\n') + '\n';
}
