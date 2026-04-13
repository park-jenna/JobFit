import { extractSkillsFromJD } from "@/services/jdAnalyzer";
import { extractSkillsFromResume } from "@/services/resumeAnalyzer";
import { NextResponse } from "next/server";
import { generateSummary } from "@/services/summary";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// semantic similarity utils
import { createEmbedding } from "@/lib/embeddings";
import { cosineSimilarity, semanticToPercent } from "@/lib/similarity";

import {
    normalizeSkill,
    computeMissingSkills,
    computeWeightedSkillScore,
    computeFinalMatchScore,
    computeImportanceWeightedScore,
} from "@/lib/weightedScore";
import type { SkillItem, skillGroup, WeightedSkill } from "@/lib/weightedScore";

export const runtime = "nodejs";

function cleanJDSkills(skills: string[]) {
    const junk = new Set([
        "programming languages",
        "programming language",
        "proficiency in programming languages",
        "front end frameworks",
        "front-end frameworks",
        "frontend frameworks",
    ]);

    const cleaned = skills
        .map((s) => s.replace(/^proficiency in\s+/i, "").trim())
        .map((s) => s.replace(/^experience with\s+/i, "").trim())
        .map((s) => s.replace(/^familiarity with\s+/i, "").trim())
        .map((s) => s.replace(/^knowledge of\s+/i, "").trim())
        .map((s) => s.replace(/^experience in\s+/i, "").trim())
        .filter((s) => s.length > 0)
        .filter((s) => !junk.has(normalizeSkill(s)));
    
    const unique = Array.from(new Map(cleaned.map((s) => [normalizeSkill(s), s])).values());

    return unique;
    
}

type RawSkillGroup = {
    type: "any_of";
    items: string[] | { name: string }[];
};

function toSkillItem(label: string): SkillItem {
    return { label, key: normalizeSkill(label) };
}

function extractGroupItemNames(items: (string | { name: string })[]): string[] {
    return (items ?? []).map((i) => (typeof i === "string" ? i : i.name));
}

function normalizeGroupsToSkillItems(
    groups: RawSkillGroup[],
    cleanFn: (names: string[]) => string[]
): skillGroup[] {
    return (groups ?? []).map((group) => {
        const names = extractGroupItemNames(group.items ?? []);
        const cleaned = cleanFn(names);
        return {
            type: "any_of" as const,
            items: Array.from(
                new Map(
                    cleaned.map((name) => {
                        const key = normalizeSkill(name);
                        return [key, { label: name, key }];
                    })
                ).values()
            ),
        };
    });
}

function buildWeightedSkillsFromJDAnalysis(jdAnalysis: {
    requiredSkills: { name: string; importance: number }[];
    preferredSkills: { name: string; importance: number }[];
    requiredGroups: { type: string; items: { name: string; importance: number }[] }[];
    preferredGroups: { type: string; items: { name: string; importance: number }[] }[];
}): WeightedSkill[] {
    const skillMap = new Map<string, WeightedSkill>();

    const add = (name: string, importance: number, category: "required" | "preferred") => {
        const key = normalizeSkill(name);
        if (!key) return;
        const imp = Math.max(0.1, Math.min(1, importance));
        const existing = skillMap.get(key);
        if (!existing || imp > existing.importance) {
            skillMap.set(key, { name, key, category, importance: imp, reason: "" });
        }
    };

    for (const s of jdAnalysis.requiredSkills ?? []) {
        add(s.name, s.importance, "required");
    }
    for (const s of jdAnalysis.preferredSkills ?? []) {
        add(s.name, s.importance, "preferred");
    }
    for (const g of jdAnalysis.requiredGroups ?? []) {
        for (const item of g.items ?? []) {
            add(item.name, item.importance, "required");
        }
    }
    for (const g of jdAnalysis.preferredGroups ?? []) {
        for (const item of g.items ?? []) {
            add(item.name, item.importance, "preferred");
        }
    }

    return Array.from(skillMap.values());
}


const MIN_JD_LENGTH = 50;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();

        const jdText = ((formData.get("jdText") as string) ?? "").trim();
        const resume = formData.get("resume");
        const resumeFile = resume instanceof File ? resume : null;

        if (!jdText) {
            return NextResponse.json(
                { error: "Job description is required." },
                { status: 400 }
            );
        }
        if (jdText.length < MIN_JD_LENGTH) {
            return NextResponse.json(
                { error: "Job description is too short. Please paste the full description." },
                { status: 400 }
            );
        }
        if (!resumeFile) {
            return NextResponse.json(
                { error: "No resume file uploaded." },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await resumeFile.arrayBuffer());
        const parsed = await pdfParse(buffer);
        const resumeText = (parsed.text ?? "").trim();

        if (!resumeText.trim()) {
            return NextResponse.json(
                { error: "Failed to extract text from resume PDF." },
                { status: 400 }
            );
        }

        const [jdEmbedding, resumeEmbedding, jdAnalysis, resumeAnalysis] = await Promise.all([
            createEmbedding(jdText),
            createEmbedding(resumeText),
            extractSkillsFromJD(jdText),
            extractSkillsFromResume(resumeText),
        ]);

        const semanticSim = cosineSimilarity(jdEmbedding, resumeEmbedding);
        const semanticScore = semanticToPercent(semanticSim);
        const weightedSkills = buildWeightedSkillsFromJDAnalysis(jdAnalysis);

        const resumeSkillsRaw = [
            ...(resumeAnalysis.tools ?? []),
            ...(resumeAnalysis.concepts ?? []),
        ];

        const resumeSkills = Array.from(
            new Map(
                resumeSkillsRaw.map((s) => [normalizeSkill(s), s])
            ).values()
        );
        const resumeSkillKeys = resumeSkills.map((s) => normalizeSkill(s));

        const jdRequiredRaw = jdAnalysis.requiredSkills ?? [];
        const jdPreferredRaw = jdAnalysis.preferredSkills ?? [];
        const jdRequiredGroupsRaw = jdAnalysis.requiredGroups ?? [];
        const jdPreferredGroupsRaw = jdAnalysis.preferredGroups ?? [];

        const jdRequired = cleanJDSkills(jdRequiredRaw.map((s) => s.name));
        const jdPreferred = cleanJDSkills(jdPreferredRaw.map((s) => s.name));

        const jdRequiredItems = jdRequired.map(toSkillItem);
        const jdPreferredItems = jdPreferred.map(toSkillItem);
        const jdRequiredGroupItems = normalizeGroupsToSkillItems(
            jdRequiredGroupsRaw,
            cleanJDSkills
        );
        const jdPreferredGroupItems = normalizeGroupsToSkillItems(
            jdPreferredGroupsRaw,
            cleanJDSkills
        );

        const missingRequired = computeMissingSkills(jdRequiredItems, resumeSkillKeys);
        const missingPreferred = computeMissingSkills(jdPreferredItems, resumeSkillKeys);

        const weighted = computeWeightedSkillScore({
            required: jdRequiredItems,
            preferred: jdPreferredItems,
            requiredGroups: jdRequiredGroupItems,
            preferredGroups: jdPreferredGroupItems,
            resumeSkillKeys,
            requiredWeight: 0.9,
        });

        const importanceWeightedScore = computeImportanceWeightedScore(
            weightedSkills,
            resumeSkillKeys
        );

        const matchScore = computeFinalMatchScore({
            semanticScore,
            skillScore: Math.round(
                weighted.finalScore * 0.5 + importanceWeightedScore * 0.5
            ),
            semanticWeight: 0.5,
        });

        const aiSummary = await generateSummary(jdText, resumeText);

        const jdRequiredGroups = jdRequiredGroupItems.map((g) => ({
            type: "any_of" as const,
            items: g.items.map((i) => i.label),
        }));
        const jdPreferredGroups = jdPreferredGroupItems.map((g) => ({
            type: "any_of" as const,
            items: g.items.map((i) => i.label),
        }));

        return NextResponse.json({
            ok: true,
            __version: "route-2026-04-13-resume-ready",

            jdAnalysis,
            jdRequired,
            jdPreferred,
            jdRequiredGroups,
            jdPreferredGroups,

            resumeSkills,

            semanticScore,
            skillScore: weighted.finalScore,
            matchScore,

            missingSkills: {
                required: missingRequired,
                preferred: missingPreferred,
            },

            scoreBreakdown: {
                requiredScore: weighted.requiredScore,
                preferredScore: weighted.preferredScore,
            },

            aiSummary: {
                strengths: aiSummary.strengths,
                gaps: aiSummary.gaps,
                overallFit: aiSummary.overallFit,
            },

            summary: `Received JD (${jdText.length} chars). Extracted resume text length: ${resumeText.length} chars.`,
        });
    } catch (err) {
        console.error("Analyze route error:", err);
        return NextResponse.json(
            { error: "Analysis failed. Please try again." },
            { status: 500 }
        );
    }
}
