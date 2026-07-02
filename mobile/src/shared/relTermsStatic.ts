// Hand-authored regional kinship dictionaries (transliterated, English letters)
// so the common languages need NO Gemini call — they're picked from a dropdown.
// Keys match shared/relTerms.ts RELATION_KEYS; any missing key falls back to the
// English label (see kinship.ts termOf/fallbackKey). Hindi is the most complete;
// Tamil / Telugu / Kannada now cover the side/gender-specific keys too (cousins,
// nephews/nieces, in-laws). For anything else, the user picks "Other" → Gemini
// generates once → cached on the profile.
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
  'elder-brother': 'Bhaiya', 'younger-brother': 'Chhota Bhai',
  'elder-sister': 'Didi', 'younger-sister': 'Chhoti Behan',
  'paternal-uncle-elder': 'Taau', 'paternal-uncle-younger': 'Chacha',
  'paternal-uncle-elder-wife': 'Taai', 'paternal-uncle-younger-wife': 'Chachi',
  'paternal-uncle': 'Chacha', 'paternal-uncle-wife': 'Chachi',
  'paternal-aunt': 'Bua', 'paternal-aunt-husband': 'Phupha',
  'maternal-uncle': 'Mama', 'maternal-uncle-wife': 'Mami',
  'maternal-aunt': 'Mausi', 'maternal-aunt-husband': 'Mausa',
  uncle: 'Chacha', aunt: 'Mausi', 'uncle/aunt': 'Chacha/Mausi',
  'brother-son': 'Bhatija', 'brother-daughter': 'Bhatiji',
  'sister-son': 'Bhanja', 'sister-daughter': 'Bhanji',
  nephew: 'Bhatija', niece: 'Bhatiji', 'niece/nephew': 'Bhatija/Bhanja',
  'cousin-brother': 'Cousin Bhai', 'cousin-sister': 'Cousin Behan', cousin: 'Cousin',
  'father-in-law': 'Sasur', 'mother-in-law': 'Saas',
  'brother-in-law': 'Jija', 'sister-in-law': 'Bhabhi',
  'wifes-brother': 'Sala', 'wifes-sister': 'Saali', 'husbands-sister': 'Nanad',
  'brother-wife': 'Bhabhi', 'sister-husband': 'Jija',
  'son-in-law': 'Damaad', 'daughter-in-law': 'Bahu', 'in-law': 'Rishtedaar',
  'great-grandparent': 'Pardada', 'great-grandchild': 'Parpota',
  parent: 'Mata-Pita', child: 'Santaan', sibling: 'Bhai-Behan',
  spouse: 'Jeevansaathi', partner: 'Saathi', 'ex-partner': 'Purv-saathi', relative: 'Rishtedaar',
};

// Tamil — verified against real-family mappings (see .context/ tamil kinship
// audit). Age matters: Annan/Thambi + Akka/Thangai split by elder/younger vs
// YOU; Periyappa/Chithappa + Periyamma/Chithi split by elder/younger vs YOUR
// PARENT. An uncle/aunt BY MARRIAGE follows the blood relative: Periyappa's
// wife is Periyamma (never Athai), Maaman's wife is Maami. Parallel cousins
// (father's brother's / mother's sister's kids) use sibling words; cross
// cousins (father's sister's / mother's brother's kids) are Machan/Machini.
const tamil: RelTerms = {
  father: 'Appa', mother: 'Amma', son: 'Magan', daughter: 'Magal',
  brother: 'Sagodharan', sister: 'Sagodhari',
  'elder-brother': 'Annan', 'younger-brother': 'Thambi',
  'elder-sister': 'Akka', 'younger-sister': 'Thangai',
  husband: 'Kanavan', wife: 'Manaivi',
  'ex-husband': 'Mun Kanavan', 'ex-wife': 'Mun Manaivi',
  'paternal-grandfather': 'Thatha', 'paternal-grandmother': 'Paati',
  'maternal-grandfather': 'Thatha', 'maternal-grandmother': 'Paati',
  grandfather: 'Thatha', grandmother: 'Paati', grandparent: 'Thatha-Paati',
  'paternal-grandson': 'Peran', 'paternal-granddaughter': 'Pethi',
  'maternal-grandson': 'Peran', 'maternal-granddaughter': 'Pethi',
  grandson: 'Peran', granddaughter: 'Pethi', grandchild: 'Peran-Pethi',
  // father's side: elder brother Periyappa (wife Periyamma), younger brother
  // Chithappa (wife Chithi); father's sister Athai (husband Maama)
  'paternal-uncle-elder': 'Periyappa', 'paternal-uncle-younger': 'Chithappa',
  'paternal-uncle-elder-wife': 'Periyamma', 'paternal-uncle-younger-wife': 'Chithi',
  'paternal-uncle': 'Periyappa', 'paternal-uncle-wife': 'Periyamma',
  'paternal-aunt-elder': 'Athai', 'paternal-aunt-younger': 'Athai', 'paternal-aunt': 'Athai',
  'paternal-aunt-husband': 'Maama',
  // mother's side: brother Maaman any age (wife Maami); elder sister Periyamma
  // (husband Periyappa), younger sister Chithi (husband Chithappa)
  'maternal-uncle': 'Maaman', 'maternal-uncle-wife': 'Maami',
  'maternal-aunt-elder': 'Periyamma', 'maternal-aunt-younger': 'Chithi', 'maternal-aunt': 'Periyamma',
  'maternal-aunt-elder-husband': 'Periyappa', 'maternal-aunt-younger-husband': 'Chithappa',
  'maternal-aunt-husband': 'Periyappa',
  // a parent's cousins are addressed like the parent's siblings
  'maternal-cousin-uncle': 'Maaman', 'maternal-cousin-aunt': 'Periyamma',
  'paternal-cousin-uncle': 'Periyappa', 'paternal-cousin-aunt': 'Athai',
  uncle: 'Maama', aunt: 'Aunty', 'uncle/aunt': 'Maama/Aunty',
  'brother-son': 'Marumagan', 'brother-daughter': 'Marumagal',
  'sister-son': 'Marumagan', 'sister-daughter': 'Marumagal',
  nephew: 'Marumagan', niece: 'Marumagal', 'niece/nephew': 'Marumagan/Marumagal',
  // cousins: parallel = sibling words by age; cross = Machan/Machini
  'parallel-cousin-elder-brother': 'Annan', 'parallel-cousin-younger-brother': 'Thambi',
  'parallel-cousin-elder-sister': 'Akka', 'parallel-cousin-younger-sister': 'Thangai',
  'parallel-cousin-brother': 'Annan', 'parallel-cousin-sister': 'Akka',
  'cross-cousin-brother': 'Machan', 'cross-cousin-sister': 'Machini',
  'cousin-brother': 'Murai Annan', 'cousin-sister': 'Murai Akka', cousin: 'Murai Sagodharan',
  'cousin-son': 'Marumagan', 'cousin-daughter': 'Marumagal',
  'father-in-law': 'Maamanaar', 'mother-in-law': 'Maamiyaar',
  'brother-in-law': 'Machan', 'sister-in-law': 'Anni',
  'wifes-brother': 'Machan', 'wifes-sister': 'Kozhundhiyal',
  'husbands-sister': 'Nathanaar',
  'elder-brother-wife': 'Anni', 'brother-wife': 'Anni',
  'elder-sister-husband': 'Athimber', 'sister-husband': 'Machan',
  'son-in-law': 'Maappillai', 'daughter-in-law': 'Marumagal', 'in-law': 'Sammandhi',
  'great-grandfather': 'Kollu Thatha', 'great-grandmother': 'Kollu Paati',
  'great-grandson': 'Kollu Peran', 'great-granddaughter': 'Kollu Pethi',
  'great-grandparent': 'Kollu Thatha', 'great-grandchild': 'Kollu Peran',
  // grandparent's siblings + their spouses are all Thatha / Paati
  'great-uncle': 'Thatha', 'great-aunt': 'Paati',
  'great-uncle-wife': 'Paati', 'great-aunt-husband': 'Thatha',
  'grand-nephew': 'Peran', 'grand-niece': 'Pethi',
  parent: 'Petror', child: 'Kuzhandhai', sibling: 'Sagodharan',
  spouse: 'Thunaivar', partner: 'Thunai', 'ex-partner': 'Mun Thunai', relative: 'Uravinar',
};

const telugu: RelTerms = {
  father: 'Nanna', mother: 'Amma', son: 'Koduku', daughter: 'Kuthuru',
  brother: 'Anna', sister: 'Akka', husband: 'Bhartha', wife: 'Bharya',
  'ex-husband': 'Mun Bhartha', 'ex-wife': 'Mun Bharya',
  'paternal-grandfather': 'Thatha', 'paternal-grandmother': 'Nanamma',
  'maternal-grandfather': 'Thatha', 'maternal-grandmother': 'Ammamma',
  grandfather: 'Thatha', grandmother: 'Ammamma', grandparent: 'Thatha-Ammamma',
  'paternal-grandson': 'Manavadu', 'paternal-granddaughter': 'Manavaralu',
  'maternal-grandson': 'Manavadu', 'maternal-granddaughter': 'Manavaralu',
  grandson: 'Manavadu', granddaughter: 'Manavaralu', grandchild: 'Manavalu',
  'elder-brother': 'Anna', 'younger-brother': 'Thammudu',
  'elder-sister': 'Akka', 'younger-sister': 'Chelli',
  'paternal-uncle-elder': 'Peddananna', 'paternal-uncle-younger': 'Babai',
  'paternal-uncle-elder-wife': 'Peddamma', 'paternal-uncle-younger-wife': 'Pinni',
  'paternal-uncle': 'Babai', 'paternal-uncle-wife': 'Pinni',
  'paternal-aunt': 'Atha', 'paternal-aunt-husband': 'Mavayya',
  'maternal-uncle': 'Mavayya', 'maternal-uncle-wife': 'Atta',
  'maternal-aunt-elder': 'Peddamma', 'maternal-aunt-younger': 'Pinni', 'maternal-aunt': 'Pinni',
  'maternal-aunt-elder-husband': 'Peddananna', 'maternal-aunt-younger-husband': 'Babai',
  'parallel-cousin-elder-brother': 'Anna', 'parallel-cousin-younger-brother': 'Thammudu',
  'parallel-cousin-elder-sister': 'Akka', 'parallel-cousin-younger-sister': 'Chelli',
  'brother-wife': 'Vadina', 'sister-husband': 'Bava',
  uncle: 'Mavayya', aunt: 'Atha', 'uncle/aunt': 'Mavayya/Atha',
  'brother-son': 'Menalludu', 'brother-daughter': 'Mena Kuthuru',
  'sister-son': 'Menalludu', 'sister-daughter': 'Mena Kuthuru',
  nephew: 'Menalludu', niece: 'Mena Kuthuru', 'niece/nephew': 'Menalludu/Mena Kuthuru',
  'cousin-brother': 'Cousin Anna', 'cousin-sister': 'Cousin Akka', cousin: 'Cousin',
  'father-in-law': 'Mamagaru', 'mother-in-law': 'Atthagaru',
  'brother-in-law': 'Bava', 'sister-in-law': 'Vadina',
  'son-in-law': 'Alludu', 'daughter-in-law': 'Kodalu', 'in-law': 'Bandhuvu',
  'great-grandparent': 'Mutthatha', 'great-grandchild': 'Muni Manavadu',
  parent: 'Thallidandrulu', child: 'Pillalu', sibling: 'Anna-Chelli',
  spouse: 'Bhagaswami', partner: 'Thodu', 'ex-partner': 'Mun Thodu', relative: 'Bandhuvu',
};

const kannada: RelTerms = {
  father: 'Appa', mother: 'Amma', son: 'Maga', daughter: 'Magalu',
  brother: 'Anna', sister: 'Akka', husband: 'Ganda', wife: 'Hendathi',
  'ex-husband': 'Mun Ganda', 'ex-wife': 'Mun Hendathi',
  'paternal-grandfather': 'Ajja', 'paternal-grandmother': 'Ajji',
  'maternal-grandfather': 'Ajja', 'maternal-grandmother': 'Ajji',
  grandfather: 'Ajja', grandmother: 'Ajji', grandparent: 'Ajja-Ajji',
  'paternal-grandson': 'Mommaga', 'paternal-granddaughter': 'Mommagalu',
  'maternal-grandson': 'Mommaga', 'maternal-granddaughter': 'Mommagalu',
  grandson: 'Mommaga', granddaughter: 'Mommagalu', grandchild: 'Mommakkalu',
  'elder-brother': 'Anna', 'younger-brother': 'Tamma',
  'elder-sister': 'Akka', 'younger-sister': 'Tangi',
  'paternal-uncle-elder': 'Doddappa', 'paternal-uncle-younger': 'Chikkappa',
  'paternal-uncle-elder-wife': 'Doddamma', 'paternal-uncle-younger-wife': 'Chikkamma',
  'paternal-uncle': 'Chikkappa', 'paternal-uncle-wife': 'Chikkamma',
  'paternal-aunt': 'Atthe', 'paternal-aunt-husband': 'Maava',
  'maternal-uncle': 'Maava', 'maternal-uncle-wife': 'Atthe',
  'maternal-aunt-elder': 'Doddamma', 'maternal-aunt-younger': 'Chikkamma', 'maternal-aunt': 'Chikkamma',
  'maternal-aunt-elder-husband': 'Doddappa', 'maternal-aunt-younger-husband': 'Chikkappa',
  'parallel-cousin-elder-brother': 'Anna', 'parallel-cousin-younger-brother': 'Tamma',
  'parallel-cousin-elder-sister': 'Akka', 'parallel-cousin-younger-sister': 'Tangi',
  'brother-wife': 'Attige', 'sister-husband': 'Bhaava',
  uncle: 'Maava', aunt: 'Atthe', 'uncle/aunt': 'Maava/Atthe',
  'cousin-brother': 'Cousin Anna', 'cousin-sister': 'Cousin Akka', cousin: 'Cousin',
  'father-in-law': 'Maava', 'mother-in-law': 'Atthe',
  'brother-in-law': 'Bhava', 'sister-in-law': 'Atthige',
  'son-in-law': 'Aliya', 'daughter-in-law': 'Sose', 'in-law': 'Naentaru',
  'great-grandparent': 'Mutthajja', 'great-grandchild': 'Mari Mommaga',
  parent: 'Appa-Amma', child: 'Magu', sibling: 'Anna-Akka',
  spouse: 'Sangaathi', partner: 'Jodi', 'ex-partner': 'Mun Jodi', relative: 'Naentaru',
};

export const STATIC_REL_TERMS: Record<string, RelTerms> = {
  Hindi: hindi, Tamil: tamil, Telugu: telugu, Kannada: kannada,
};
