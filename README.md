# @zflow/weft

A template build tool that resolves Obsidian-style `![[transclusion]]` references and Mustache
`{{variables}}` into flat output files. Designed for composing structured documents from reusable
fragments with injectable context.

## Why Weft

Documentation and prompts share the same problem: they're assembled from reusable pieces with
variable context injected at build time. Weft treats both as the same pipeline.

For documentation, compose a full document from section fragments and inject dynamic content like
generated tables of contents or version strings:

```bash
weft index.template.md index.md -c "toc=$(adrs generate toc)"
```

For prompt engineering, build complex system prompts from a library of reusable instruction
fragments using transclusion. A prompt template can pull in shared persona definitions, tool
schemas, and domain rules without copy-pasting:

```markdown
# System Prompt
![[persona/senior-architect]]

## Project Context
![[rules/typescript-patterns]]
![[rules/testing-patterns]]

## Task
{{task_description}}

## Constraints
![[constraints/token-budget]]
![[constraints/output-format]]
```

```bash
weft system-prompt.template.md -c task_description="Review the auth module for security issues"
```

Weft keeps source fragments single-purpose and composable. Changes to a shared fragment propagate
everywhere it's referenced. Context injection means the same template structure works across
projects, environments, and tasks.

## Features

- Transclusion resolution using Obsidian `![[ref]]` syntax, including heading-section extraction
  (`![[file#Section]]`)
- Mustache template rendering with context from inline values, JSON files, and env files
- Two-tier path resolution that checks the containing directory first, then falls back to the
  working directory
- Cycle detection to prevent infinite loops in transclusion graphs
- Extension-aware escaping with identity pass-through for Markdown/text and JSON-safe escaping
  for `.json` output
- Typed error handling throughout using `neverthrow` Result types (no thrown exceptions)
- Output to file or stdout

## Installation

```bash
bun install
```

## Usage

```bash
weft <entry-file> [output-file] [options]
```

When no output file is given, rendered content is written to stdout.

### Options

| Flag | Description |
| --- | --- |
| `-c <key=value>` | Inline context variable (repeatable) |
| `--json <path>` | JSON file context source (repeatable) |
| `--env <path>` | Env file context source (repeatable) |
| `--cwd <path>` | Working directory for path resolution |

### Examples

Simple transclusion build:

```bash
weft doc.template.md dist/doc.md
```

With inline context variables:

```bash
weft doc.template.md dist/doc.md -c title="My Document" -c author="Tom"
```

With a JSON context file and inline overrides:

```bash
weft doc.template.md dist/doc.md --json context.json -c version=2.0
```

With an env file:

```bash
weft config.template.json dist/config.json --env production.env
```

Render to stdout (pipe to another tool):

```bash
weft prompt.template.md -c model=claude | pbcopy
```

Render to stdout for inspection:

```bash
weft doc.template.md -c title="Draft"
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

The build function returns the rendered content string. The CLI layer handles writing to a file or
stdout.

## Transclusion Syntax

Transclusions use Obsidian's embed syntax, distinguished from regular wikilinks by the `!` prefix:

```markdown
![[filename]]           # Embed entire file (extension auto-resolved: .md, .json, .txt)
![[filename.md]]        # Embed with explicit extension
![[filename#Heading]]   # Embed only the content under a specific heading
![[./relative/path]]    # Explicit relative path (no CWD fallback)
![[sub/dir/file]]       # Subdirectory path with two-tier resolution
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

Weft follows a functional core / imperative shell architecture:

```
src/
├── domain/            Pure functions, no I/O
│   ├── types.ts         Shared types (FilePath, WeftError, etc.)
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
│   └── build.ts         Pipeline orchestrator (returns rendered string)
├── infrastructure/    Real adapter implementations
│   └── node-fs.ts       Node.js/Bun filesystem adapter
├── cli/               Entry point and I/O boundary
│   ├── parse-args.ts    Argument parser
│   └── index.ts         CLI main (file write, stdout, exit codes)
└── test/              Test infrastructure
    ├── helpers.ts       expectOk/expectErr test utilities
    └── fake-filesystem.ts  In-memory FileSystem for unit tests
```

- **Domain layer** is pure and synchronous. No I/O, no framework dependencies.
- **Application layer** depends only on the `FileSystem` port interface, returns content strings,
  and performs no side effects. Testable with the in-memory fake.
- **CLI layer** owns all I/O: argument parsing, file writes, stdout, and exit codes.
- **All errors** are typed via the `WeftError` discriminated union and propagated through
  `neverthrow` `Result` types. Nothing is thrown.

## Testing

```bash
bun test
```

- Domain unit tests use pure function calls with no mocks
- Application unit tests use the in-memory `FakeFileSystem`
- Integration tests run the full `build` pipeline against real files
- CLI integration tests spawn the actual CLI process against temp directories

Type checking:

```bash
bun run check
```

## Supported File Types

| Extension | Template Escaping | Transclusion |
| --- | --- | --- |
| `.md` | Identity (no escaping) | Yes |
| `.txt` | Identity (no escaping) | Yes |
| `.json` | JSON-safe (`\\`, `\"`, `\n`, `\r`, `\t`) | Yes |

## Error Handling

All errors are reported with specific types and context:

| Error Type | Description |
| --- | --- |
| `FileNotFound` | Referenced file does not exist |
| `FileReadError` | I/O error reading a file |
| `CycleDetected` | Circular transclusion reference chain |
| `ContextParseError` | Invalid JSON or malformed context file |
| `TemplateRenderError` | Mustache rendering failure |
| `InvalidArgs` | Missing or malformed CLI arguments |
| `SectionNotFound` | Heading not found for section transclusion |
| `OutputWriteError` | I/O error writing the output file |
