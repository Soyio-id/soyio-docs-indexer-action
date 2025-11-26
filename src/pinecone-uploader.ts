import { Pinecone } from '@pinecone-database/pinecone';

export interface PineconeVector {
  id: string;
  values: number[];
  metadata: {
    file: string;
    chunkIndex: number;
    totalChunks: number;
    startLine: number;
    endLine: number;
    text: string;
  };
}

/**
 * Upload vectors to Pinecone in batches
 */
export async function uploadToPinecone(
  apiKey: string,
  indexName: string,
  vectors: PineconeVector[]
): Promise<void> {
  const pinecone = new Pinecone({ apiKey });
  const index = pinecone.index(indexName);

  console.log(`Uploading ${vectors.length} vectors to Pinecone index: ${indexName}`);

  // Batch upsert (Pinecone recommends batches of 100)
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);

    try {
      await index.upsert(batch);
      console.log(`  Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
    } catch (err) {
      const error = err as Error;
      console.error(`Failed to upload batch at index ${i}: ${error.message}`);
      throw err;
    }
  }

  console.log(`Successfully uploaded ${vectors.length} vectors`);
}

/**
 * Delete all vectors from index (for re-indexing)
 */
export async function clearIndex(apiKey: string, indexName: string): Promise<void> {
  const pinecone = new Pinecone({ apiKey });
  const index = pinecone.index(indexName);

  console.log(`Clearing index: ${indexName}`);

  try {
    await index.deleteAll();
    console.log('Index cleared successfully');
  } catch (err) {
    const error = err as Error;
    // 404 is expected for empty indexes - not an error
    if (error.message.includes('404')) {
      console.log('Index is empty (no vectors to clear)');
    } else {
      console.error(`Failed to clear index: ${error.message}`);
      throw err;
    }
  }
}
