import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { chunkMarkdown, walkDocs, splitGlobPatterns } from '../chunker';

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

  it('does not split on # lines inside fenced code blocks', () => {
    const text = [
      '# Setup',
      '```bash',
      '# install dependencies',
      'pnpm install',
      '```',
      '~~~yaml',
      '# comment in yaml',
      'key: value',
      '~~~',
      '````markdown',
      '```bash',
      '# nested fence comment',
      '```',
      '````',
      '## Next Section',
      'Done'
    ].join('\n');

    const chunks = chunkMarkdown(text, 1000);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({
      text: [
        '# Setup',
        '```bash',
        '# install dependencies',
        'pnpm install',
        '```',
        '~~~yaml',
        '# comment in yaml',
        'key: value',
        '~~~',
        '````markdown',
        '```bash',
        '# nested fence comment',
        '```',
        '````'
      ].join('\n'),
      startLine: 1,
      endLine: 14
    });
    expect(chunks[1]).toEqual({
      text: '## Next Section\nDone',
      startLine: 15,
      endLine: 16
    });
  });
});

describe('splitGlobPatterns', () => {
  it('keeps commas inside brace expansions intact', () => {
    expect(splitGlobPatterns('**/*.{md,mdx,markdown}')).toEqual(['**/*.{md,mdx,markdown}']);
    expect(splitGlobPatterns(' docs/**/*.{md,mdx} , guide/*.markdown , ')).toEqual([
      'docs/**/*.{md,mdx}',
      'guide/*.markdown'
    ]);
    expect(splitGlobPatterns('a/{b,{c,d}}.md,e.md')).toEqual(['a/{b,{c,d}}.md', 'e.md']);
    expect(splitGlobPatterns('')).toEqual([]);
  });

  it('matches default include pattern cleanly in walkDocs', () => {
    const base = createTempDir('walk-docs-braces-');
    fs.mkdirSync(path.join(base, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(base, 'a.md'), '# A');
    fs.writeFileSync(path.join(base, 'nested', 'b.mdx'), '# B');
    fs.writeFileSync(path.join(base, 'nested', 'c.markdown'), '# C');

    const files = walkDocs(base, {
      includePatterns: splitGlobPatterns('**/*.{md,mdx,markdown}')
    });
    const relative = files.map(f => path.relative(base, f)).sort();

    expect(relative).toEqual(['a.md', path.join('nested', 'b.mdx'), path.join('nested', 'c.markdown')]);
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
