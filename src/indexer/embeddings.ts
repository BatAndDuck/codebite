import { embed, embedMany, type EmbeddingModel } from 'ai';

export async function generateEmbedding(
  model: EmbeddingModel,
  text: string
): Promise<number[]> {
  const { embedding } = await embed({ model, value: text });
  return embedding;
}

export async function generateEmbeddings(
  model: EmbeddingModel,
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Batch in groups of 100 to avoid rate limits
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const { embeddings } = await embedMany({ model, values: batch });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
