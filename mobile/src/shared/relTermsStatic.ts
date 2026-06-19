// Hand-authored regional kinship dictionaries (transliterated, English letters)
// so the common languages need NO Gemini call — they're picked from a dropdown.
// Keys match shared/relTerms.ts RELATION_KEYS; any missing key falls back to the
// English label (see kinship.ts termOf). Hindi is the most complete; Tamil /
// Telugu / Kannada cover the core terms (gaps show English). For anything else,
// the user picks "Other" → Gemini generates once → cached on their profile.
import type { RelTerms } from './relTerms';

// Languages offered as instant built-ins (besides English).
export const STATIC_LANGS = ['Hindi', 'Tamil', 'Telugu', 'Kannada'];

const hindi: RelTerms = {
  father: 'Pita', mother: 'Maa', son: 'Beta', daughter: 'Beti',
  brother: 'Bhai', sister: 'Behan', husband: 'Pati', wife: 'Patni',
  'ex-husband': 'Purv-pati', 'ex-wife': 'Purv-patni',
  'paternal-grandfather': 'Dada', 'paternal-grandmother': 'Dadi',
  'maternal-grandfather': 'Nana', 'maternal-grandmother': 'Nani',
  grandfather: 'Dada', grandmother: 'Dadi', grandparent: 'Dada-Dadi',
  'paternal-grandson': 'Pota', 'paternal-granddaughter': 'Poti',
  'maternal-grandson': 'Nati', 'maternal-granddaughter': 'Natin',
  grandson: 'Pota', granddaughter: 'Poti', grandchild: 'Pota-Poti',
  'paternal-uncle': 'Chacha', 'paternal-aunt': 'Bua',
  'maternal-uncle': 'Mama', 'maternal-aunt': 'Mausi',
  uncle: 'Chacha', aunt: 'Mausi', 'uncle/aunt': 'Chacha/Mausi',
  'brother-son': 'Bhatija', 'brother-daughter': 'Bhatiji',
  'sister-son': 'Bhanja', 'sister-daughter': 'Bhanji',
  nephew: 'Bhatija', niece: 'Bhatiji', 'niece/nephew': 'Bhatija/Bhanja',
  'cousin-brother': 'Cousin Bhai', 'cousin-sister': 'Cousin Behan', cousin: 'Cousin',
  'father-in-law': 'Sasur', 'mother-in-law': 'Saas',
  'brother-in-law': 'Jija', 'sister-in-law': 'Bhabhi',
  'son-in-law': 'Damaad', 'daughter-in-law': 'Bahu', 'in-law': 'Rishtedaar',
  'great-grandparent': 'Pardada', 'great-grandchild': 'Parpota',
  parent: 'Mata-Pita', child: 'Santaan', sibling: 'Bhai-Behan',
  spouse: 'Jeevansaathi', partner: 'Saathi', 'ex-partner': 'Purv-saathi', relative: 'Rishtedaar',
};

const tamil: RelTerms = {
  father: 'Appa', mother: 'Amma', son: 'Magan', daughter: 'Magal',
  brother: 'Annan', sister: 'Akka', husband: 'Kanavan', wife: 'Manaivi',
  'paternal-grandfather': 'Thatha', 'paternal-grandmother': 'Paati',
  'maternal-grandfather': 'Thatha', 'maternal-grandmother': 'Paati',
  grandfather: 'Thatha', grandmother: 'Paati', grandparent: 'Thatha-Paati',
  grandson: 'Peran', granddaughter: 'Pethi',
  'paternal-uncle': 'Chithappa', 'paternal-aunt': 'Athai',
  'maternal-uncle': 'Maaman', 'maternal-aunt': 'Chithi',
  uncle: 'Maaman', aunt: 'Athai', 'uncle/aunt': 'Maaman/Athai',
  nephew: 'Marumagan', niece: 'Marumagal',
  cousin: 'Cousin',
  'father-in-law': 'Maamanaar', 'mother-in-law': 'Maamiyaar',
  'son-in-law': 'Marumagan', 'daughter-in-law': 'Marumagal', 'in-law': 'Sammandhi',
  'great-grandparent': 'Kollu Thatha', parent: 'Appa-Amma', child: 'Kuzhandhai',
  sibling: 'Sahodaran', spouse: 'Thunaivar', relative: 'Uravinar',
};

const telugu: RelTerms = {
  father: 'Nanna', mother: 'Amma', son: 'Koduku', daughter: 'Kuthuru',
  brother: 'Anna', sister: 'Akka', husband: 'Bhartha', wife: 'Bharya',
  'paternal-grandfather': 'Thatha', 'paternal-grandmother': 'Nanamma',
  'maternal-grandfather': 'Thatha', 'maternal-grandmother': 'Ammamma',
  grandfather: 'Thatha', grandmother: 'Ammamma', grandparent: 'Thatha-Ammamma',
  grandson: 'Manavadu', granddaughter: 'Manavaralu',
  'paternal-uncle': 'Babai', 'paternal-aunt': 'Atha',
  'maternal-uncle': 'Mavayya', 'maternal-aunt': 'Pinni',
  uncle: 'Mavayya', aunt: 'Atha', 'uncle/aunt': 'Mavayya/Atha',
  nephew: 'Menalludu', niece: 'Mena Kuthuru',
  cousin: 'Cousin',
  'father-in-law': 'Mamagaru', 'mother-in-law': 'Atthagaru',
  'brother-in-law': 'Bava', 'sister-in-law': 'Vadina',
  'son-in-law': 'Alludu', 'daughter-in-law': 'Kodalu', 'in-law': 'Bandhuvu',
  'great-grandparent': 'Mutthatha', parent: 'Thallidandrulu', child: 'Pillalu',
  sibling: 'Anna-Chelli', spouse: 'Bhagaswami', relative: 'Bandhuvu',
};

const kannada: RelTerms = {
  father: 'Appa', mother: 'Amma', son: 'Maga', daughter: 'Magalu',
  brother: 'Anna', sister: 'Akka', husband: 'Ganda', wife: 'Hendathi',
  'paternal-grandfather': 'Ajja', 'paternal-grandmother': 'Ajji',
  'maternal-grandfather': 'Ajja', 'maternal-grandmother': 'Ajji',
  grandfather: 'Ajja', grandmother: 'Ajji', grandparent: 'Ajja-Ajji',
  grandson: 'Mommaga', granddaughter: 'Mommagalu',
  'paternal-uncle': 'Chikkappa', 'paternal-aunt': 'Atthe',
  'maternal-uncle': 'Maava', 'maternal-aunt': 'Chikkamma',
  uncle: 'Maava', aunt: 'Atthe', 'uncle/aunt': 'Maava/Atthe',
  'father-in-law': 'Maava', 'mother-in-law': 'Atthe',
  'son-in-law': 'Aliya', 'daughter-in-law': 'Sose', 'in-law': 'Naentaru',
  cousin: 'Cousin', parent: 'Appa-Amma', child: 'Magu',
  sibling: 'Anna-Akka', spouse: 'Sangaathi', relative: 'Naentaru',
};

export const STATIC_REL_TERMS: Record<string, RelTerms> = {
  Hindi: hindi, Tamil: tamil, Telugu: telugu, Kannada: kannada,
};
