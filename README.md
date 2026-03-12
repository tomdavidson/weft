# @zflow/zbuild

A template build tool that resolves Obsidian-style `![[transclusion]]` references and Mustache
`{{variables}}` into flat output files. Designed for composing structured documents from reusable
fragments with injectable context.

## Features

- **Transclusion resolution** using Obsidian `![[ref]]` syntax, including heading-section extraction
  (`![[file#Section]]`)
- **Mustache template rendering** with context from inline values, JSON files, and env files
- **Two-tier path resolution** that checks the containing directory first, then falls back to the
  working directory
- **Cycle detection** to prevent infinite loops in transclusion graphs
- **Extension-aware escaping** with identity pass-through for Markdown/text and JSON-safe escaping
  for `.json` output
- **Typed error handling** throughout using `neverthrow` Result types (no thrown exceptions)

## Installation

```bash
bun install
```

## Usage

```bash
bun run src/cli/index.ts <entry-file> -o <output-file> [options]
```

### Options

| Flag                    | Description                           |
| ----------------------- | ------------------------------------- |
| `-o`, `--output <path>` | Output file path (required)           |
| `-c <key=value>`        | Inline context variable (repeatable)  |
| `--json <path>`         | JSON file context source (repeatable) |
| `--env <path>`          | Env file context source (repeatable)  |
| `--cwd <path>`          | Working directory for path resolution |

### Examples

Simple transclusion build:

```bash
bun run src/cli/index.ts doc.template.md -o dist/doc.md
```

With inline context variables:

```bash
bun run src/cli/index.ts doc.template.md -o dist/doc.md -c title="My Document" -c author="Tom"
```

With a JSON context file and inline overrides:

```bash
bun run src/cli/index.ts doc.template.md -o dist/doc.md --json context.json -c version=2.0
```

With an env file:

```bash
bun run src/cli/index.ts config.template.json -o dist/config.json --env production.env
```

## How It Works

The build pipeline executes four stages in sequence:

1. **Resolve Context** reads and merges all context sources (inline values, JSON files, env files)
   left-to-right, with later sources overwriting earlier ones for the same key.

2. **Load File Graph** starts from the entry file, parses all `![[ref]]` transclusion references,
   resolves their paths, and reads every referenced file into an in-memory map.

3. **Resolve Transclusions** walks the file graph depth-first, replacing each `![[ref]]` with the
   referenced file's content (or a specific `#heading` section). Cycles are detected and reported as
   errors.

4. **Render Template** processes Mustache syntax (`{{var}}`, `{{{raw}}}`,
   `{{#section}}...{{/section}}`) against the merged context, with escaping appropriate to the
   output format.

## Transclusion Syntax

Transclusions use Obsidian's embed syntax, distinguished from regular wikilinks by the `!` prefix:

```markdown
![[filename]] # Embed entire file (extension auto-resolved: .md, .json, .txt) ![[filename.md]] #
Embed with explicit extension ![[filename#Heading]] # Embed only the content under a specific
heading ![[./relative/path]] # Explicit relative path (no CWD fallback) ![[sub/dir/file]] #
Subdirectory path with two-tier resolution
```

Regular wikilinks (`[[link]]` without `!`) are left untouched.

## Template Syntax

Templates use standard Mustache syntax:

```mustache
{{variable}}            # Variable with format-appropriate escaping
{{{raw}}}               # Raw variable, no escaping
{{#show}}...{{/show}}   # Conditional section (renders if truthy)
{{^hide}}...{{/hide}}   # Inverted section (renders if falsy/missing)
```

## Context Sources

Context is merged left-to-right from the sources specified on the command line. Later values
overwrite earlier ones for the same key.

**Inline** (`-c key=value`): Direct key-value pairs.

**JSON file** (`--json path.json`): All top-level keys become context variables.

```json
{
  "title": "My Document",
  "version": "1.0"
}
```

**Env file** (`--env path.env`): Standard `KEY=value` format, one per line. Lines starting with `#`
and blank lines are skipped.

```env
# Database config
DB_HOST=localhost
DB_PORT=5432
```

## Architecture

zbuild follows a Hexagonal Architecture (Ports and Adapters) pattern:

```
src/
├── domain/            Pure functions, no I/O
│   ├── types.ts         Shared types (FilePath, ZBuildError, etc.)
│   ├── parse-transclusion.ts   Parse ![[ref]] syntax and extract sections
│   ├── template.ts      Template file detection and output path derivation
│   ├── resolve-path.ts  Two-tier path resolution with extension probing
│   ├── context.ts       Context source classification and merging
│   ├── render.ts        Mustache rendering with extension-aware escaping
│   └── resolve.ts       Recursive transclusion resolution with cycle detection
├── application/       Use cases with port dependencies
│   ├── ports.ts         FileSystem interface (the primary port)
│   ├── load-graph.ts    Async file graph loader
│   ├── resolve-context.ts  Async context resolver (reads files via port)
│   └── build.ts         Pipeline orchestrator
├── infrastructure/    Real adapter implementations
│   └── node-fs.ts       Node.js/Bun filesystem adapter
├── cli/               Entry point
│   ├── parse-args.ts    Argument parser
│   └── index.ts         CLI main
└── test/              Test infrastructure
    ├── helpers.ts       expectOk/expectErr test utilities
    └── fake-filesystem.ts  In-memory FileSystem for unit tests
```

Key design decisions:

- **Domain layer** is pure and synchronous (except `resolve.ts` which is sync over an in-memory
  map). No I/O, no framework dependencies.
- **Application layer** depends only on the `FileSystem` port interface, making it testable with the
  in-memory fake.
- **All errors** are typed via the `ZBuildError` discriminated union and propagated through
  `neverthrow` `Result` types. Nothing is thrown.
- **The `FileSystem` port** is the single boundary between the application and the outside world.

## Testing

Run the full test suite:

```bash
bun test
```

The suite includes 147 tests across 13 files:

- **Domain unit tests** use pure function calls with no mocks
- **Application unit tests** use the in-memory `FakeFileSystem`
- **Infrastructure tests** use real temp directories
- **Integration tests** run the full `build` pipeline against real files

Type checking:

```bash
bun run check
```

## Supported File Types

| Extension | Template Escaping                        | Transclusion |
| --------- | ---------------------------------------- | ------------ |
| `.md`     | Identity (no escaping)                   | Yes          |
| `.txt`    | Identity (no escaping)                   | Yes          |
| `.json`   | JSON-safe (`\\`, `\"`, `\n`, `\r`, `\t`) | Yes          |

## Error Handling

All errors are reported with specific types and context:

| Error Type            | Description                                |
| --------------------- | ------------------------------------------ |
| `FileNotFound`        | Referenced file does not exist             |
| `FileReadError`       | I/O error reading a file                   |
| `CycleDetected`       | Circular transclusion reference chain      |
| `ContextParseError`   | Invalid JSON or malformed context file     |
| `TemplateRenderError` | Mustache rendering failure                 |
| `InvalidArgs`         | Missing or malformed CLI arguments         |
| `SectionNotFound`     | Heading not found for section transclusion |
| `OutputWriteError`    | I/O error writing the output file          |
