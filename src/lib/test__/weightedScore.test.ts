import { describe, it, expect } from "vitest";

import {
    normalizeSkill,
    computeSkillScore,
    computeMissingSkills,
    computeWeightedSkillScore,
    computeFinalMatchScore,
    computeImportanceWeightedScore,
} from "@/lib/weightedScore";
import type { skillGroup, WeightedSkill } from "@/lib/weightedScore";

describe ("normalizeSkill", () => {
    it("normalizes casing, punctuation, and spcaing", () => {
        expect(normalizeSkill(" JavaScript ")).toBe("javascript");
        expect(normalizeSkill("Next.js")).toBe("nextjs");
        expect(normalizeSkill("C/C++")).toBe("c++");
    });

    it("applies alias mapping", () => {
        expect(normalizeSkill("JS")).toBe("javascript");
        expect(normalizeSkill("ts")).toBe("typescript");
        expect(normalizeSkill("aws")).toBe("amazon web services");
        expect(normalizeSkill("golang")).toBe("go");
        expect(normalizeSkill("rest API")).toBe("rest");
    });
});

describe("computeSkillScore", () => {
    it("returns 0 when jdSkills is empty", () => {
        expect(computeSkillScore([], ["react"])).toBe(0);
    });

    it("computes percentage match using keys", () => {
        const jd = [
            { label: "JavaScript", key: "javascript" },
            { label: "React", key: "react" },
            { label: "AWS", key: "amazon web services" },
        ];
        const resume = ["javascript", "react", "amazon web services"];

        // all 3 skills match -> 100%
        expect(computeSkillScore(jd, resume)).toBe(100);
    });

    it("computes partial match percentage correctly", () => {
        const jd = [
            { label: "JavaScript", key: "javascript" },
            { label: "React", key: "react" },
            { label: "AWS", key: "amazon web services" },
            { label: "PostgreSQL", key: "postgresql" },
        ];
        const resume = ["javascript", "react"];

        expect(computeSkillScore(jd, resume)).toBe(50); // 2 out of 4 -> 50%
    });
});

describe("computeMissingSkills", () => {
    it("returns skills missing from resume", () => {
        const jd = [
            { label: "JavaScript", key: "javascript" },
            { label: "React", key: "react" },
            { label: "AWS", key: "amazon web services" },
        ];
        const resume = ["javascript", "react"];

        const missing = computeMissingSkills(jd, resume);

        // should miss AWS
        expect(missing).toEqual(["AWS"]);
    });
});

describe("computeWeightedSkillScore", () => {
    it("computes weighted average of required and preferred", () => {
        const required = [
            { label: "React", key: "react" },
            { label: "TypeScript", key: "typescript" },
        ];
        const preferred = [
            { label: "AWS", key: "amazon web services" },
            { label: "Kubernetes", key: "kubernetes" },
        ];
        const resume = ["react", "typescript", "amazon web services"];

        // required: 2/2 -> 100%
        // preferred: 1/2 -> 50%
        // final = (100 * 0.8) + (50 * 0.2) = 90
        const result = computeWeightedSkillScore({
            required,
            preferred,
            resumeSkillKeys: resume,
            requiredWeight: 0.8,
        });

        expect(result.requiredScore).toBe(100);
        expect(result.preferredScore).toBe(50);
        expect(result.finalScore).toBe(90);
    });

    it("supports any_of groups (if you have any skill in the group, it counts as a hit)", () => {
        const required = [{ label: "React", key: "react" }];
        const requiredGroups: skillGroup[] = [
            {
                type: "any_of",
                items: [
                    { label: "MySQL", key: "mysql" },
                    { label: "PostgreSQL", key: "postgresql" },
                ],
            },
        ];
        const preferred: { label: string; key: string }[] = [];
        const resume = ["react", "postgresql"];

        // units: 1 skill + 1 group = 2 units
        // hits: react + postgresql (group) = 2 hits -> 100%
        const result = computeWeightedSkillScore({
            required,
            preferred,
            requiredGroups,
            resumeSkillKeys: resume,
            requiredWeight: 1.0,
        });

        expect(result.requiredScore).toBe(100);
        expect(result.finalScore).toBe(100);
    });

    it("uses the required score directly when no preferred skills exist", () => {
        const required = [
            { label: "React", key: "react" },
            { label: "TypeScript", key: "typescript" },
        ];

        const result = computeWeightedSkillScore({
            required,
            preferred: [],
            resumeSkillKeys: ["react", "typescript"],
            requiredWeight: 0.9,
        });

        expect(result.requiredScore).toBe(100);
        expect(result.preferredScore).toBe(0);
        expect(result.finalScore).toBe(100);
    });

    it("uses the preferred score directly when no required skills exist", () => {
        const preferred = [
            { label: "AWS", key: "amazon web services" },
            { label: "Kubernetes", key: "kubernetes" },
        ];

        const result = computeWeightedSkillScore({
            required: [],
            preferred,
            resumeSkillKeys: ["kubernetes"],
            requiredWeight: 0.9,
        });

        expect(result.requiredScore).toBe(0);
        expect(result.preferredScore).toBe(50);
        expect(result.finalScore).toBe(50);
    });

    it("returns 0 when no required or preferred skill units exist", () => {
        const result = computeWeightedSkillScore({
            required: [],
            preferred: [],
            requiredGroups: [],
            preferredGroups: [],
            resumeSkillKeys: ["react"],
            requiredWeight: 0.9,
        });

        expect(result.requiredScore).toBe(0);
        expect(result.preferredScore).toBe(0);
        expect(result.finalScore).toBe(0);
    });

});

describe("computeFinalMatchScore", () => {
    it("blends semantic and skill scores by weight", () => {
        // semantic: 70, skill: 30, weight: 0.6
        expect(
            computeFinalMatchScore({
                semanticScore: 70,
                skillScore: 30,
                semanticWeight: 0.6,
            })  
        ).toBe(54);
    });

    it("defaults semantic weight to 0.5", () => {
        // semantic: 80, skill: 60 => final: 70
        expect(
            computeFinalMatchScore({
                semanticScore: 80,
                skillScore: 60,
            })
        ).toBe(70);
    });
});

describe("computeImportanceWeightedScore", () => {
    it("weights matched skills by importance", () => {
        const jdSkills: WeightedSkill[] = [
            {
                name: "React",
                key: "react",
                category: "required",
                importance: 0.8,
                reason: "",
            },
            {
                name: "AWS",
                key: "amazon web services",
                category: "preferred",
                importance: 0.2,
                reason: "",
            },
        ];

        expect(computeImportanceWeightedScore(jdSkills, ["react"])).toBe(80);
    });

    it("returns 0 when there are no weighted skills", () => {
        expect(computeImportanceWeightedScore([], ["react"])).toBe(0);
    });
});
