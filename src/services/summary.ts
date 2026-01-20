import { openai } from "@/services/openaiClient";
import { parseLiteralDef } from "openai/_vendor/zod-to-json-schema/index.mjs";

export type aiSummaryResult = {
    strengths: string[];
    gaps: string[];
    overallFit: string;
};

export async function generateSummary (
    jdText: string,
    resumeText: string
): Promise<aiSummaryResult> {
    const prompt = `
    You are an assistant summarizing how well this candidate matches the job description.
    Focus on key strengths, gaps, and overall fit.
    
    Given the job description and the resume below, return ONLY valid JSON with the following structure:
    {
        "strengths": ["short bullet point 1", "short bullet point 2", ...],
        "gaps": ["short bullet point 1", "short bullet point 2", ...],
        "overallFit": "short phrase summarizing overall fit"
    }

    Rules: 
    - Each bullet point should be concise (max 10 words).
    - No markdown
    - No explanations outside JSON

    Job Description:
    ${jdText}

    Resume:
    ${resumeText}
    `.trim();

    try {
        const res = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });

        const raw = res.choices[0].message.content ?? "{}";

        // Extract ```json ... ```
        const cleaned = raw
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const parsed = JSON.parse(cleaned);

        return {
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
            gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
            overallFit: typeof parsed.overallFit === "string" ? parsed.overallFit : "",
        };
    } catch (error) {
        console.error("OpenAI summary generation failed:", error);
        return {
            strengths: [],
            gaps: [],
            overallFit: "summary not available",
        };
    }
}
