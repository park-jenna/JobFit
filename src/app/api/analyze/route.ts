import { extractSkillsFromJD } from "@/services/jdAnalyzer";
import { extractSkillsFromResume } from "@/services/resumeAnalyzer";
import { NextResponse } from "next/server";
import { generateSummary } from "@/services/summary";

// semantic similarity utils
import { createEmbedding } from "@/lib/embeddings";
import { cosineSimilarity, semanticToPercent } from "@/lib/similarity";

import {
    normalizeSkill,
    computeMissingSkills,
    computeWeightedSkillScore,
    computeFinalMatchScore,
} from "@/lib/weightedScore";

const pdfParse = require("pdf-parse/lib/pdf-parse.js");

// Enable Node.js runtime for this route
export const runtime = "nodejs";

// clean JD skills by removing generic/junk skills
function cleanJDSkills(skills: string[]) {
    const junk = new Set([
        "programming languages",
        "programming language",
        "proficiency in programming languages",
        "front end frameworks",
        "front-end frameworks",
        "frontend frameworks",
    ]);

    // normalize and filter out junk skills
    const cleaned = skills
        .map((s) => s.replace(/^proficiency in\s+/i, "").trim())
        .map((s) => s.replace(/^experience with\s+/i, "").trim())
        .map((s) => s.replace(/^familiarity with\s+/i, "").trim())
        .map((s) => s.replace(/^knowledge of\s+/i, "").trim())
        .map((s) => s.replace(/^experience in\s+/i, "").trim())
        .filter((s) => s.length >0)
        .filter((s) => !junk.has(normalizeSkill(s)));
    
    const unique = Array.from(new Map(cleaned.map((s) => [normalizeSkill(s), s])).values());

    return unique;
    
}

export async function POST(req: Request) {
    const formData = await req.formData();

    // FormData 에서 jdText와 resume 파일 추출
    const jdText = (formData.get("jdText") as string) ?? "";
    const resume = formData.get("resume");

    const resumeFile = resume instanceof File ? resume : null;

    if (!resumeFile) {
        return NextResponse.json({ error: "No resume file uploaded." }, { status: 400 });
    }

    // ArrayBuffer -> Node Buffer
    const buffer = Buffer.from(await resumeFile.arrayBuffer());
    // PDF -> Text 변환
    const parsed = await pdfParse(buffer);
    const resumeText = (parsed.text ?? "").trim();


    if (!resumeText.trim()) {
        return NextResponse.json({ error: "Failed to extract text from resume PDF." }, { status: 400 });
    }

    // 1. Compute semantic similarity
    const[jdEmbedding, resumeEmbedding] = await Promise.all([
        createEmbedding(jdText),
        createEmbedding(resumeText)
    ]);


    const semanticSim = cosineSimilarity(jdEmbedding, resumeEmbedding); // -1 to 1
    const semanticScore = semanticToPercent(semanticSim); // 0 to 100

    // 2. Generate AI summary with both JD and Resume
    const aiSummary = await generateSummary(jdText, resumeText);

    // 3. Extract skills from JD and Resume
    const [jdAnalysis, resumeAnalysis] = await Promise.all([
        extractSkillsFromJD(jdText),
        extractSkillsFromResume(resumeText),
        generateSummary(jdText, resumeText),
    ]); 

    const resumeSkillsRaw = resumeAnalysis.skills ?? [];
    const resumeSkills = Array.from(new Map(resumeSkillsRaw.map((s) => [normalizeSkill(s), s])).values());

    const jdRequiredRaw = jdAnalysis.requiredSkills ?? [];
    const jdPreferredRaw = jdAnalysis.preferredSkills ?? [];

    const jdRequired = cleanJDSkills(jdRequiredRaw);
    const jdPreferred = cleanJDSkills(jdPreferredRaw);

    // 4. compute missing skills
    const missingRequired = computeMissingSkills(jdRequired, resumeSkills);
    const missingPreferred = computeMissingSkills(jdPreferred, resumeSkills);

    // 5. compute weighted skill score
    const weighted = computeWeightedSkillScore({
        required: jdRequired,
        preferred: jdPreferred,
        resumeSkills,
        requiredWeight: 0.8, // 80% weight to required skills
    });

    // 6. compute final match score
    //   - semantic score weight: 50%
    //   - skill score weight: 50%
    const matchScore = computeFinalMatchScore({
        semanticScore,
        skillScore: weighted.finalScore,
        semanticWeight: 0.5,
    });

    return NextResponse.json({
        ok: true,
        __version: "route-2026-01-18-v2",
        
        jdAnalysis,
        jdRequired,
        jdPreferred,

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

}
