function stripCodeFence(raw: string): string {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
        ?? trimmed.match(/^~~~(?:json)?\s*([\s\S]*?)\s*~~~$/i);

    return (fenceMatch?.[1] ?? trimmed).trim();
}

function extractJsonObjectCandidate(raw: string): string {
    const stripped = stripCodeFence(raw);
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        return stripped;
    }

    return stripped.slice(firstBrace, lastBrace + 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseLlmJsonObject(raw: string, context: string): Record<string, unknown> {
    const candidate = extractJsonObjectCandidate(raw);

    try {
        const parsed: unknown = JSON.parse(candidate);
        if (!isRecord(parsed)) {
            throw new Error("Expected a JSON object.");
        }

        return parsed;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown JSON parse error.";
        throw new Error(`${context}: failed to parse JSON response. ${message}`);
    }
}
