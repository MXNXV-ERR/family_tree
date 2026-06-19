// Regional-language relationship terms. The kinship engine emits English labels;
// a per-family / per-user dictionary maps canonical keys → transliterated words
// (English letters). localizeLabel() swaps the term in at render time, and
// everything falls back to plain English when there's no dictionary or no
// matching key. The dictionary itself is generated once via Gemini
// (shared/gemini.ts → generateRelationshipTerms) and cached on the tree / profile.
import type { FamilyTree } from './types';

export type RelTerms = Record<string, string>;

// Canonical keys the engine can produce (lowercased, normalised by relKey()).
export const RELATION_KEYS: string[] = [
  'parent', 'mother', 'father',
  'child', 'son', 'daughter',
  'partner', 'spouse', 'husband', 'wife', 'ex-partner',
  'sibling', 'brother', 'sister',
  'grandparent', 'grandfather', 'grandmother',
  'grandchild', 'grandson', 'granddaughter',
  'uncle/aunt', 'uncle', 'aunt',
  'niece/nephew', 'nephew', 'niece',
  'cousin',
  'great-grandparent', 'great-grandchild',
  'in-law',
];

const ALIASES: Record<string, string> = {
  'aunt/uncle': 'uncle/aunt',
  'nephew/niece': 'niece/nephew',
};

// Normalise an engine label ("Your grandfather", "Uncle/Aunt", "First Cousin")
// to a dictionary key.
export function relKey(label: string): string {
  let k = label.trim().toLowerCase().replace(/^your\s+/, '').replace(/^first\s+/, '');
  k = k.replace(/\s*\(in-law\)\s*$/, '').trim();
  return ALIASES[k] ?? k;
}

// Swap an English relationship label for its regional term, preserving a leading
// "Your ". Returns the original when there's no dictionary entry.
export function localizeLabel(label: string | undefined, terms?: RelTerms | null): string | undefined {
  if (!label || !terms) return label;
  const your = /^your\s+/i.test(label);
  const word = terms[relKey(label)];
  if (!word) return label;
  return your ? `Your ${word}` : word;
}

export interface RelLangConfig { lang?: string; terms?: RelTerms; }

// Per-user override wins over the family default, else plain English.
export function resolveRelTerms(
  userOverride: RelLangConfig | null | undefined,
  family: Pick<FamilyTree, 'relLang' | 'relTerms'> | null | undefined,
): { lang: string; terms?: RelTerms } {
  if (userOverride?.lang && userOverride.terms && Object.keys(userOverride.terms).length)
    return { lang: userOverride.lang, terms: userOverride.terms };
  if (family?.relLang && family?.relTerms && Object.keys(family.relTerms).length)
    return { lang: family.relLang, terms: family.relTerms };
  return { lang: 'English' };
}
