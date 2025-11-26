import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { chunkMarkdown, walkDocs } from '../chunker';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('chunkMarkdown', () => {
  it('splits on headers while preserving line numbers', () => {
    const text = [
      '# Intro',
      'Line a',
      'Line b',
      '## Details',
      'Line c',
      'Line d'
    ].join('\n');

    const chunks = chunkMarkdown(text, 1000);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({
      text: '# Intro\nLine a\nLine b',
      startLine: 1,
      endLine: 3
    });
    expect(chunks[1]).toEqual({
      text: '## Details\nLine c\nLine d',
      startLine: 4,
      endLine: 6
    });
  });

  it('splits when the chunk size is exceeded', () => {
    const text = ['Line one', 'Line two', 'Line three'].join('\n');

    const chunks = chunkMarkdown(text, 12);

    expect(chunks.map(c => c.text)).toEqual(['Line one', 'Line two', 'Line three']);
    expect(chunks.map(c => c.startLine)).toEqual([1, 2, 3]);
    expect(chunks.map(c => c.endLine)).toEqual([1, 2, 3]);
  });
});

describe('walkDocs', () => {
  it('finds markdown files and skips excluded directories', () => {
    const base = createTempDir('walk-docs-');
    fs.mkdirSync(path.join(base, 'sub'), { recursive: true });
    fs.mkdirSync(path.join(base, 'node_modules'), { recursive: true });

    fs.writeFileSync(path.join(base, 'guide.md'), '# Guide');
    fs.writeFileSync(path.join(base, 'notes.mdx'), 'Content');
    fs.writeFileSync(path.join(base, 'sub', 'nested.markdown'), 'Nested content');
    fs.writeFileSync(path.join(base, 'node_modules', 'ignore.md'), 'Should be ignored');

    const files = walkDocs(base);
    const relative = files.map(f => path.relative(base, f)).sort();

    expect(relative).toEqual(['guide.md', 'notes.mdx', path.join('sub', 'nested.markdown')]);
  });

  it('applies include and exclude glob patterns', () => {
    const base = createTempDir('walk-docs-filter-');
    fs.mkdirSync(path.join(base, 'docs', 'sub'), { recursive: true });
    fs.mkdirSync(path.join(base, 'notes'), { recursive: true });

    fs.writeFileSync(path.join(base, 'docs', 'keep.md'), 'Keep');
    fs.writeFileSync(path.join(base, 'docs', 'sub', 'skip.md'), 'Skip me');
    fs.writeFileSync(path.join(base, 'notes', 'readme.md'), 'Irrelevant');

    const files = walkDocs(base, {
      includePatterns: ['docs/**/*.md'],
      excludePatterns: ['**/skip.md']
    });
    const relative = files.map(f => path.relative(base, f)).sort();

    expect(relative).toEqual([path.join('docs', 'keep.md')]);
  });
});
