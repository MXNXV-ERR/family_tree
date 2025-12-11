import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { message, language = "Gujarati" } = await req.json();
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not defined in environment variables" },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const systemInstruction = `You are a concise translator for family relationship terms. 
                Goal: Translate the requested relationship into ${language}.
                Rules:
                1. Give ONLY the relationship term in ${language} (and its native script).
                2. Do not provide deep explanations or cultural context unless it's a direct differentiator (like older/younger).
                3. Format your response exactly like this: "**Term** (Native Script) - Short context if needed".
                4. Keep the entire response to ONE line if possible, or very short bullet points.`;

        async function generateWithFallback() {
            try {
                // Try Flash first
                const modelFlash = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
                const result = await modelFlash.generateContent(message);
                return await result.response;
            } catch (error: any) {
                console.warn("Gemini 2.5 Flash failed (Status " + (error.status || 'unknown') + "), switching to Pro. Error:", error.message);

                try {
                    // Fallback to Pro
                    const modelPro = genAI.getGenerativeModel({ model: "gemini-2.5-pro", systemInstruction });
                    const result = await modelPro.generateContent(message);
                    return await result.response;
                } catch (proError: any) {
                    console.error("Gemini 2.5 Pro ALSO failed:", proError.message);
                    throw new Error(`Flash failed (${error.message}). Pro failed (${proError.message})`);
                }
            }
        }

        const response = await generateWithFallback();
        const text = response.text();

        return NextResponse.json({ response: text });
    } catch (error: any) {
        console.error("Error generating content:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate response", details: error.toString() },
            { status: 500 }
        );
    }
}
