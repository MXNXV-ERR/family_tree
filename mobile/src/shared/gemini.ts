// Gemini call for the relationship chatbot. Ported from web; env var switched
// to Expo's EXPO_PUBLIC_ convention. Chatbot bug fixes (Phase 6) live here too:
// fixed the contradictory "failed properly" message.
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Member, Relationship } from './types';
import { yearOf } from './adjacency';
import { RELATION_KEYS, RELATION_HINTS, type RelTerms } from './relTerms';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
// When set, all Gemini calls go through this proxy (e.g. a Cloudflare Worker) so
// the API key lives server-side and never ships in the client bundle. See
// infra/gemini-proxy-worker.js. With a proxy configured, leave the API key UNSET.
const PROXY_URL = process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
const hasGemini = !!(API_KEY || PROXY_URL);

if (!hasGemini) {
    console.warn('No Gemini config (EXPO_PUBLIC_GEMINI_API_KEY or EXPO_PUBLIC_GEMINI_PROXY_URL). Chat features will error.');
}

const genAI = new GoogleGenerativeAI(API_KEY || '');

// One model call — via the secure proxy when configured, else the client SDK.
// `turns` is the full conversation; a single 'user' turn is a one-shot prompt.
async function runModel(model: string, systemInstruction: string, turns: ChatTurn[]): Promise<string> {
    if (PROXY_URL) {
        const res = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model, systemInstruction, history: turns }),
        });
        if (!res.ok) throw new Error(`Gemini proxy error ${res.status}`);
        const data = await res.json();
        if (typeof data?.text !== 'string') throw new Error('Gemini proxy returned no text');
        return data.text;
    }
    const m = genAI.getGenerativeModel({ model, systemInstruction });
    if (turns.length <= 1) {
        const res = await m.generateContent(turns[0]?.content ?? '');
        return res.response.text();
    }
    const chatSession = m.startChat({
        history: turns.slice(0, -1).map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
    });
    const res = await chatSession.sendMessage(turns[turns.length - 1].content);
    return res.response.text();
}

// Flash → Pro fallback wrapper.
async function withFallback(systemInstruction: string, turns: ChatTurn[]): Promise<string> {
    try { return await runModel('gemini-2.5-flash', systemInstruction, turns); }
    catch (e) {
        console.warn('Flash failed, trying Pro:', e instanceof Error ? e.message : String(e));
        return runModel('gemini-2.5-pro', systemInstruction, turns);
    }
}

export async function generateResponse(message: string, language: string = 'English') {
    if (!hasGemini) throw new Error('Missing Gemini config. Set EXPO_PUBLIC_GEMINI_API_KEY or EXPO_PUBLIC_GEMINI_PROXY_URL.');

    const systemInstruction = `You are a warm, concise family assistant.
Answer questions about family relationships clearly.
If asked to translate a relationship term, give the term in ${language} (with native script) and a one-line note.
Keep answers short and friendly.`;

    return withFallback(systemInstruction, [{ role: 'user', content: message }]);
}

// Generate a regional-language kinship dictionary once for a language: maps each
// RELATION_KEY → its everyday term transliterated in English letters. Cached on
// the family / user profile so it isn't regenerated per render. Returns {} for
// English or on parse failure (callers fall back to plain English).
export async function generateRelationshipTerms(language: string): Promise<RelTerms> {
    if (!hasGemini) throw new Error('Missing Gemini config. Set EXPO_PUBLIC_GEMINI_API_KEY or EXPO_PUBLIC_GEMINI_PROXY_URL.');
    if (!language || language.trim().toLowerCase() === 'english') return {};

    const lines = RELATION_KEYS.map((k) => `${k} = ${RELATION_HINTS[k]}`).join('; ');
    const prompt = `Language: "${language}". For each relationship below, give the everyday ${language} kinship term, transliterated in ENGLISH (Latin) LETTERS ONLY — no native script. "paternal" = father's side, "maternal" = mother's side. Return ONLY a strict JSON object mapping each key to its term (a string); no commentary, no code fences. Relationships (key = meaning): ${lines}`;
    const systemInstruction = 'You translate family/kinship terms accurately, respecting paternal vs maternal distinctions. Output strict minified JSON only; every value in English letters.';

    // Errors propagate so the caller can show "AI unavailable" rather than
    // silently saving an empty dictionary.
    const text = await withFallback(systemInstruction, [{ role: 'user', content: prompt }]);

    const jsonStr = text.replace(/```json|```/gi, '').trim();
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(jsonStr); } catch { throw new Error('AI returned an unexpected format. Please try again.'); }

    const out: RelTerms = {};
    for (const k of RELATION_KEYS) {
        const v = parsed[k];
        if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
    if (!Object.keys(out).length) throw new Error('AI returned no terms — check your Gemini API key.');
    return out;
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string; }

// Serialize the tree so Gemini can reason over real members + relationships.
export function buildTreePrompt(members: Member[], relationships: Relationship[]): string {
    const byId = new Map(members.map((m) => [m.id, m]));
    const nm = (id: string) => byId.get(id)?.name ?? 'unknown';

    const people = members.map((m) => {
        const yrs = m.birthDate ? (m.deathDate ? `${yearOf(m.birthDate)}–${yearOf(m.deathDate)}` : `b.${yearOf(m.birthDate)}`) : 'dates unknown';
        const extra = [m.gender, m.occupation, m.location].filter(Boolean).join(', ');
        return `- ${m.name} (${yrs}${extra ? '; ' + extra : ''})`;
    }).join('\n');

    const seenSpouse = new Set<string>();
    const rels: string[] = [];
    relationships.forEach((r) => {
        if (!byId.has(r.fromId) || !byId.has(r.toId)) return;
        if (r.type === 'parent') rels.push(`${nm(r.fromId)} is a child of ${nm(r.toId)}`);
        else if (r.type === 'spouse') {
            const key = [r.fromId, r.toId].sort().join('|');
            if (seenSpouse.has(key)) return;
            seenSpouse.add(key);
            rels.push(`${nm(r.fromId)} and ${nm(r.toId)} are ${r.status === 'divorced' ? 'divorced' : 'married'}`);
        }
    });

    return `FAMILY MEMBERS:\n${people}\n\nRELATIONSHIPS (parent edges = "child is a child of parent"):\n${rels.join('\n')}`;
}

// Context-aware family Q&A. Sends the serialized tree as system context plus the
// running conversation. Falls back Flash → Pro on error.
export async function chat(
    history: ChatTurn[],
    members: Member[],
    relationships: Relationship[],
    opts: { meName?: string; language?: string } = {},
): Promise<string> {
    if (!hasGemini) throw new Error('Missing Gemini config. Set EXPO_PUBLIC_GEMINI_API_KEY or EXPO_PUBLIC_GEMINI_PROXY_URL.');

    // Tell the model who "me" is so it can answer first-person questions, and
    // which regional language to transliterate relationship terms into.
    const meLine = opts.meName
        ? `\n\nThe current user ("me", "I", "my") is ${opts.meName}. Answer first-person questions ("who am I", "how is X related to me", "who are my cousins") about that person.`
        : '';
    const langLine = opts.language && opts.language.trim().toLowerCase() !== 'english'
        ? `\n\nThe family's preferred regional language is ${opts.language}. Answer in whatever language the user writes in — never refuse, restrict, or change the subject of a question because of language. You MAY additionally show the ${opts.language} kinship term in English letters (transliteration) in parentheses when you name a relationship, e.g. "uncle (Chacha)", but that is optional and must never replace a normal answer.`
        : '';

    const systemInstruction = `You are a warm, concise family-tree assistant. Use ONLY the family data below to answer questions about who's who, how people are related, dates, counts, and ancestry. If asked "how is A related to B", reason over the parent/spouse links and give the everyday term (e.g. uncle, grandmother, cousin). Refer to people by their exact names as written. If the data doesn't contain the answer, say so briefly. Keep replies short and friendly. Do not invent members or relationships.${meLine}${langLine}\n\n${buildTreePrompt(members, relationships)}`;

    // Route through runModel (proxy-aware) with a Flash→Pro fallback, so chat works
    // identically whether the app uses a direct API key or the server-side Gemini
    // proxy — the earlier direct-SDK path silently failed under a proxy setup.
    try {
        return await withFallback(systemInstruction, history);
    } catch (e) {
        console.error('Chat failed:', e instanceof Error ? e.message : String(e));
        throw new Error('AI generation failed. Please check your API key and usage.');
    }
}
