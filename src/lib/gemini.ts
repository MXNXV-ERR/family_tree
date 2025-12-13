import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("NEXT_PUBLIC_GEMINI_API_KEY is not defined. Chat features will error.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");

export async function generateResponse(message: string, language: string = "Gujarati") {
    if (!API_KEY) {
        throw new Error("Missing API Key. Please set NEXT_PUBLIC_GEMINI_API_KEY in .env.local");
    }

    const systemInstruction = `You are a concise translator for family relationship terms. 
            Goal: Translate the requested relationship into ${language}.
            Rules:
            1. Give ONLY the relationship term in ${language} (and its native script).
            2. Do not provide deep explanations or cultural context unless it's a direct differentiator (like older/younger).
            3. Format your response exactly like this: "**Term** (Native Script) - Short context if needed".
            4. Keep the entire response to ONE line if possible, or very short bullet points.`;

    try {
        // Try Flash first
        const modelFlash = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
        const result = await modelFlash.generateContent(message);
        return result.response.text();
    } catch (error: any) {
        console.warn("Gemini 2.5 Flash failed, switching to Pro. Error:", error.message);

        try {
            // Fallback to Pro
            const modelPro = genAI.getGenerativeModel({ model: "gemini-2.5-pro", systemInstruction });
            const result = await modelPro.generateContent(message);
            return result.response.text();
        } catch (proError: any) {
            console.error("Gemini 2.5 Pro ALSO failed:", proError.message);
            throw new Error(`AI Generation failed properly. Please check your API usage.`);
        }
    }
}
