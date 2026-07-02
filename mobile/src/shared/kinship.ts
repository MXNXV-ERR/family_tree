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
  // Every other blood relation (great^n grandparents/children, great-aunts/
  // uncles, grand-nieces/nephews, Nth cousins M-times removed) is named by the
  // general lowest-common-ancestor calculator below — so no card ever falls back
  // to a raw "parent -> parent -> child" path.
  return descentKinship(adj, meId, id);
}

// ---- General blood-relationship calculator (lowest common ancestor) ----
// Names every consanguine relation the hand-rolled close cases above don't, so
// the caller never has to show a raw path. Side (paternal/maternal) comes from
// which parent leads toward the shared ancestor.
const ORD = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const ordinal = (n: number) => ORD[n] ?? `${n}th`;
const removedLabel = (n: number) => (n === 1 ? 'once removed' : n === 2 ? 'twice removed' : `${n} times removed`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// "great-" repeated n times: 0 → '', 1 → 'great-', 2 → 'great-great-', …
const greats = (n: number) => (n > 0 ? 'great-'.repeat(n) : '');

// Depth of every ancestor of `id` via parent edges (id itself = 0).
function ancestorDepths(adj: Adjacency, id: string): Map<string, number> {
  const depth = new Map<string, number>([[id, 0]]);
  let frontier = [id];
  for (let d = 1; d <= 16 && frontier.length; d++) {
    const next: string[] = [];
    for (const x of frontier) for (const p of adj.parents(x))
      if (!depth.has(p)) { depth.set(p, d); next.push(p); }
    frontier = next;
  }
  return depth;
}

// paternal / maternal from the gender of `fromId`'s parent that reaches `lca`.
function sideToAncestor(adj: Adjacency, fromId: string, lca: string): Side {
  if (fromId === lca) return '';
  for (const p of adj.parents(fromId))
    if (p === lca || ancestorDepths(adj, p).has(lca)) return sideOf(genderOf(adj, p));
  return '';
}

export function descentKinship(adj: Adjacency, meId: string, id: string): Kin | null {
  if (!meId || !id || meId === id) return null;
  const A = ancestorDepths(adj, meId);
  const B = ancestorDepths(adj, id);
  // lowest common ancestor = the shared ancestor with the smallest a + b.
  let best: { lca: string; a: number; b: number } | null = null;
  for (const [anc, a] of A) {
    const b = B.get(anc);
    if (b === undefined) continue;
    if (!best || a + b < best.a + best.b || (a + b === best.a + best.b && Math.max(a, b) < Math.max(best.a, best.b)))
      best = { lca: anc, a, b };
  }
  if (!best) return null;
  const { a, b, lca } = best;
  const gid = genderOf(adj, id);
  const m = gid === 'male', f = gid === 'female';
  const byG = (male: string, female: string, neutral: string) => (m ? male : f ? female : neutral);
  const titleGreats = (g: number) => cap(greats(g));

  // id is my ancestor (lca === id, b === 0)
  if (b === 0) {
    if (a === 1) return mk(byG('father', 'mother', 'parent'), byG('Father', 'Mother', 'Parent'));
    if (a === 2) return grandparent(sideToAncestor(adj, meId, lca), m, f);
    const g = a - 2;
    return mk(`${greats(g)}grand${byG('father', 'mother', 'parent')}`, `${titleGreats(g)}grand${byG('father', 'mother', 'parent')}`);
  }
  // id is my descendant (lca === me, a === 0)
  if (a === 0) {
    if (b === 1) return mk(byG('son', 'daughter', 'child'), byG('Son', 'Daughter', 'Child'));
    if (b === 2) return grandchild(sideToAncestor(adj, id, lca), m, f);
    const g = b - 2;
    return mk(`${greats(g)}grand${byG('son', 'daughter', 'child')}`, `${titleGreats(g)}grand${byG('son', 'daughter', 'child')}`);
  }
  // siblings
  if (a === 1 && b === 1) return mk(byG('brother', 'sister', 'sibling'), byG('Brother', 'Sister', 'Sibling'));
  // id descends from my sibling → niece/nephew line
  if (a === 1 && b >= 2) {
    if (b === 2) return mk(byG('nephew', 'niece', 'niece/nephew'), byG('Nephew', 'Niece', 'Niece/Nephew'));
    const g = b - 3;
    return mk(`${greats(g)}grand-${byG('nephew', 'niece', 'niece/nephew')}`, `${titleGreats(g)}Grand-${byG('nephew', 'niece', 'niece/nephew')}`);
  }
  // id is a sibling of my ancestor → aunt/uncle line
  if (b === 1 && a >= 2) {
    if (a === 2) return uncleAunt(sideToAncestor(adj, meId, lca), m, f);
    const g = a - 2;
    return mk(`${greats(g)}${byG('uncle', 'aunt', 'uncle/aunt')}`, `${titleGreats(g)}${byG('Uncle', 'Aunt', 'Uncle/Aunt')}`);
  }
  // cousins: degree = min(a,b) − 1, removed = |a − b|.
  const degree = Math.min(a, b) - 1;
  const removed = Math.abs(a - b);
  const english = `${cap(ordinal(degree))} cousin${removed ? ` ${removedLabel(removed)}` : ''}`;
  const key = degree === 1 && removed === 0 ? byG('cousin-brother', 'cousin-sister', 'cousin')
    : removed > 0 ? 'cousin-once-removed' : 'cousin';
  return mk(key, english);
}

// If a specific key isn't in the dictionary, fall back to a coarser one.
function fallbackKey(key: string): string {
  if (key.startsWith('paternal-') || key.startsWith('maternal-')) return key.replace(/^(paternal|maternal)-/, '');
  if (key === 'brother-son' || key === 'sister-son') return 'nephew';
  if (key === 'brother-daughter' || key === 'sister-daughter') return 'niece';
  if (key === 'cousin-brother' || key === 'cousin-sister') return 'cousin';
  if (key === 'great-uncle') return 'uncle';
  if (key === 'great-aunt') return 'aunt';
  if (key === 'grand-nephew') return 'nephew';
  if (key === 'grand-niece') return 'niece';
  if (key === 'cousin-once-removed') return 'cousin';
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
