import { openai } from "@/services/openaiClient";

type ResumeAnalysis = {
    skills: string[];
};

export async function extractSkillsFromResume(resumeText: string): Promise<ResumeAnalysis> {
    const prompt = `
    You are an assistant that extracts technical skills from a software engineer resume.

    From the following resume text, extract:
    - skills: a list of technical skills (languages, frameworks, tools, etc.)

    Rules:
    - Short skill names only (1-3 words)
    - No explanations
    - No duplicates
    - Use common industry names
    - Do NOT include vague categories like "programming languages" or "frameworks"
    - Look for skills in BOTH the skills section and project/experience descriptions.

    Return ONLY valid JSON with this exact shape:
    {
        "skills": ["skill1", "skill2", ...]
    }
    
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
            skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        };
    } catch (error) {
        console.error("OpenAI resume analyzer failed, falling back:", error);

        return {
            skills: [],     
        };
    }
}