"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
const chunker_1 = require("./chunker");
const embedder_1 = require("./embedder");
const pinecone_uploader_1 = require("./pinecone-uploader");
// Load .env if running locally (not in GitHub Actions)
if (!process.env.GITHUB_ACTIONS) {
    dotenv.config();
}
function getInput(name, required = false) {
    // Try GitHub Actions input first
    const actionInput = core.getInput(name, { required: false });
    if (actionInput)
        return actionInput;
    // Fall back to environment variables (for local testing)
    const envVarName = `INPUT_${name.toUpperCase().replace(/-/g, '_')}`;
    const envValue = process.env[envVarName] || process.env[name.toUpperCase()];
    if (!envValue && required) {
        throw new Error(`Required input '${name}' not provided`);
    }
    return envValue || '';
}
async function run() {
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
        const files = (0, chunker_1.walkDocs)(docsPath, { includePatterns, excludePatterns });
        console.log(`Found ${files.length} markdown files`);
        if (files.length === 0) {
            throw new Error('No markdown files found in docs path');
        }
        // Step 2: Chunk files
        console.log('\n[2/5] Chunking files...');
        const allChunks = [];
        const metadata = [];
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const chunks = (0, chunker_1.chunkMarkdown)(content, chunkSize);
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
        const embeddings = await (0, embedder_1.generateEmbeddings)(geminiApiKey, chunkTexts);
        // Step 4: Prepare vectors for Pinecone
        console.log('\n[4/5] Preparing vectors...');
        const vectors = embeddings.map((embedding, idx) => ({
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
        await (0, pinecone_uploader_1.clearIndex)(pineconeApiKey, pineconeIndex);
        // Upload new vectors
        await (0, pinecone_uploader_1.uploadToPinecone)(pineconeApiKey, pineconeIndex, vectors);
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
    }
    catch (error) {
        const err = error;
        if (process.env.GITHUB_ACTIONS) {
            core.setFailed(`Action failed: ${err.message}`);
        }
        else {
            console.error(`\n❌ Error: ${err.message}`);
            process.exit(1);
        }
    }
}
run();
