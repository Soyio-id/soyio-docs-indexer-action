"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbeddings = generateEmbeddings;
const genai_1 = require("@google/genai");
/**
 * Generate embeddings for text chunks using Gemini with parallel processing
 */
async function generateEmbeddings(apiKey, texts) {
    const client = new genai_1.GoogleGenAI({ apiKey });
    const embeddings = [];
    console.log(`Generating embeddings for ${texts.length} chunks...`);
    // Process in parallel batches for maximum speed
    const batchSize = 50; // Process 50 chunks concurrently
    const batches = [];
    for (let i = 0; i < texts.length; i += batchSize) {
        batches.push(texts.slice(i, i + batchSize));
    }
    console.log(`Processing ${batches.length} batches in parallel...`);
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        // Process all chunks in this batch in parallel
        const promises = batch.map(async (text) => {
            try {
                const result = await client.models.embedContent({
                    model: 'models/text-embedding-004',
                    contents: [{ parts: [{ text }] }]
                });
                if (result.embeddings && result.embeddings[0]) {
                    return result.embeddings[0].values;
                }
                else {
                    throw new Error('No embeddings returned');
                }
            }
            catch (err) {
                const error = err;
                console.error(`Failed to embed chunk: ${error.message}`);
                // Return zero vector as fallback
                return new Array(768).fill(0);
            }
        });
        // Wait for all embeddings in this batch to complete
        const batchResults = await Promise.all(promises);
        embeddings.push(...batchResults);
        console.log(`  Completed batch ${batchIdx + 1}/${batches.length} (${embeddings.length}/${texts.length} total)`);
    }
    console.log(`Generated ${embeddings.length} embeddings`);
    return embeddings;
}
