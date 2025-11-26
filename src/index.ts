import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { chunkMarkdown, walkDocs, Chunk } from './chunker';
import { generateEmbeddings } from './embedder';
import { uploadToPinecone, clearIndex, PineconeVector } from './pinecone-uploader';

// Load .env if running locally (not in GitHub Actions)
if (!process.env.GITHUB_ACTIONS) {
  dotenv.config();
}

interface ChunkMetadata {
  file: string;
  chunkIndex: number;
  totalChunks: number;
  startLine: number;
  endLine: number;
}

function getInput(name: string, required: boolean = false): string {
  // Try GitHub Actions input first
  const actionInput = core.getInput(name, { required: false });
  if (actionInput) return actionInput;

  // Fall back to environment variables (for local testing)
  const envVarName = `INPUT_${name.toUpperCase().replace(/-/g, '_')}`;
  const envValue = process.env[envVarName] || process.env[name.toUpperCase()];

  if (!envValue && required) {
    throw new Error(`Required input '${name}' not provided`);
  }

  return envValue || '';
}

async function run(): Promise<void> {
  try {
    // Get inputs (works with both GitHub Actions and .env)
    const pineconeApiKey = getInput('pinecone_api_key', true);
    const pineconeIndex = getInput('pinecone_index', true);
    const geminiApiKey = getInput('gemini_api_key', true);
    const docsPath = getInput('docs_path') || '.';
    const chunkSize = parseInt(getInput('chunk_size') || '1300', 10);

    // Parse glob patterns (comma-separated)
    const includeInput = getInput('include_patterns') || '**/*.{md,mdx,markdown}';
    const excludeInput = getInput('exclude_patterns') || '';

    const includePatterns = includeInput.split(',').map(p => p.trim()).filter(Boolean);
    const excludePatterns = excludeInput.split(',').map(p => p.trim()).filter(Boolean);

    console.log('='.repeat(60));
    console.log('Soyio Docs Indexer');
    console.log('='.repeat(60));
    console.log(`Docs path: ${docsPath}`);
    console.log(`Chunk size: ${chunkSize}`);
    console.log(`Include patterns: ${includePatterns.join(', ')}`);
    if (excludePatterns.length > 0) {
      console.log(`Exclude patterns: ${excludePatterns.join(', ')}`);
    }
    console.log(`Pinecone index: ${pineconeIndex}`);
    console.log('='.repeat(60));

    // Step 1: Find all markdown files
    console.log('\n[1/5] Finding markdown files...');
    const files = walkDocs(docsPath, { includePatterns, excludePatterns });
    console.log(`Found ${files.length} markdown files`);

    if (files.length === 0) {
      throw new Error('No markdown files found in docs path');
    }

    // Step 2: Chunk files
    console.log('\n[2/5] Chunking files...');
    const allChunks: Chunk[] = [];
    const metadata: ChunkMetadata[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const chunks = chunkMarkdown(content, chunkSize);
      const relativePath = path.relative(docsPath, file);

      chunks.forEach((chunk, idx) => {
        allChunks.push(chunk);
        metadata.push({
          file: relativePath,
          chunkIndex: idx,
          totalChunks: chunks.length,
          startLine: chunk.startLine,
          endLine: chunk.endLine
        });
      });
    }

    console.log(`Generated ${allChunks.length} chunks from ${files.length} files`);

    // Step 3: Generate embeddings
    console.log('\n[3/5] Generating embeddings...');
    const chunkTexts = allChunks.map(c => c.text);
    const embeddings = await generateEmbeddings(geminiApiKey, chunkTexts);

    // Step 4: Prepare vectors for Pinecone
    console.log('\n[4/5] Preparing vectors...');
    const vectors: PineconeVector[] = embeddings.map((embedding, idx) => ({
      id: `chunk-${idx}`,
      values: embedding,
      metadata: {
        file: metadata[idx].file,
        chunkIndex: metadata[idx].chunkIndex,
        totalChunks: metadata[idx].totalChunks,
        startLine: metadata[idx].startLine,
        endLine: metadata[idx].endLine,
        text: allChunks[idx].text.substring(0, 500) // Store first 500 chars in metadata
      }
    }));

    // Step 5: Upload to Pinecone
    console.log('\n[5/5] Uploading to Pinecone...');

    // Clear existing index first
    await clearIndex(pineconeApiKey, pineconeIndex);

    // Upload new vectors
    await uploadToPinecone(pineconeApiKey, pineconeIndex, vectors);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Indexing complete!');
    console.log(`   Files: ${files.length}`);
    console.log(`   Chunks: ${allChunks.length}`);
    console.log(`   Vectors: ${vectors.length}`);
    console.log('='.repeat(60));

    // Set outputs (only works in GitHub Actions)
    if (process.env.GITHUB_ACTIONS) {
      core.setOutput('files_indexed', files.length);
      core.setOutput('chunks_created', allChunks.length);
      core.setOutput('vectors_uploaded', vectors.length);
    }

  } catch (error) {
    const err = error as Error;
    if (process.env.GITHUB_ACTIONS) {
      core.setFailed(`Action failed: ${err.message}`);
    } else {
      console.error(`\n❌ Error: ${err.message}`);
      process.exit(1);
    }
  }
}

run();
