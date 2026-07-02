// Regional-language relationship terms. The kinship engine (shared/kinship.ts)
// classifies a relationship into a canonical KEY that distinguishes paternal vs
// maternal side and gender (e.g. 'maternal-grandfather' = Nana, 'paternal-uncle'
// = Chacha). A per-user dictionary maps those keys → a transliterated word
// (English letters), generated once via Gemini (generateRelationshipTerms) and
// cached on the user's profile. Everything falls back to plain English.
import type { FamilyTree } from './types';

export type RelTerms = Record<string, string>;

// Canonical key → plain-English gloss. The gloss is fed to Gemini so it returns
// the correct side/gender-specific word, and is the English fallback label.
export const RELATION_HINTS: Record<string, string> = {
  // direct
  father: "your father", mother: "your mother",
  son: "your son", daughter: "your daughter",
  brother: "your brother", sister: "your sister",
  husband: "your husband", wife: "your wife",
  'ex-husband': "your ex-husband", 'ex-wife': "your ex-wife",
  // grandparents (by side)
  'paternal-grandfather': "father's father", 'paternal-grandmother': "father's mother",
  'maternal-grandfather': "mother's father", 'maternal-grandmother': "mother's mother",
  grandfather: "grandfather", grandmother: "grandmother", grandparent: "grandparent",
  // grandchildren (by side: via son = paternal, via daughter = maternal)
  'paternal-grandson': "son's son", 'paternal-granddaughter': "son's daughter",
  'maternal-grandson': "daughter's son", 'maternal-granddaughter': "daughter's daughter",
  grandson: "grandson", granddaughter: "granddaughter", grandchild: "grandchild",
  // uncles / aunts (by side)
  'paternal-uncle': "father's brother", 'paternal-aunt': "father's sister",
  'maternal-uncle': "mother's brother", 'maternal-aunt': "mother's sister",
  uncle: "uncle", aunt: "aunt", 'uncle/aunt': "uncle or aunt",
  // nephews / nieces (via brother or sister)
  'brother-son': "brother's son", 'brother-daughter': "brother's daughter",
  'sister-son': "sister's son", 'sister-daughter': "sister's daughter",
  nephew: "nephew", niece: "niece", 'niece/nephew': "niece or nephew",
  // cousins
  'cousin-brother': "male cousin", 'cousin-sister': "female cousin", cousin: "cousin",
  // in-laws
  'father-in-law': "spouse's father", 'mother-in-law': "spouse's mother",
  'brother-in-law': "spouse's brother or sister's husband",
  'sister-in-law': "spouse's sister or brother's wife",
  'son-in-law': "daughter's husband", 'daughter-in-law': "son's wife",
  'in-law': "in-law",
  // great-grandparents / -children (gendered)
  'great-grandfather': "great-grandfather", 'great-grandmother': "great-grandmother",
  'great-grandson': "great-grandson", 'great-granddaughter': "great-granddaughter",
  // great-aunts / -uncles + grand-nieces / -nephews
  'great-uncle': "grandparent's brother", 'great-aunt': "grandparent's sister",
  'grand-nephew': "nephew's son / grand-nephew", 'grand-niece': "niece's daughter / grand-niece",
  // removed cousins
  'cousin-once-removed': "cousin once removed (parent's cousin or cousin's child)",
  // distant + generic fallbacks
  'great-grandparent': "great-grandparent", 'great-grandchild': "great-grandchild",
  parent: "parent", child: "child", sibling: "sibling",
  spouse: "spouse", partner: "partner", 'ex-partner': "ex-partner", relative: "relative",
};

export const RELATION_KEYS: string[] = Object.keys(RELATION_HINTS);

const ALIASES: Record<string, string> = {
  'aunt/uncle': 'uncle/aunt',
  'nephew/niece': 'niece/nephew',
};

// Normalise a coarse engine label ("Your grandfather", "Uncle/Aunt", "First
// Cousin") to a dictionary key — used only for the path-based fallback path.
export function relKey(label: string): string {
  let k = label.trim().toLowerCase().replace(/^your\s+/, '').replace(/^first\s+/, '');
  k = k.replace(/\s*\(in-law\)\s*$/, '').trim();
  return ALIASES[k] ?? k;
}

// Swap a coarse English label for its regional term (fallback path). Preserves a
// leading "Your ". Returns the original when there's no dictionary entry.
export function localizeLabel(label: string | undefined, terms?: RelTerms | null): string | undefined {
  if (!label || !terms) return label;
  const your = /^your\s+/i.test(label);
  const word = terms[relKey(label)];
  if (!word) return label;
  return your ? `Your ${word}` : word;
}

export interface RelLangConfig { lang?: string; terms?: RelTerms; }

// Per-user override, else family default, else plain English.
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
