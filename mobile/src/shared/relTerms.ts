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
  'elder-brother': "your elder brother (older than you)", 'younger-brother': "your younger brother",
  'elder-sister': "your elder sister (older than you)", 'younger-sister': "your younger sister",
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
  // uncles / aunts (by side; elder/younger = vs YOUR PARENT, e.g. Tamil
  // Periyappa vs Chithappa; the -wife/-husband keys are their spouses, whose
  // word follows the blood relative: Periyappa's wife = Periyamma)
  'paternal-uncle': "father's brother", 'paternal-aunt': "father's sister",
  'maternal-uncle': "mother's brother", 'maternal-aunt': "mother's sister",
  'paternal-uncle-elder': "father's ELDER brother", 'paternal-uncle-younger': "father's YOUNGER brother",
  'paternal-uncle-elder-wife': "wife of father's elder brother", 'paternal-uncle-younger-wife': "wife of father's younger brother",
  'paternal-uncle-wife': "wife of father's brother",
  'paternal-aunt-elder': "father's ELDER sister", 'paternal-aunt-younger': "father's YOUNGER sister",
  'paternal-aunt-husband': "husband of father's sister",
  'maternal-uncle-elder': "mother's ELDER brother", 'maternal-uncle-younger': "mother's YOUNGER brother",
  'maternal-uncle-wife': "wife of mother's brother",
  'maternal-aunt-elder': "mother's ELDER sister", 'maternal-aunt-younger': "mother's YOUNGER sister",
  'maternal-aunt-elder-husband': "husband of mother's elder sister", 'maternal-aunt-younger-husband': "husband of mother's younger sister",
  'maternal-aunt-husband': "husband of mother's sister",
  // a parent's cousin (uncle/aunt-class, one generation above you)
  'paternal-cousin-uncle': "father's male cousin", 'paternal-cousin-aunt': "father's female cousin",
  'maternal-cousin-uncle': "mother's male cousin", 'maternal-cousin-aunt': "mother's female cousin",
  uncle: "uncle", aunt: "aunt", 'uncle/aunt': "uncle or aunt",
  // nephews / nieces (via brother or sister)
  'brother-son': "brother's son", 'brother-daughter': "brother's daughter",
  'sister-son': "sister's son", 'sister-daughter': "sister's daughter",
  nephew: "nephew", niece: "niece", 'niece/nephew': "niece or nephew",
  // cousins — parallel (father's brother's / mother's sister's child; sibling
  // words in many languages) vs cross (father's sister's / mother's brother's
  // child), with elder/younger vs you
  'parallel-cousin-elder-brother': "father's brother's or mother's sister's son, OLDER than you",
  'parallel-cousin-younger-brother': "father's brother's or mother's sister's son, YOUNGER than you",
  'parallel-cousin-elder-sister': "father's brother's or mother's sister's daughter, OLDER than you",
  'parallel-cousin-younger-sister': "father's brother's or mother's sister's daughter, YOUNGER than you",
  'parallel-cousin-brother': "father's brother's or mother's sister's son",
  'parallel-cousin-sister': "father's brother's or mother's sister's daughter",
  'cross-cousin-brother': "father's sister's or mother's brother's son",
  'cross-cousin-sister': "father's sister's or mother's brother's daughter",
  'cousin-brother': "male cousin", 'cousin-sister': "female cousin", cousin: "cousin",
  'cousin-son': "cousin's son", 'cousin-daughter': "cousin's daughter",
  // in-laws — split by whose sibling / which sibling's spouse
  'father-in-law': "spouse's father", 'mother-in-law': "spouse's mother",
  'brother-in-law': "spouse's brother or sister's husband",
  'sister-in-law': "spouse's sister or brother's wife",
  'wifes-brother': "wife's brother", 'wifes-sister': "wife's sister",
  'husbands-brother': "husband's brother", 'husbands-sister': "husband's sister",
  'elder-brother-wife': "elder brother's wife", 'younger-brother-wife': "younger brother's wife",
  'brother-wife': "brother's wife",
  'elder-sister-husband': "elder sister's husband", 'younger-sister-husband': "younger sister's husband",
  'sister-husband': "sister's husband",
  'son-in-law': "daughter's husband", 'daughter-in-law': "son's wife",
  'in-law': "in-law",
  // great-grandparents / -children (gendered)
  'great-grandfather': "great-grandfather", 'great-grandmother': "great-grandmother",
  'great-grandson': "great-grandson", 'great-granddaughter': "great-granddaughter",
  // great-aunts / -uncles (+ their spouses) + grand-nieces / -nephews
  'great-uncle': "grandparent's brother", 'great-aunt': "grandparent's sister",
  'great-uncle-wife': "wife of grandparent's brother", 'great-aunt-husband': "husband of grandparent's sister",
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
