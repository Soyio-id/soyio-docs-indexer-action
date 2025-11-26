# Soyio Docs Indexer

GitHub Action to index documentation for semantic search with Pinecone. Run this in your docs repo (e.g., `soyio-id/soyio-docs`) so the bot action (`soyio-id/soyio-docs-bot-action@v1`) in your code repos can query fresh embeddings.

> [!NOTE]
> Companion bot: https://github.com/soyio-id/soyio-docs-bot-action — install it in your code repos to consume the embeddings this indexer publishes.

## Usage

### In GitHub Actions (Docs Repo)

```yaml
# .github/workflows/index-docs.yml
name: Index Documentation
on:
  push:
    branches: [main]

jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: soyio-id/soyio-docs-indexer-action@v1
        with:
          pinecone_api_key: ${{ secrets.PINECONE_API_KEY }}
          pinecone_index: 'soyio-docs'
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          docs_path: '.'
          include_patterns: 'docs/**/*.md,docs/**/*.mdx'
          exclude_patterns: '**/README.md,**/AGENTS.md'
```

### Local Testing

1. **Copy `.env.example` to `.env`**
   ```bash
   cp .env.example .env
   ```

2. **Fill in your credentials**
   ```bash
   # .env
   PINECONE_API_KEY=your-key-here
   PINECONE_INDEX=soyio-docs
   GEMINI_API_KEY=your-key-here
   DOCS_PATH=../soyio-docs
   INCLUDE_PATTERNS=docs/**/*.md,docs/**/*.mdx
   EXCLUDE_PATTERNS=**/README.md,**/AGENTS.md
   ```

3. **Build and run**
   ```bash
   pnpm install
   pnpm run build
   pnpm start
   ```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `pinecone_api_key` | Yes | - | Pinecone API key |
| `pinecone_index` | Yes | - | Pinecone index name |
| `gemini_api_key` | Yes | - | Google Gemini API key |
| `docs_path` | No | `.` | Path to documentation directory |
| `chunk_size` | No | `1300` | Maximum chunk size in characters |
| `include_patterns` | No | `**/*.{md,mdx,markdown}` | Glob patterns to include (comma-separated) |
| `exclude_patterns` | No | `` | Glob patterns to exclude (comma-separated) |

## Glob Patterns

Use glob patterns to control which files are indexed:

**Include examples:**
- `docs/**/*.md` - All .md files in docs/
- `guides/**/*.mdx` - All .mdx files in guides/
- `**/*.{md,mdx}` - All markdown files everywhere

**Exclude examples:**
- `**/README.md` - Exclude all README files
- `**/AGENTS.md` - Exclude AGENTS files
- `**/node_modules/**` - Exclude node_modules (already excluded by default)

## Outputs

| Output | Description |
|--------|-------------|
| `files_indexed` | Number of files indexed |
| `chunks_created` | Number of chunks created |
| `vectors_uploaded` | Number of vectors uploaded to Pinecone |

## How It Works

1. Walks documentation directory for markdown files
2. Filters files using include/exclude glob patterns
3. Chunks files by headers (~1300 chars per chunk)
4. Tracks line numbers for each chunk
5. Generates embeddings using Gemini `text-embedding-004`
6. Uploads vectors to Pinecone with metadata (file, lines, text preview)

## Development

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm run build

# Watch mode
pnpm run watch

# Run locally
pnpm start
```

## License

MIT
