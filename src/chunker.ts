import * as fs from 'fs';
import * as path from 'path';
import micromatch from 'micromatch';

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

export interface Chunk {
  text: string;
  startLine: number;
  endLine: number;
}

export interface WalkOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
}

/**
 * Chunk markdown text by headers and size, tracking line numbers
 */
export function chunkMarkdown(text: string, maxChunkSize: number = 1000): Chunk[] {
  const lines = text.split('\n');
  const chunks: Chunk[] = [];
  let currentChunk: string[] = [];
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
        endLine: i  // Line before the header
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
export function walkDocs(dir: string, options: WalkOptions = {}): string[] {
  const { includePatterns = ['**/*.{md,mdx,markdown}'], excludePatterns = [] } = options;

  // First, collect all files recursively
  function walkDir(currentDir: string): string[] {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    let files: string[] = [];

    for (const entry of entries) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        files = files.concat(walkDir(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const allFiles = walkDir(dir);

  // Convert to relative paths for glob matching
  const relativePaths = allFiles.map((f: string) => path.relative(dir, f));

  // Apply include patterns
  let matched = micromatch(relativePaths, includePatterns);

  // Apply exclude patterns (combine with include using negation)
  if (excludePatterns.length > 0) {
    matched = matched.filter((f: string) => {
      return !micromatch.isMatch(f, excludePatterns);
    });
  }

  // Convert back to absolute paths
  return matched.map((f: string) => path.join(dir, f));
}
