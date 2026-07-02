# Tamil kinship audit — Seetharam Mudaliyar family (2026-07-02)

Perspective: **Jatin** (member `pXEWday4PsJQOOLf9jCe`, tree `Nstzbvwy5YyINlIsbOFX`, 70 members).
Engine: `mobile/src/shared/kinship.ts` (age-aware rewrite) + `relTermsStatic.ts` Tamil dictionary.
Every person classified — no NULL/path fallbacks. Verified one-by-one by Claude.

## Corrections vs the Gemini chat the user pasted

| Gemini said | Correct (now in app) | Why |
|---|---|---|
| Mother's cousin's wife = **Athai** | **Maami** | Athai = father's sister. Wife of a Maaman-class man is Maami (Gemini itself called Keethana "Mami" — it was inconsistent). |
| Mother's female cousin = **Athai** (if older) | **Periyamma** (elder) / **Chithi** (younger) | Mother's parallel female cousin is mother's sister-class, never Athai. |
| Mother's cousin younger than Amma = **Annan/Thambi** | still **Maaman / Periyamma / Chithi** | They are one generation above Jatin regardless of age vs Amma. Annan/Thambi would demote them to Jatin's generation. |
| Great-grandfather = "Muthu Thatha" | **Kollu Thatha** | Standard Tamil for great-grandfather (Kollu Paati f.). |
| Mama's children = "கசின் சகோதரன்/சகோதரி" | **Machan / Machini** (cross-cousins) | Mother's brother's kids are cross-cousins; Tamil has real words. |

Also: the tree data says **Kalavathi, Shanti, Vasugi, Lalitha are wives of Chittibabu's brothers** (→ Paati, as great-uncle-wife), and **Narayan is Geetha's husband** (→ Thatha, as great-aunt-husband) — Gemini listed some of them as blood siblings. Same address either way (Thatha/Paati).

## The verified mapping (Jatin → everyone)

| People | Key | Tamil |
|---|---|---|
| Bhaskar | father | **Appa** |
| Aruna | mother | **Amma** |
| Chittibabu / Kanchana | maternal-grandfather/-mother | **Thatha / Paati** |
| Seetharam Mudaliyar / Rajeshwari | great-grandfather/-mother | **Kollu Thatha / Kollu Paati** |
| Vijaykumar, Ashok, Mohan, Dayal | great-uncle | **Thatha** |
| Kalavathi, Shanti, Vasugi, Lalitha | great-uncle-wife | **Paati** |
| Geetha | great-aunt | **Paati** |
| Narayan | great-aunt-husband | **Thatha** |
| Arvind (Amma's brother) | maternal-uncle | **Maaman** |
| Keethana | maternal-uncle-wife | **Maami** |
| Pranavi (Arvind's daughter) | cross-cousin-sister | **Machini** |
| Madan, Gopi, Rajesh, Rakesh, Srinath, Srikanth, Prasanth, Karthik, Pradeep, Mahesh (s/o Vijaykumar) | maternal-cousin-uncle | **Maaman** |
| Priya, Yamini, Meenakshi, Sandya, Champa, Divya, Sudha, Ashwini | maternal-cousin-uncle-wife | **Maami** |
| Manju, Anitha, Bomi, Praveena, Babli | maternal-cousin-aunt | **Periyamma** (Chithi once birth dates say younger than Amma) |
| Padmanabhan, Aravind, Karthik Bhaskar, Mahesh (h/o Praveena), Rajan | maternal-cousin-aunt-husband | **Periyappa** (Chithappa when younger) |
| Advaith, Atul, Avyu, Chaarit, Hygreev, Michilash, Prajeen, Pritham, Sai Shareesh, Sanjeet, Senvesh, Seyon, Shylesh, Thanuj, Tharak, Vihaan | parallel-cousin-brother (2nd cousin) | **Annan** (Thambi when younger — needs dates) |
| Adya, Aradya, Janvi, Parathana, Sanvika, Vismaya | parallel-cousin-sister | **Akka** (Thangai when younger) |

## Data gaps (user action)

- **Birth dates missing for ~all 70 members** — elder/younger terms (Annan vs Thambi, Periyappa vs Chithappa, Periyamma vs Chithi) activate automatically once dates exist.
- Placeholder junk dates: Vijaykumar `2000-01-01`, Chittibabu `2001-01-01` (grandfather born 2001) — should be fixed or cleared.
- The "You" (`associatedUserId`) node in this tree is **Seetharam Mudaliyar**, not Jatin — so in-app "relation to you" runs from the great-grandfather. Reassign to the Jatin member for first-person terms.

## How it works (for future sessions)

- Keys now carry age + marriage: `elder-brother`, `paternal-uncle-elder(-wife)`, `maternal-aunt-younger(-husband)`, `maternal-cousin-uncle(-wife)`, `parallel-cousin-elder-sister`, `cross-cousin-brother`, `great-uncle-wife`, `wifes-brother`, `elder-brother-wife`, `cousin-son`…
- `fallbackKey()` walks chains (`maternal-cousin-aunt-elder-husband` → `maternal-aunt-elder-husband` → … → `uncle`), so old/partial dictionaries still resolve.
- Spouses of blood relatives borrow the blood key + `-wife/-husband` (that's what fixes Maami).
- Hindi/Telugu/Kannada static dicts got the confident age-aware entries; Gemini generation prompt picks up all new keys automatically.
