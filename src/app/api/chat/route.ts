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
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction:
                `You are a concise translator for family relationship terms. 
                Goal: Translate the requested relationship into ${language}.
                Rules:
                1. Give ONLY the relationship term in ${language} (and its native script).
                2. Do not provide deep explanations or cultural context unless it's a direct differentiator (like older/younger).
                3. Format your response exactly like this: "**Term** (Native Script) - Short context if needed".
                4. Keep the entire response to ONE line if possible, or very short bullet points.`,
        });

        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ response: text });
    } catch (error) {
        console.error("Error generating content:", error);
        // @ts-ignore
        if (error.response) {
            // @ts-ignore
            console.error("Error details:", JSON.stringify(error.response, null, 2));
        }
        return NextResponse.json(
            // @ts-ignore
            { error: error.message || "Failed to generate response", details: error.toString() },
            { status: 500 }
        );
    }
}
