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

// elder / younger by birth date (full ISO string compare, so month/day count).
// '' when either date is unknown — callers then use the age-neutral key.
type Age = 'elder' | 'younger' | '';
const ageVs = (adj: Adjacency, id: string, refId: string): Age => {
  const a = adj.get(id)?.birthDate, b = adj.get(refId)?.birthDate;
  if (!a || !b || a === b) return '';
  return a < b ? 'elder' : 'younger';
};

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
// Blood uncle/aunt (parent's sibling). Many languages pick the word by whether
// they're OLDER or YOUNGER than the connecting parent (Tamil Periyappa vs
// Chithappa), so the key carries that when both birth dates are known.
function uncleAunt(side: Side, m: boolean, f: boolean, age: Age = ''): Kin {
  if (side && (m || f)) return mk(`${side}-${m ? 'uncle' : 'aunt'}${age ? `-${age}` : ''}`, m ? 'Uncle' : 'Aunt');
  return mk(m ? 'uncle' : f ? 'aunt' : 'uncle/aunt', m ? 'Uncle' : f ? 'Aunt' : 'Uncle/Aunt');
}
// Uncle/aunt BY MARRIAGE (spouse of the parent's sibling). The word follows the
// BLOOD relative: father's elder brother's wife is Periyamma (not Athai), so the
// key is built from the blood sibling's side/gender/age with a spouse suffix.
function uncleAuntSpouse(side: Side, bloodMale: boolean, age: Age, targetM: boolean, targetF: boolean): Kin {
  const english = targetM ? 'Uncle' : targetF ? 'Aunt' : 'Uncle/Aunt';
  if (!side) return mk(targetM ? 'uncle' : targetF ? 'aunt' : 'uncle/aunt', english);
  const blood = `${side}-${bloodMale ? 'uncle' : 'aunt'}${age ? `-${age}` : ''}`;
  return mk(`${blood}-${bloodMale ? 'wife' : 'husband'}`, english);
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

  // direct — siblings carry elder/younger (Annan vs Thambi) when dates allow
  if (parents.includes(id)) return mk(byG('father', 'mother', 'parent'), byG('Father', 'Mother', 'Parent'));
  if (children.includes(id)) return mk(byG('son', 'daughter', 'child'), byG('Son', 'Daughter', 'Child'));
  if (sibs.includes(id)) {
    const age = ageVs(adj, id, meId);
    if (age && (m || f)) return mk(`${age}-${m ? 'brother' : 'sister'}`, `${age === 'elder' ? 'Elder' : 'Younger'} ${m ? 'brother' : 'sister'}`);
    return mk(byG('brother', 'sister', 'sibling'), byG('Brother', 'Sister', 'Sibling'));
  }
  if (spouses.includes(id)) return mk(byG('husband', 'wife', 'spouse'), byG('Husband', 'Wife', 'Spouse'));
  if (exes.includes(id)) return mk(byG('ex-husband', 'ex-wife', 'ex-partner'), byG('Ex-husband', 'Ex-wife', 'Ex-partner'));

  // grandparents (parent's parent) — side from the connecting parent's gender
  for (const p of parents) if (adj.parents(p).includes(id)) return grandparent(sideOf(genderOf(adj, p)), m, f);
  // grandchildren (child's child) — via son = paternal line, daughter = maternal
  for (const c of children) if (adj.children(c).includes(id)) return grandchild(sideOf(genderOf(adj, c)), m, f);
  // uncle/aunt (parent's sibling) — word depends on elder/younger vs MY PARENT
  // (Periyappa vs Chithappa) — + by marriage (spouse of the parent's sibling),
  // where the word follows the blood sibling (Periyappa's wife = Periyamma).
  for (const p of parents) {
    if (adj.siblings(p).includes(id)) return uncleAunt(sideOf(genderOf(adj, p)), m, f, ageVs(adj, id, p));
    for (const ps of adj.siblings(p)) {
      if (!adj.currentSpouses(ps).includes(id)) continue;
      const pg = genderOf(adj, ps);
      return uncleAuntSpouse(sideOf(genderOf(adj, p)), pg === 'male', ageVs(adj, ps, p), m, f);
    }
  }
  // nephew/niece (sibling's child) — via brother or sister
  for (const s of sibs) if (adj.children(s).includes(id)) return nephewNiece(genderOf(adj, s), m, f);
  // cousin (parent's sibling's child) — split PARALLEL (father's brother's /
  // mother's sister's child: sibling-words in Dravidian languages, by age vs me)
  // from CROSS (father's sister's / mother's brother's child: Machan/Machini).
  for (const p of parents) for (const ps of adj.siblings(p)) if (adj.children(ps).includes(id)) {
    const pg = genderOf(adj, p), psg = genderOf(adj, ps);
    if ((m || f) && pg && psg && (pg === 'male' || pg === 'female') && (psg === 'male' || psg === 'female')) {
      if (pg === psg) {
        const age = ageVs(adj, id, meId);
        return mk(`parallel-cousin-${age ? `${age}-` : ''}${m ? 'brother' : 'sister'}`, 'Cousin');
      }
      return mk(`cross-cousin-${m ? 'brother' : 'sister'}`, 'Cousin');
    }
    return mk(byG('cousin-brother', 'cousin-sister', 'cousin'), 'Cousin');
  }
  // in-laws via spouse — keyed by WHOSE sibling they are (wife's brother =
  // Machan, husband's sister = Nathanaar…), falling back to the generic key.
  for (const sp of spouses) {
    if (adj.parents(sp).includes(id)) return mk(byG('father-in-law', 'mother-in-law', 'in-law'), byG('Father-in-law', 'Mother-in-law', 'In-law'));
    if (adj.siblings(sp).includes(id)) {
      const spg = genderOf(adj, sp);
      const whose = spg === 'male' ? 'husbands' : spg === 'female' ? 'wifes' : '';
      if (whose && (m || f)) return mk(`${whose}-${m ? 'brother' : 'sister'}`, byG('Brother-in-law', 'Sister-in-law', 'In-law'));
      return mk(byG('brother-in-law', 'sister-in-law', 'in-law'), byG('Brother-in-law', 'Sister-in-law', 'In-law'));
    }
  }
  // child's spouse / sibling's spouse — a sibling's spouse follows the blood
  // sibling's age (elder brother's wife = Anni), so key off that sibling.
  for (const c of children) if (adj.currentSpouses(c).includes(id)) return mk(byG('son-in-law', 'daughter-in-law', 'in-law'), byG('Son-in-law', 'Daughter-in-law', 'In-law'));
  for (const s of sibs) if (adj.currentSpouses(s).includes(id)) {
    const sg = genderOf(adj, s);
    if (sg === 'male' || sg === 'female') {
      const age = ageVs(adj, s, meId);
      return mk(`${age ? `${age}-` : ''}${sg === 'male' ? 'brother-wife' : 'sister-husband'}`, byG('Brother-in-law', 'Sister-in-law', 'In-law'));
    }
    return mk(byG('brother-in-law', 'sister-in-law', 'in-law'), byG('Brother-in-law', 'Sister-in-law', 'In-law'));
  }
  // Every other blood relation (great^n grandparents/children, great-aunts/
  // uncles, grand-nieces/nephews, Nth cousins M-times removed) is named by the
  // general lowest-common-ancestor calculator below — so no card ever falls back
  // to a raw "parent -> parent -> child" path.
  const blood = descentKinship(adj, meId, id);
  if (blood) return blood;

  // Not blood-related, but married to someone who is (e.g. mother's cousin's
  // wife): borrow the blood relative's key with a -wife/-husband suffix so the
  // dictionary can resolve it (maternal-cousin-uncle-wife → … → Maami). Only
  // for the uncle/aunt/cousin/great tiers — closer spouses are handled above.
  if (m || f) {
    for (const sp of [...adj.currentSpouses(id)]) {
      const spKin = descentKinship(adj, meId, sp);
      if (!spKin) continue;
      if (/(uncle|aunt|cousin)/.test(spKin.key)) {
        return mk(`${spKin.key}-${m ? 'husband' : 'wife'}`, `${spKin.english}'s ${m ? 'husband' : 'wife'}`);
      }
    }
  }
  return null;
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

// The parent of `fromId` that leads toward `lca` (undefined when none does).
function parentToward(adj: Adjacency, fromId: string, lca: string): string | undefined {
  if (fromId === lca) return undefined;
  for (const p of adj.parents(fromId))
    if (p === lca || ancestorDepths(adj, p).has(lca)) return p;
  return undefined;
}

// paternal / maternal from the gender of `fromId`'s parent that reaches `lca`.
function sideToAncestor(adj: Adjacency, fromId: string, lca: string): Side {
  const p = parentToward(adj, fromId, lca);
  return p ? sideOf(genderOf(adj, p)) : '';
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
  // siblings — elder/younger when both birth dates are known
  if (a === 1 && b === 1) {
    const age = ageVs(adj, id, meId);
    if (age && (m || f)) return mk(`${age}-${m ? 'brother' : 'sister'}`, `${age === 'elder' ? 'Elder' : 'Younger'} ${m ? 'brother' : 'sister'}`);
    return mk(byG('brother', 'sister', 'sibling'), byG('Brother', 'Sister', 'Sibling'));
  }
  // id descends from my sibling → niece/nephew line
  if (a === 1 && b >= 2) {
    if (b === 2) return mk(byG('nephew', 'niece', 'niece/nephew'), byG('Nephew', 'Niece', 'Niece/Nephew'));
    const g = b - 3;
    return mk(`${greats(g)}grand-${byG('nephew', 'niece', 'niece/nephew')}`, `${titleGreats(g)}Grand-${byG('nephew', 'niece', 'niece/nephew')}`);
  }
  // id is a sibling of my ancestor → aunt/uncle line (age vs MY parent)
  if (b === 1 && a >= 2) {
    if (a === 2) {
      const myParent = parentToward(adj, meId, lca);
      return uncleAunt(sideToAncestor(adj, meId, lca), m, f, myParent ? ageVs(adj, id, myParent) : '');
    }
    const g = a - 2;
    return mk(`${greats(g)}${byG('uncle', 'aunt', 'uncle/aunt')}`, `${titleGreats(g)}${byG('Uncle', 'Aunt', 'Uncle/Aunt')}`);
  }
  // cousins: degree = min(a,b) − 1, removed = |a − b|. First cousins split
  // parallel (via same-gender parent siblings) vs cross, like kinshipOf above.
  const degree = Math.min(a, b) - 1;
  const removed = Math.abs(a - b);
  const english = `${cap(ordinal(degree))} cousin${removed ? ` ${removedLabel(removed)}` : ''}`;
  if (removed === 0 && (m || f)) {
    if (degree === 1) {
      const pg = genderOf(adj, parentToward(adj, meId, lca) ?? '');
      const qg = genderOf(adj, parentToward(adj, id, lca) ?? '');
      if ((pg === 'male' || pg === 'female') && (qg === 'male' || qg === 'female')) {
        if (pg === qg) {
          const age = ageVs(adj, id, meId);
          return mk(`parallel-cousin-${age ? `${age}-` : ''}${m ? 'brother' : 'sister'}`, english);
        }
        return mk(`cross-cousin-${m ? 'brother' : 'sister'}`, english);
      }
    } else {
      // 2nd+ cousins are still "my generation" — Dravidian languages address
      // them with sibling words by age, so carry age + gender for the dict.
      const age = ageVs(adj, id, meId);
      return mk(`parallel-cousin-${age ? `${age}-` : ''}${m ? 'brother' : 'sister'}`, english);
    }
  }
  // one generation apart: my parent's cousin is uncle/aunt-class (word by side
  // + age vs MY connecting parent: mother's elder female cousin = Periyamma),
  // and my cousin's child is nephew/niece-class (Marumagan/Marumagal). The
  // English reads "Mother's cousin" / "Cousin's son" — friendlier than the
  // genealogical "first cousin once removed".
  if (removed === 1) {
    if (b < a && (m || f)) {
      const myParent = parentToward(adj, meId, lca);
      const side = sideToAncestor(adj, meId, lca);
      const age = myParent ? ageVs(adj, id, myParent) : '';
      if (side) return mk(
        `${side}-cousin-${m ? 'uncle' : 'aunt'}${age ? `-${age}` : ''}`,
        `${side === 'maternal' ? "Mother's" : "Father's"} cousin`,
      );
    }
    if (a < b && (m || f)) return mk(`cousin-${m ? 'son' : 'daughter'}`, `Cousin's ${m ? 'son' : 'daughter'}`);
  }
  const key = degree === 1 && removed === 0 ? byG('cousin-brother', 'cousin-sister', 'cousin')
    : removed > 0 ? 'cousin-once-removed' : 'cousin';
  return mk(key, english);
}

// If a specific key isn't in the dictionary, fall back to a coarser one — one
// step at a time; termOf walks the chain (e.g. paternal-uncle-elder-wife →
// paternal-uncle-wife → paternal-uncle → uncle).
function fallbackKey(key: string): string {
  // a parent's cousin is uncle/aunt-class → drop the cousin qualifier first so
  // age + spouse suffixes survive ('maternal-cousin-aunt-elder-husband' →
  // 'maternal-aunt-elder-husband')
  if (key.includes('-cousin-uncle')) return key.replace('-cousin-uncle', '-uncle');
  if (key.includes('-cousin-aunt')) return key.replace('-cousin-aunt', '-aunt');
  // a same-generation cousin's spouse ≈ a sibling's spouse (cousin's wife = Anni)
  if (key !== 'brother-wife' && key.endsWith('brother-wife')) return 'brother-wife';
  if (key !== 'sister-husband' && key.endsWith('sister-husband')) return 'sister-husband';
  // age-qualified keys → age-neutral ('elder-brother' → 'brother',
  // 'paternal-uncle-elder' → 'paternal-uncle', 'maternal-aunt-younger-husband'
  // → 'maternal-aunt-husband')
  if (/(^|-)(elder|younger)(-|$)/.test(key))
    return key.split('-').filter((t) => t !== 'elder' && t !== 'younger').join('-');
  // sibling's spouse / spouse's sibling → generic in-law (before the generic
  // -wife/-husband strip, which would wrongly turn brother-wife into brother)
  if (key === 'brother-wife' || key === 'wifes-sister' || key === 'husbands-sister') return 'sister-in-law';
  if (key === 'sister-husband' || key === 'wifes-brother' || key === 'husbands-brother') return 'brother-in-law';
  // gendered address for a great-uncle's wife / great-aunt's husband
  if (key === 'great-uncle-wife') return 'great-aunt';
  if (key === 'great-aunt-husband') return 'great-uncle';
  // a cousin's child is nephew/niece-class
  if (key === 'cousin-son') return 'nephew';
  if (key === 'cousin-daughter') return 'niece';
  // uncle/aunt spouse → the blood uncle/aunt they're married to
  if (/-(wife|husband)$/.test(key)) return key.replace(/-(wife|husband)$/, '');
  if (key === 'parallel-cousin-brother' || key === 'cross-cousin-brother') return 'cousin-brother';
  if (key === 'parallel-cousin-sister' || key === 'cross-cousin-sister') return 'cousin-sister';
  if (key.startsWith('paternal-') || key.startsWith('maternal-')) return key.replace(/^(paternal-|maternal-)/, '');
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
  let key = kin.key;
  for (let i = 0; i < 6; i++) {
    const hit = terms[key];
    if (hit) return hit;
    const next = fallbackKey(key);
    if (next === key) break;
    key = next;
  }
  return kin.english;
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
