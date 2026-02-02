import { openai } from "@/services/openaiClient";

export type SkillWithImportance = { name: string; importance: number };
export type SkillGroupItem = { name: string; importance: number };

const DEFAULT_IMPORTANCE = 0.5;

function toSkillWithImportance(item: string | SkillWithImportance): SkillWithImportance {
    if (typeof item === "string") {
        return { name: item, importance: DEFAULT_IMPORTANCE };
    }
    const imp = typeof item.importance === "number" ? Math.max(0.1, Math.min(1, item.importance)) : DEFAULT_IMPORTANCE;
    return { name: String(item.name ?? "").trim(), importance: imp };
}

function toGroupItems(items: (string | SkillGroupItem)[]): SkillGroupItem[] {
    return (items ?? []).map((i) =>
        typeof i === "string" ? { name: i, importance: DEFAULT_IMPORTANCE } : toSkillWithImportance(i)
    );
}

function normalizeJDAnalysis(raw: unknown): JDAnalysis {
    const r = raw as Record<string, unknown>;
    const req = Array.isArray(r.requiredSkills) ? r.requiredSkills : [];
    const pref = Array.isArray(r.preferredSkills) ? r.preferredSkills : [];
    const reqGroups = Array.isArray(r.requiredGroups) ? r.requiredGroups : [];
    const prefGroups = Array.isArray(r.preferredGroups) ? r.preferredGroups : [];

    return {
        requiredSkills: req.map(toSkillWithImportance).filter((s) => s.name),
        preferredSkills: pref.map(toSkillWithImportance).filter((s) => s.name),
        requiredGroups: reqGroups.map((g: Record<string, unknown>) => ({
            type: "any_of" as const,
            items: toGroupItems(Array.isArray(g.items) ? g.items : []),
        })),
        preferredGroups: prefGroups.map((g: Record<string, unknown>) => ({
            type: "any_of" as const,
            items: toGroupItems(Array.isArray(g.items) ? g.items : []),
        })),
        level: typeof r.level === "string" ? r.level : "unknown",
    };
}

export type JDAnalysis = {
    requiredSkills: SkillWithImportance[];
    preferredSkills: SkillWithImportance[];
    requiredGroups: { type: "any_of"; items: SkillGroupItem[] }[];
    preferredGroups: { type: "any_of"; items: SkillGroupItem[] }[];
    level: string;
};

// IMPORTANCE HEURISTICS (0.1–1.0):
// - "must", "required", "mandatory" → 0.8–1.0
// - First 20% of JD, mentioned multiple times → +0.1–0.2
// - "preferred", "nice to have" → 0.3–0.5
// - Generic mention → 0.5

export async function extractSkillsFromJD(jdText: string): Promise<JDAnalysis> {
    const prompt = `
    You are an assistant that extracts structured information from job descriptions.

    Given the following job description, extract:
    - requiredSkills: list of required hard skills, each with { name: string, importance: number }
    - preferredSkills: list of preferred hard skills, each with { name: string, importance: number }
    - level: one of ["intern", "junior", "mid", "senior", "lead"]

    IMPORTANCE (0.1–1.0 per skill):
    - "must", "required", "mandatory", "critical" → 0.8–1.0
    - Mentioned in first 20% of JD → +0.1–0.2
    - Mentioned more than once → +0.1
    - "preferred", "nice to have", "bonus" → 0.3–0.5
    - Default / unclear → 0.5

    Rules:
    - Output ONLY skill names (1-3 words).
    - No duplicates (case insensitive).
    - Prefer concrete technologies over categories.
    - Do NOT include vague domain/category labels such as: "virtualization", "frontend/backend skills", "web development". 
    - Extract ONLY explicitly mentioned skills
    - If category appears with examples (e.g., "frameworks like React, Vue"), extract the examples only
    - Do NOT infer or assume unlisted skills
    - If JD says "at least one of", "one of", "either", or "including but not limited to", extract those items into an any_of group.
    - Items inside groups must NOT also appear in requiredSkills/preferredSkills.
    - For group items, also assign importance (same heuristics).


    LEVEL DETECTION RULES:
    - "intern" or "entry-level" → intern
    - "0-2 years" or "junior" → junior  
    - "2-5 years" or "mid-level" → mid
    - "5+ years" or "senior" → senior
    - "lead", "principal", "staff" → lead
    - If unclear, default to "mid"

    Return ONLY valid JSON with EXACT keys:
   {
        "requiredSkills": [{"name":"React","importance":0.9},{"name":"TypeScript","importance":0.7}],
        "preferredSkills": [{"name":"AWS","importance":0.4}],
        "requiredGroups": [{"type":"any_of","items":[{"name":"React","importance":0.8},{"name":"Vue","importance":0.8}]}],
        "preferredGroups": [],
        "level": "mid"
   }

    Job Description:

    ${jdText}
    `.trim();

    try {
        const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
    });
    const raw = res.choices[0].message.content || "{}";

    //  extract ```json ... ``` 
    const cleaned = raw
        .trim()
        .replace(/```json\s*/, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

    const parsed = JSON.parse(cleaned);
    return normalizeJDAnalysis(parsed);

    } catch (error) {
        console.error("OpenAI JD analyzer failed, falling back:", error);

        return normalizeJDAnalysis({
            requiredSkills: [],
            preferredSkills: [],
            requiredGroups: [],
            preferredGroups: [],
            level: "unknown",
        });
    }
}