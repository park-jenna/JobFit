export type WeightedSkill = {
    name: string;
    key: string;
    category: "required" | "preferred";
    importance: number;
    reason: string;
};

export function normalizeSkill(skill: string): string {
    if (typeof skill !== "string") return "";
    const base = skill
        .toLocaleLowerCase()
        .replace(/[\(\)\[\]\{\},.]/g, "")
        .replace(/[-/]/g, " ")
        .replace(/\s+/g, " ")    
        .trim();

    const aliases: Record<string, string> = {
        "js": "javascript",
        "ts": "typescript",
        "html5": "html",
        "css3": "css",
        "nodejs": "node",
        "reactjs": "react",
        "vuejs": "vue",
        "aws": "amazon web services",
        "gcp": "google cloud platform",
        "ci/cd": "ci cd",
        "c c++": "c++",
        "c/c++": "c++",
        "devops": "dev ops",
        "no sql": "nosql",
        "mongo db": "mongodb",
        "postgre sql": "postgresql",
        "k8s": "kubernetes",
        "tf": "terraform",
        "py": "python",
        "golang": "go",
        "rest api": "rest",
        "restful": "rest",
        "ml": "machine learning",
        "ai": "artificial intelligence",
        "nlp": "natural language processing",
        "ci cd": "continuous integration continuous deployment",
        "next": "nextjs",
        "next.js": "nextjs",
        "react.js": "react",
        "gitlab": "git",
        "github": "git",
        "restful apis": "rest",
        "apis": "rest",
        "deckgl": "deck.gl",
        "kepler.gl": "kepler",
    };

    return aliases[base] ?? base;
}

export type SkillItem = { label: string; key: string };
export type skillGroup = { type: "any_of"; items: SkillItem[] };

function countScoreUnits(skills: SkillItem[], groups: skillGroup[] = []): number {
    return (skills?.length ?? 0) + (groups?.length ?? 0);
}

function matchAnyOfGroup(group: skillGroup, resumeSkillsSet: Set<string>): boolean {
    return group.items.some((item) => resumeSkillsSet.has(item.key));
}

function computeSkillScoreWithGroups(
    jdSkills: SkillItem[],
    jdGroups: skillGroup[],
    resumeSkillKeys: string[]
): number {
    const resumeSet = new Set(resumeSkillKeys ?? []);
    const skillHits = jdSkills.filter((s) => resumeSet.has(s.key)).length;
    const groupHits = jdGroups.filter((g) => matchAnyOfGroup(g, resumeSet)).length;

    const totalUnits = (jdSkills?.length ?? 0) + (jdGroups?.length ?? 0);
    if (totalUnits === 0) return 0;

    return Math.round(((skillHits + groupHits) / totalUnits) * 100);
}


export function computeSkillScore(jdSkills: SkillItem[], resumeSkillKeys: string[]): number {
    if (!Array.isArray(jdSkills) || jdSkills.length === 0) return 0;

    const resumeSet = new Set(resumeSkillKeys ?? []);
    const hit = jdSkills.filter((s) => resumeSet.has(s.key)).length;

    return Math.round((hit / jdSkills.length) * 100);
}

export function computeMissingSkills(jdSkills: SkillItem[], resumeSkillKeys: string[]): string[] {
    const resumeSet = new Set(resumeSkillKeys ?? []);
    return jdSkills.filter((s) => !resumeSet.has(s.key)).map((s) => s.label);
}

export function computeWeightedSkillScore(params: {
    required: SkillItem[];
    preferred: SkillItem[];
    requiredGroups?: skillGroup[];
    preferredGroups?: skillGroup[];
    resumeSkillKeys: string[];
    requiredWeight?: number; // default 0.8
}): { requiredScore: number; preferredScore: number; finalScore: number } {
    const requestedRequiredWeight = typeof params.requiredWeight === "number" ? params.requiredWeight : 0.8;
    const requiredWeight = Math.max(0, Math.min(1, requestedRequiredWeight));
    const preferredWeight = 1 - requiredWeight;
    const requiredGroups = params.requiredGroups ?? [];
    const preferredGroups = params.preferredGroups ?? [];

    const requiredScore = computeSkillScoreWithGroups(
        params.required,
        requiredGroups,
        params.resumeSkillKeys
    );

    const preferredScore = computeSkillScoreWithGroups(
        params.preferred,
        preferredGroups,
        params.resumeSkillKeys
    );

    const hasRequiredUnits = countScoreUnits(params.required, requiredGroups) > 0;
    const hasPreferredUnits = countScoreUnits(params.preferred, preferredGroups) > 0;

    let finalScore = 0;
    if (hasRequiredUnits && hasPreferredUnits) {
        finalScore = Math.round(
            requiredScore * requiredWeight + preferredScore * preferredWeight
        );
    } else if (hasRequiredUnits) {
        finalScore = requiredScore;
    } else if (hasPreferredUnits) {
        finalScore = preferredScore;
    }

    return {
        requiredScore,
        preferredScore,
        finalScore,
    };  
}

// compute final match score from semantic and skill scores
// params:
//  semanticScore: number - semantic similarity score (0 - 100)
//  skillScore: number - skill match score (0 - 100)
//  semanticWeight: number - weight for semantic score (default 0.5)
// logic:
// embedding score and skill score are combined using weighted average
// default weights are 0.5 each
export function computeFinalMatchScore(params: {
    semanticScore: number; // 0 - 100
    skillScore: number; // 0 - 100
    semanticWeight?: number; // default 0.5
}): number {
    const semanticWeight = typeof params.semanticWeight === "number" ? params.semanticWeight : 0.5;
    const skillWeight = 1 - semanticWeight;

    return Math.round(
        params.semanticScore * semanticWeight + params.skillScore * skillWeight
    );
}

export function computeImportanceWeightedScore(
    jdSkills: WeightedSkill[],
    resumeSkillKeys: string[]
): number {
    if (!Array.isArray(jdSkills) || jdSkills.length === 0) return 0;
    
    const resumeSet = new Set(resumeSkillKeys ?? []);

    let totalImportance = 0;
    let matchedImportance = 0;

    for (const skill of jdSkills) {
        const importance = typeof skill.importance === "number" ? skill.importance : 0;
        if (importance <= 0) continue;

        totalImportance += importance;

        if (skill.key && resumeSet.has(skill.key)) {
            matchedImportance += importance;
        }
    }

    if (totalImportance === 0) return 0;

    return Math.round((matchedImportance / totalImportance) * 100);
}

        

