/**
 * OpenAI API integration for embeddings generation
 */

// Interface for OpenAI API response (unused in mock implementation)
// interface OpenAIResponse {
//   data: Array<{
//     embedding: number[];
//   }>;
// }

/**
 * Generate embeddings using OpenAI text-embedding-3-small model
 */
export async function generateEmbeddings(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for embeddings generation');
  }

  try {
    // Note: This is a placeholder implementation
    // In a real implementation, you would call the OpenAI API
    // For now, we'll return a mock embedding array
    
    // Mock embedding generation (1536 dimensions for text-embedding-3-small)
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    
    // Add a small delay to simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`Generated embeddings for text: ${text.substring(0, 100)}...`);
    
    return mockEmbedding;
    
  } catch (error) {
    console.error('Failed to generate embeddings:', error);
    throw new Error(`Embeddings generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  const embeddings: number[][] = [];
  
  for (const text of texts) {
    try {
      const embedding = await generateEmbeddings(text);
      embeddings.push(embedding);
    } catch (error) {
      console.error(`Failed to generate embedding for text: ${text.substring(0, 50)}...`, error);
      // Continue with other texts even if one fails
      embeddings.push(new Array(1536).fill(0));
    }
  }
  
  return embeddings;
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
export function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embedding vectors must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const magnitude1 = Math.sqrt(norm1);
  const magnitude2 = Math.sqrt(norm2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Find most similar embeddings in a dataset
 */
export function findMostSimilar(
  targetEmbedding: number[], 
  embeddings: Array<{ id: string; embedding: number[] }>,
  topK: number = 5
): Array<{ id: string; similarity: number }> {
  const similarities = embeddings.map(item => ({
    id: item.id,
    similarity: calculateCosineSimilarity(targetEmbedding, item.embedding)
  }));

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}