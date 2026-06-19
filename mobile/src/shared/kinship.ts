// Side- + gender-aware kinship resolution. Classifies the relationship of `id`
// to `fromId` into a canonical key that distinguishes paternal/maternal side and
// gender (e.g. 'maternal-grandfather', 'paternal-uncle', 'brother-son') so a
// regional dictionary can show the right word (Nana vs Dada, Mama vs Chacha).
// Side is derived from the connecting parent's gender; gender from the target.
// Falls back to coarser keys when side/gender is unknown. Only covers the common
// (≤ 2-3 hop) relations people have words for; anything else returns null and the
// caller uses the path-based label.
import { buildAdjacency, type Adjacency } from './adjacency';
import type { Member, Relationship } from './types';
import type { RelTerms } from './relTerms';

export interface Kin { key: string; english: string }

const genderOf = (adj: Adjacency, id: string) => adj.get(id)?.gender;
type Side = 'paternal' | 'maternal' | '';
const sideOf = (parentGender?: string): Side =>
  parentGender === 'male' ? 'paternal' : parentGender === 'female' ? 'maternal' : '';
const mk = (key: string, english: string): Kin => ({ key, english });

// Memoised adjacency (same approach as relationTo.ts).
let cacheKey = '';
let cached: Adjacency | null = null;
function adjFor(members: Member[], relationships: Relationship[]): Adjacency {
  const key = `${members.length}|${relationships.length}|${relationships[0]?.id ?? ''}`;
  if (cached && cacheKey === key) return cached;
  cached = buildAdjacency(members, relationships);
  cacheKey = key;
  return cached;
}

function grandparent(side: Side, m: boolean, f: boolean): Kin {
  if (side && (m || f)) return mk(`${side}-${m ? 'grandfather' : 'grandmother'}`, m ? 'Grandfather' : 'Grandmother');
  return mk(m ? 'grandfather' : f ? 'grandmother' : 'grandparent', m ? 'Grandfather' : f ? 'Grandmother' : 'Grandparent');
}
function grandchild(side: Side, m: boolean, f: boolean): Kin {
  if (side && (m || f)) return mk(`${side}-${m ? 'grandson' : 'granddaughter'}`, m ? 'Grandson' : 'Granddaughter');
  return mk(m ? 'grandson' : f ? 'granddaughter' : 'grandchild', m ? 'Grandson' : f ? 'Granddaughter' : 'Grandchild');
}
function uncleAunt(side: Side, m: boolean, f: boolean): Kin {
  if (side && (m || f)) return mk(`${side}-${m ? 'uncle' : 'aunt'}`, m ? 'Uncle' : 'Aunt');
  return mk(m ? 'uncle' : f ? 'aunt' : 'uncle/aunt', m ? 'Uncle' : f ? 'Aunt' : 'Uncle/Aunt');
}
function nephewNiece(viaSibGender: string | undefined, m: boolean, f: boolean): Kin {
  const via = viaSibGender === 'male' ? 'brother' : viaSibGender === 'female' ? 'sister' : '';
  if (via && (m || f)) return mk(`${via}-${m ? 'son' : 'daughter'}`, m ? 'Nephew' : 'Niece');
  return mk(m ? 'nephew' : f ? 'niece' : 'niece/nephew', m ? 'Nephew' : f ? 'Niece' : 'Niece/Nephew');
}

export function kinshipOf(adj: Adjacency, meId: string, id: string): Kin | null {
  if (!meId || !id || meId === id) return null;
  const gid = genderOf(adj, id);
  const m = gid === 'male', f = gid === 'female';
  const byG = (male: string, female: string, neutral: string) => (m ? male : f ? female : neutral);

  const parents = adj.parents(meId);
  const children = adj.children(meId);
  const sibs = adj.siblings(meId);
  const spouses = adj.currentSpouses(meId);
  const exes = adj.exSpouses(meId);

  // direct
  if (parents.includes(id)) return mk(byG('father', 'mother', 'parent'), byG('Father', 'Mother', 'Parent'));
  if (children.includes(id)) return mk(byG('son', 'daughter', 'child'), byG('Son', 'Daughter', 'Child'));
  if (sibs.includes(id)) return mk(byG('brother', 'sister', 'sibling'), byG('Brother', 'Sister', 'Sibling'));
  if (spouses.includes(id)) return mk(byG('husband', 'wife', 'spouse'), byG('Husband', 'Wife', 'Spouse'));
  if (exes.includes(id)) return mk(byG('ex-husband', 'ex-wife', 'ex-partner'), byG('Ex-husband', 'Ex-wife', 'Ex-partner'));

  // grandparents (parent's parent) — side from the connecting parent's gender
  for (const p of parents) if (adj.parents(p).includes(id)) return grandparent(sideOf(genderOf(adj, p)), m, f);
  // grandchildren (child's child) — via son = paternal line, daughter = maternal
  for (const c of children) if (adj.children(c).includes(id)) return grandchild(sideOf(genderOf(adj, c)), m, f);
  // uncle/aunt (parent's sibling) + by marriage (spouse of parent's sibling)
  for (const p of parents) {
    if (adj.siblings(p).includes(id)) return uncleAunt(sideOf(genderOf(adj, p)), m, f);
    for (const ps of adj.siblings(p)) if (adj.currentSpouses(ps).includes(id)) return uncleAunt(sideOf(genderOf(adj, p)), m, f);
  }
  // nephew/niece (sibling's child) — via brother or sister
  for (const s of sibs) if (adj.children(s).includes(id)) return nephewNiece(genderOf(adj, s), m, f);
  // cousin (parent's sibling's child)
  for (const p of parents) for (const ps of adj.siblings(p)) if (adj.children(ps).includes(id)) return mk(byG('cousin-brother', 'cousin-sister', 'cousin'), 'Cousin');
  // in-laws via spouse
  for (const sp of spouses) {
    if (adj.parents(sp).includes(id)) return mk(byG('father-in-law', 'mother-in-law', 'in-law'), byG('Father-in-law', 'Mother-in-law', 'In-law'));
    if (adj.siblings(sp).includes(id)) return mk(byG('brother-in-law', 'sister-in-law', 'in-law'), byG('Brother-in-law', 'Sister-in-law', 'In-law'));
  }
  // child's spouse / sibling's spouse
  for (const c of children) if (adj.currentSpouses(c).includes(id)) return mk(byG('son-in-law', 'daughter-in-law', 'in-law'), byG('Son-in-law', 'Daughter-in-law', 'In-law'));
  for (const s of sibs) if (adj.currentSpouses(s).includes(id)) return mk(byG('brother-in-law', 'sister-in-law', 'in-law'), byG('Brother-in-law', 'Sister-in-law', 'In-law'));
  // great-grandparent / great-grandchild
  for (const p of parents) for (const gp of adj.parents(p)) if (adj.parents(gp).includes(id)) return mk('great-grandparent', 'Great-grandparent');
  for (const c of children) for (const gc of adj.children(c)) if (adj.children(gc).includes(id)) return mk('great-grandchild', 'Great-grandchild');

  return null;
}

// If a specific key isn't in the dictionary, fall back to a coarser one.
function fallbackKey(key: string): string {
  if (key.startsWith('paternal-') || key.startsWith('maternal-')) return key.replace(/^(paternal|maternal)-/, '');
  if (key === 'brother-son' || key === 'sister-son') return 'nephew';
  if (key === 'brother-daughter' || key === 'sister-daughter') return 'niece';
  if (key === 'cousin-brother' || key === 'cousin-sister') return 'cousin';
  return key;
}

export function termOf(kin: Kin, terms?: RelTerms | null): string {
  if (!terms) return kin.english;
  return terms[kin.key] ?? terms[fallbackKey(kin.key)] ?? kin.english;
}

// Localised label for `id` relative to `fromId`: regional term if available,
// else coarse English. Returns undefined when the relation isn't covered here.
export function kinshipLabel(
  members: Member[], relationships: Relationship[],
  fromId: string, id: string, terms?: RelTerms | null,
): string | undefined {
  const kin = kinshipOf(adjFor(members, relationships), fromId, id);
  return kin ? termOf(kin, terms) : undefined;
}
