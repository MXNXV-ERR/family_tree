// Gemini call for the relationship chatbot. Ported from web; env var switched
// to Expo's EXPO_PUBLIC_ convention. Chatbot bug fixes (Phase 6) live here too:
// fixed the contradictory "failed properly" message.
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Member, Relationship } from './types';
import { yearOf } from './adjacency';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!API_KEY) {
    console.warn('EXPO_PUBLIC_GEMINI_API_KEY not set. Chat features will error.');
}

const genAI = new GoogleGenerativeAI(API_KEY || '');

export async function generateResponse(message: string, language: string = 'English') {
    if (!API_KEY) {
        throw new Error('Missing API Key. Set EXPO_PUBLIC_GEMINI_API_KEY in your env.');
    }

    const systemInstruction = `You are a warm, concise family assistant.
Answer questions about family relationships clearly.
If asked to translate a relationship term, give the term in ${language} (with native script) and a one-line note.
Keep answers short and friendly.`;

    try {
        const flash = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction });
        const result = await flash.generateContent(message);
        return result.response.text();
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn('Gemini 2.5 Flash failed, falling back to Pro:', msg);
        try {
            const pro = genAI.getGenerativeModel({ model: 'gemini-2.5-pro', systemInstruction });
            const result = await pro.generateContent(message);
            return result.response.text();
        } catch (proError: unknown) {
            const pmsg = proError instanceof Error ? proError.message : String(proError);
            console.error('Gemini 2.5 Pro also failed:', pmsg);
            throw new Error('AI generation failed. Please check your API key and usage.');
        }
    }
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
export async function chat(history: ChatTurn[], members: Member[], relationships: Relationship[]): Promise<string> {
    if (!API_KEY) throw new Error('Missing API Key. Set EXPO_PUBLIC_GEMINI_API_KEY in your env.');

    const systemInstruction = `You are a warm, concise family-tree assistant. Use ONLY the family data below to answer questions about who's who, how people are related, dates, counts, and ancestry. If asked "how is A related to B", reason over the parent/spouse links and give the everyday term (e.g. uncle, grandmother, cousin). Refer to people by their exact names as written. If the data doesn't contain the answer, say so briefly. Keep replies short and friendly. Do not invent members or relationships.\n\n${buildTreePrompt(members, relationships)}`;

    const last = history[history.length - 1];
    const priorTurns = history.slice(0, -1);

    const run = async (model: string) => {
        const m = genAI.getGenerativeModel({ model, systemInstruction });
        const chatSession = m.startChat({
            history: priorTurns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
        });
        const res = await chatSession.sendMessage(last.content);
        return res.response.text();
    };

    try {
        return await run('gemini-2.5-flash');
    } catch (e) {
        console.warn('Flash chat failed, trying Pro:', e instanceof Error ? e.message : String(e));
        try {
            return await run('gemini-2.5-pro');
        } catch (e2) {
            console.error('Pro chat failed:', e2 instanceof Error ? e2.message : String(e2));
            throw new Error('AI generation failed. Please check your API key and usage.');
        }
    }
}
