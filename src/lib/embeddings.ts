import { openai } from "@/services/openaiClient";

export async function createEmbedding(text: string): Promise<number[]> {
    const clipped = text.slice(0, 8000);

    const res = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: clipped,
    });

    return res.data[0].embedding;
}