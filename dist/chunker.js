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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkMarkdown = chunkMarkdown;
exports.walkDocs = walkDocs;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const micromatch_1 = __importDefault(require("micromatch"));
const EXCLUDE_DIRS = new Set([
    'node_modules',
    '.git',
    '.next',
    '.cache',
    '.turbo',
    'dist',
    'build',
    '.docusaurus',
    '.cursor',
]);
/**
 * Chunk markdown text by headers and size, tracking line numbers
 */
function chunkMarkdown(text, maxChunkSize = 1000) {
    const lines = text.split('\n');
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;
    let chunkStartLine = 1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isHeader = /^#{1,6}\s/.test(line);
        const lineLen = line.length + 1;
        // Start new chunk on header if we have content
        if (isHeader && currentChunk.length > 0) {
            chunks.push({
                text: currentChunk.join('\n'),
                startLine: chunkStartLine,
                endLine: i // Line before the header
            });
            currentChunk = [];
            currentSize = 0;
            chunkStartLine = i + 1;
        }
        // Start new chunk if size exceeded
        if (currentSize + lineLen > maxChunkSize && currentChunk.length > 0 && !isHeader) {
            chunks.push({
                text: currentChunk.join('\n'),
                startLine: chunkStartLine,
                endLine: i
            });
            currentChunk = [];
            currentSize = 0;
            chunkStartLine = i + 1;
        }
        currentChunk.push(line);
        currentSize += lineLen;
    }
    if (currentChunk.length > 0) {
        chunks.push({
            text: currentChunk.join('\n'),
            startLine: chunkStartLine,
            endLine: lines.length
        });
    }
    return chunks;
}
/**
 * Walk directory and find all markdown files with glob pattern support
 */
function walkDocs(dir, options = {}) {
    const { includePatterns = ['**/*.{md,mdx,markdown}'], excludePatterns = [] } = options;
    // First, collect all files recursively
    function walkDir(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        let files = [];
        for (const entry of entries) {
            if (EXCLUDE_DIRS.has(entry.name))
                continue;
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                files = files.concat(walkDir(fullPath));
            }
            else if (entry.isFile()) {
                files.push(fullPath);
            }
        }
        return files;
    }
    const allFiles = walkDir(dir);
    // Convert to relative paths for glob matching
    const relativePaths = allFiles.map((f) => path.relative(dir, f));
    // Apply include patterns
    let matched = (0, micromatch_1.default)(relativePaths, includePatterns);
    // Apply exclude patterns (combine with include using negation)
    if (excludePatterns.length > 0) {
        matched = matched.filter((f) => {
            return !micromatch_1.default.isMatch(f, excludePatterns);
        });
    }
    // Convert back to absolute paths
    return matched.map((f) => path.join(dir, f));
}
