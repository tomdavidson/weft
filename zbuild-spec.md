<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

## Where Models Agree

| Finding                                                                             | Claude Opus 4.6 Thinking | Gemini 3.1 Pro Thinking | Kimi K2.5 Thinking | Evidence                                                                 |
| :---------------------------------------------------------------------------------- | :----------------------- | :---------------------- | :----------------- | :----------------------------------------------------------------------- |
| Three-layer folder structure: domain → application → infrastructure                 | ✓                        | ✓                       | ✓                  | All produce matching layer breakdown with identical dependency rules[^1] |
| BFS graph pre-loader in application layer producing `Map<string, string>`           | ✓                        | ✓                       | ✓                  | Identical queue-based algorithm with visited Set[^2]                     |
| DFS visited + stack Set for dedup and cycle detection in domain                     | ✓                        | ✓                       | ✓                  | Two Sets: `visited` (global dedup), `stack` (ancestor cycle check)       |
| `neverthrow` + `mustache` as only runtime deps                                      | ✓                        | ✓                       | ✓                  | Minimal BOM, zero CLI parsing deps                                       |
| FakeFileSystem with Map + contract test suite                                       | ✓                        | ✓                       | ✓                  | Shared contract validates fake matches real[^3][^4]                      |
| `util.parseArgs` for CLI, no external arg parsing lib                               | ✓                        | ✓                       | ✓                  | Zero-dep approach using Node/Bun builtin                                 |
| Test-first task ordering: domain pure functions → application use cases → infra/CLI | ✓                        | ✓                       | ✓                  | Inside-out implementation strategy                                       |

## Where Models Disagree

| Topic                             | Claude Opus 4.6 Thinking                                                                           | Gemini 3.1 Pro Thinking                          | Kimi K2.5 Thinking                                                      | Why They Differ                                                                            |
| :-------------------------------- | :------------------------------------------------------------------------------------------------- | :----------------------------------------------- | :---------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| Task count                        | 14 tasks (most granular)                                                                           | 12 tasks                                         | ~11 tasks (cut short)                                                   | Claude splits domain functions into individual tasks; Gemini/Kimi bundle more per task     |
| Escape function selection         | Extension-based: `md`/`txt`→identity, `json`→jsonEscape                                            | Single jsonEscape for all                        | Single jsonEscape for all                                               | Claude implements your decision precisely; Gemini/Kimi default to json escaping everywhere |
| Section transclusion (`#heading`) | Full spec with heading-level extraction                                                            | Not detailed                                     | Regex captures it but no assembly logic                                 | Claude specs the extraction algorithm; others defer                                        |
| Context classification            | Discriminated union with 3 variants (inline, jsonFile, envFile)                                    | 2 variants (inline, file)                        | 2 variants (inline, file) with extension-based sub-dispatch             | Claude separates file types at classification; others dispatch later during resolution     |
| Spec document completeness        | ~3000 words, full types, folder structure, every function signature, all 14 tasks with precise DoD | ~1500 words, good structure but less type detail | ~1500 words, good BOM table, architecture overview, truncated task list | Scope and detail level                                                                     |
| Directory mode                    | Full spec with `deriveOutputPath`, fail-fast on error                                              | Separate task for dir-mode path derivation       | Mentioned as "Future/Optional"                                          | Different prioritization of single-file vs batch mode                                      |

## Unique Discoveries

| Model                    | Unique Finding                                                      | Why It Matters                                           |
| :----------------------- | :------------------------------------------------------------------ | :------------------------------------------------------- |
| Claude Opus 4.6 Thinking | Task 14: E2E smoke test via `Bun.spawn` executing the actual binary | Validates the full wired system, not just units          |
| Claude Opus 4.6 Thinking | `shebang` + `package.json` `bin` field for CLI installation         | Makes `zbuild` installable as a proper CLI tool          |
| Gemini 3.1 Pro Thinking  | Separate "Path Resolution" as its own task (Task 4)                 | Isolates the two-tier fallback logic for focused testing |

## Comprehensive Analysis

All three models converged on the same fundamental architecture, which directly reflects your
attached clean architecture and clean code documents. The three-layer structure with pure domain,
orchestrating application layer, and IO-only infrastructure is unanimous. The BFS pre-loader and DFS
resolver pattern is identical across all three, confirming this is the right approach for
correctness over performance as you specified.[^5][^1]

The most significant practical difference is **spec completeness**. Claude Opus 4.6 Thinking
produced a substantially more detailed specification—full type definitions for every domain type,
explicit function signatures for every pure function, a complete folder structure with filenames,
and 14 tasks each with precise definitions of done including specific test assertions. Gemini 3.1
Pro Thinking and Kimi K2.5 Thinking produced solid architectural overviews but with less
implementation-ready detail. Since your requirement is a spec doc that "provides all the context and
info needed for zbuild to be built," Claude's output is the most complete.

On **escape function selection**, Claude Opus 4.6 Thinking is the only model that correctly
implemented your decision to use identity escape for markdown/text and json escape for JSON output,
selected by output file extension. Gemini 3.1 Pro Thinking and Kimi K2.5 Thinking both default to
json escaping for everything, which would unnecessarily escape backslashes and quotes in markdown
output. Claude's extension-based dispatch (`selectEscapeFunction(extension)`) is the correct
implementation of your stated requirement.[^5]

On **deduplication/cycle detection complexity**, you expressed uncertainty about whether it was
worth the effort. All three models include it, and looking at their implementations, it's literally
two `Set` objects and a handful of `add`/`delete`/`has` calls per recursion frame. Claude Opus 4.6
Thinking's spec makes this concrete: `visited` Set for global dedup (never removed from), `stack`
Set for ancestry cycle detection (removed on recursion unwind). This is ~5 lines of additional code
in the resolver. The risk of _not_ having it—infinite recursion on cycles, or ballooning output from
diamond-shaped dependency graphs in your prompt architecture—far outweighs the trivial
implementation cost. Ship it in v1.[^2]

For the **directory mode** question, Claude includes it as a first-class feature with its own task
(Task 10) and the `deriveOutputPath` utility (Task 3), while Kimi K2.5 Thinking marks it as
"Future/Optional." Given that you explicitly listed "Directory mode support: First-class with
deriveOutputPath" in your decisions, Claude's inclusion is correct.

**Recommendation**: Use Claude Opus 4.6 Thinking's specification as your zbuild-spec.md. It is the
most complete, correctly implements all your stated decisions (especially the escape function
selection and directory mode), provides implementation-ready type definitions and function
signatures, and has the most granular task breakdown (14 tasks) with precise definitions of done.
The only addition worth borrowing from Gemini is making path resolution its own explicit domain
function with dedicated tests (Gemini's Task 4), which Claude bundles into the resolver. I'd suggest
splitting Claude's Task 6 (resolve.ts) to extract path resolution as a separate tested function,
giving you 15 focused tasks.

---

Below is the consolidated specification document, incorporating all agreed decisions and using
Claude Opus 4.6 Thinking's spec as the base with targeted improvements.

---

# zbuild Specification v1.0

## 1. Overview

zbuild is a file assembly CLI tool that composes text files using Obsidian-style wikilink
transclusion (`![[filename]]`) and Mustache template variable interpolation (`{{variable}}`). It
processes markdown, JSON, and plain text inputs. zbuild is a **general-purpose tool**—it has no
knowledge of prompt architectures, layer contracts, or any specific project structure.

## 2. Bill of Materials

### Runtime Dependencies

| Package      | Version | Purpose                                             |
| :----------- | :------ | :-------------------------------------------------- |
| `neverthrow` | ^8.0    | `Result<T, E>` / `ResultAsync` for errors-as-values |
| `mustache`   | ^4.2    | Logic-less Mustache template rendering              |

### Dev Dependencies

| Package           | Version | Purpose                      |
| :---------------- | :------ | :--------------------------- |
| `bun-types`       | latest  | Bun runtime type definitions |
| `@types/mustache` | ^4.2    | Mustache type definitions    |
| `typescript`      | ^5.5    | Type checking                |
| `fast-check`      | ^3.0    | Property-based testing       |

### Runtime

**Bun** (primary target). Code must also run under Node 22+ via `npx tsx`.

### Built-in APIs (Zero External Deps)

| API                     | Usage                                       |
| :---------------------- | :------------------------------------------ |
| `node:util` `parseArgs` | CLI argument parsing                        |
| `node:path`             | Path resolution, dirname, resolve           |
| `node:fs/promises`      | Filesystem operations (infrastructure only) |

## 3. CLI Interface

```
zbuild <input> <output> [--context <value>]...
```

### Positional Arguments

| Position | Name     | Description                                             |
| :------- | :------- | :------------------------------------------------------ |
| 1        | `input`  | Path to `*.template.{md,json,txt}` file, or a directory |
| 2        | `output` | Path to output file, or output directory                |

### Options

| Flag        | Short | Type                | Description                                                                        |
| :---------- | :---- | :------------------ | :--------------------------------------------------------------------------------- |
| `--context` | `-c`  | string (repeatable) | Context data for Mustache. Inline `key=value`, `.json` file, or `.txt`/`.env` file |
| `--help`    | `-h`  | boolean             | Print usage, exit 0                                                                |
| `--version` | `-v`  | boolean             | Print version, exit 0                                                              |

### Context Resolution Rules

1. **Inline key=value**: `--context "toc=some value"` — split on **first** `=` only
2. **JSON file**: `--context ./data.json` — detected by `.json` extension, parsed as JSON object
3. **Env/txt file**: `--context ./data.env` — detected by `.txt` or `.env` extension, parsed as
   `key=value\n` lines (blank lines and `#` comments skipped)

Multiple `--context` flags merge left-to-right. Later values overwrite earlier for same key.

### Directory Mode

When input is a directory, zbuild discovers all `*.template.{ext}` files and processes each. Output
paths mirror input structure with `.template` stripped:

```
zbuild templates/ dist/
# templates/index.template.md → dist/index.md
# templates/sub/page.template.md → dist/sub/page.md
```

### Template Naming Convention

Template files must match `*.template.{md,json,txt}`. Output drops the `.template` segment.

## 4. Processing Pipeline

For each template file, two phases execute in strict order:

1. **Transclusion Resolution**: Recursively resolve all `![[ref]]` tags by inlining referenced file
   content. Runs to completion before phase 2.
2. **Mustache Rendering**: Render `{{variable}}` tags using merged context object.

Context values injected via Mustache **cannot** trigger transclusion. This is intentional.

## 5. Transclusion Specification

### Syntax

```
![[filename]]              Full file embed (extensionless)
![[filename.md]]           Full file embed (with extension)
![[filename#heading]]      Section embed (heading to next same-level heading)
![[../path/to/file]]       Explicit relative path
```

Non-transclusion wikilinks (`[[filename]]` without `!`) are left untouched.

### Path Resolution (Two-Tier Fallback)

When resolving `![[some-file]]` found inside `/project/prompts/molecules/gtd.md`:

1. **Relative to containing file**: `/project/prompts/molecules/` — searches for `some-file.md`,
   `some-file.json`, `some-file.txt`
2. **Relative to CWD**: `process.cwd()` — same extension search

First match wins. The **containing directory shifts during recursion**: when `molecules/gtd.md`
transcludes `![[context-passing]]` and resolution finds `atoms/context-passing.md`, any refs inside
_that_ file resolve relative to `atoms/`.

For explicit relative paths (`![[../atoms/context-passing]]`), resolve relative to containing file
only. No CWD fallback.

### Deduplication and Cycle Detection

Two `Set<string>` objects track state during resolution:

- **`visited`** (global): All files that have been inlined. If a file is already in `visited`,
  replace its `![[ref]]` with empty string (dedup).
- **`stack`** (ancestor chain): Files in the current recursion path. If a file appears in `stack`,
  this is a cycle → return `CycleDetected` error with the chain.

When entering a file: add to both `visited` and `stack`. When leaving a file: remove from `stack`,
keep in `visited`.

### Section Transclusion

`![[file#heading]]` extracts content from the first heading matching `heading` (case-insensitive,
ignoring `#` markers) through to the next heading of same or higher level, or EOF.

## 6. Mustache Rendering Specification

### Escape Function Selection

Selected by **output file extension**:

```typescript
const identityEscape = (text: string): string => text

const jsonEscape = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')

const selectEscapeFunction = (ext: SupportedExtension): (text: string) => string => {
  const lookup: Record<SupportedExtension, (text: string) => string> = {
    md: identityEscape,
    txt: identityEscape,
    json: jsonEscape,
  }
  return lookup[ext]
}
```

- `.md` / `.txt` → identity (pass-through)
- `.json` → jsonEscape (backslash, quotes, newlines, tabs)
- `{{{triple-stache}}}` always bypasses escape function

### Template Variables

Standard Mustache syntax: `{{var}}`, `{{{raw}}}`, `{{#section}}...{{/section}}`,
`{{^inverted}}...{{/inverted}}`.

## 7. Architecture

### Layer Structure

```
┌─────────────────────────────────────────┐
│           Infrastructure                │  CLI, filesystem, process
│  ┌───────────────────────────────────┐  │
│  │          Application              │  │  Use cases, orchestration
│  │  ┌─────────────────────────────┐  │  │
│  │  │          Domain             │  │  │  Pure functions, types
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

Dependencies point inward. Domain imports nothing external.

### Domain Layer (Pure, Zero IO)

**Types** (`src/domain/types.ts`):

```typescript
type FilePath = string & { readonly __brand: unique symbol }
type SupportedExtension = 'md' | 'json' | 'txt'
const SUPPORTED_EXTENSIONS: readonly SupportedExtension[] = ['md', 'json', 'txt'] as const

type TransclusionRef = { readonly raw: string; readonly target: string; readonly section?: string }

type ContextSource = { readonly type: 'inline'; readonly key: string; readonly value: string } | {
  readonly type: 'jsonFile'
  readonly path: FilePath
} | { readonly type: 'envFile'; readonly path: FilePath }

type ZBuildError =
  | { readonly type: 'FileNotFound'; readonly path: string }
  | { readonly type: 'FileReadError'; readonly path: string; readonly cause: string }
  | { readonly type: 'CycleDetected'; readonly chain: readonly string[] }
  | { readonly type: 'ContextParseError'; readonly source: string; readonly cause: string }
  | { readonly type: 'TemplateRenderError'; readonly path: string; readonly cause: string }
  | { readonly type: 'InvalidArgs'; readonly message: string }
  | { readonly type: 'SectionNotFound'; readonly file: string; readonly heading: string }
  | { readonly type: 'OutputWriteError'; readonly path: string; readonly cause: string }
```

**Pure Functions**:

| Function                | File                    | Signature                                                                                                                           |
| :---------------------- | :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `parseTransclusionRefs` | `parse-transclusion.ts` | `(content: string) => TransclusionRef[]`                                                                                            |
| `extractSection`        | `parse-transclusion.ts` | `(content: string, heading: string) => Result<string, ZBuildError>`                                                                 |
| `resolveRefPath`        | `resolve-path.ts`       | `(ref: TransclusionRef, containingDir: string, cwd: string, fileExists: (p: string) => boolean) => Result<string, ZBuildError>`     |
| `classifyContextSource` | `context.ts`            | `(raw: string) => ContextSource`                                                                                                    |
| `mergeContexts`         | `context.ts`            | `(sources: ContextSource[], resolved: Map<string, Record<string, string>>) => Record<string, string>`                               |
| `isTemplateFile`        | `template.ts`           | `(filename: string) => boolean`                                                                                                     |
| `deriveOutputPath`      | `template.ts`           | `(templatePath: string, inputBase: string, outputBase: string) => string`                                                           |
| `getOutputExtension`    | `template.ts`           | `(filename: string) => SupportedExtension \| undefined`                                                                             |
| `selectEscapeFunction`  | `render.ts`             | `(ext: SupportedExtension) => (text: string) => string`                                                                             |
| `renderTemplate`        | `render.ts`             | `(content: string, context: Record<string, string>, ext: SupportedExtension) => Result<string, ZBuildError>`                        |
| `resolveTransclusions`  | `resolve.ts`            | `(filename: string, fileMap: ReadonlyMap<string, string>, visited: Set<string>, stack: Set<string>) => Result<string, ZBuildError>` |

### Application Layer (Orchestration)

**Port** (`src/application/ports.ts`):

```typescript
type FileSystem = {
  readFile: (path: string) => Promise<Result<string, ZBuildError>>
  writeFile: (path: string, content: string) => Promise<Result<void, ZBuildError>>
  listFiles: (directory: string, pattern: RegExp) => Promise<Result<string[], ZBuildError>>
  exists: (path: string) => Promise<boolean>
  resolve: (...segments: string[]) => string
  dirname: (path: string) => string
}
```

**Use Cases**:

| Use Case         | File                 | Purpose                                     |
| :--------------- | :------------------- | :------------------------------------------ |
| `loadFileGraph`  | `load-graph.ts`      | BFS pre-loader → `Map<string, string>`      |
| `resolveContext` | `resolve-context.ts` | Read file-based contexts, merge all sources |
| `buildFile`      | `build-file.ts`      | Full pipeline for one file                  |
| `buildDirectory` | `build-directory.ts` | Discover templates, delegate to `buildFile` |

### Infrastructure Layer

| Component        | File                 | Purpose                                        |
| :--------------- | :------------------- | :--------------------------------------------- |
| `NodeFileSystem` | `node-filesystem.ts` | Real FS adapter via `Bun.file()`/`Bun.write()` |
| CLI parser       | `cli.ts`             | `util.parseArgs`, error formatting, help text  |
| Composition root | `main.ts`            | Wires deps, invokes CLI, handles exit codes    |

### Folder Structure

```
zbuild/
├── src/
│   ├── domain/
│   │   ├── types.ts
│   │   ├── parse-transclusion.ts
│   │   ├── parse-transclusion.spec.ts
│   │   ├── resolve-path.ts
│   │   ├── resolve-path.spec.ts
│   │   ├── context.ts
│   │   ├── context.spec.ts
│   │   ├── template.ts
│   │   ├── template.spec.ts
│   │   ├── resolve.ts
│   │   ├── resolve.spec.ts
│   │   ├── render.ts
│   │   └── render.spec.ts
│   ├── application/
│   │   ├── ports.ts
│   │   ├── load-graph.ts
│   │   ├── load-graph.spec.ts
│   │   ├── resolve-context.ts
│   │   ├── resolve-context.spec.ts
│   │   ├── build-file.ts
│   │   ├── build-file.spec.ts
│   │   ├── build-directory.ts
│   │   └── build-directory.spec.ts
│   ├── infrastructure/
│   │   ├── node-filesystem.ts
│   │   ├── node-filesystem.integration.spec.ts
│   │   ├── cli.ts
│   │   └── cli.spec.ts
│   ├── main.ts
│   └── test/
│       ├── helpers.ts
│       ├── helpers.spec.ts
│       ├── builders.ts
│       ├── fake-filesystem.ts
│       ├── fake-filesystem.spec.ts
│       └── filesystem-contract.ts
├── package.json
├── tsconfig.json
└── zbuild-spec.md
```

## 8. Test Infrastructure

### Helpers (`src/test/helpers.ts`)

```typescript
export const expectOk = <T, E>(result: Result<T, E>): T => {
  expect(result.isOk()).toBe(true)
  return result._unsafeUnwrap()
}

export const expectErr = <T, E>(result: Result<T, E>): E => {
  expect(result.isErr()).toBe(true)
  return result._unsafeUnwrapErr()
}
```

### FakeFileSystem (`src/test/fake-filesystem.ts`)

Map-backed in-memory implementation of `FileSystem` port. Exposes `written: Map<string, string>` for
output assertion. Shares contract test suite with `NodeFileSystem`.

### Builders (`src/test/builders.ts`)

Minimal valid defaults for domain types. Override only what the test cares about.

## 9. Implementation Plan

**Execution protocol for every task:**

1. Read `zbuild-spec.md` (this document) at the start of the task for full context.
2. Write unit tests first that accurately reflect the definition of done.
3. Write application code to pass those tests.
4. Run tests via `cd $(git rev-parse --show-toplevel)/zbuild && bun test src/<filename>.spec.ts`
5. Evaluate if the full definition of done is satisfied. If yes, mark done. If not, repeat from
   step 3.

---

### Task 1: Project Scaffold and Test Infrastructure

**Files**: `package.json`, `tsconfig.json`, `src/domain/types.ts`, `src/application/ports.ts`,
`src/test/helpers.ts`, `src/test/helpers.spec.ts`, `src/test/builders.ts`,
`src/test/fake-filesystem.ts`

**Definition of Done**:

- [ ] `bun install` succeeds with neverthrow, mustache, bun-types, typescript, fast-check,
      @types/mustache
- [ ] `types.ts` exports: `FilePath`, `SupportedExtension`, `SUPPORTED_EXTENSIONS`,
      `TransclusionRef`, `ContextSource`, `ZBuildError`
- [ ] `ports.ts` exports the `FileSystem` port interface
- [ ] `helpers.spec.ts` passes: `expectOk` returns value on Ok, `expectErr` returns error on Err,
      both throw on wrong rail
- [ ] `fake-filesystem.ts` compiles and exports `createFakeFileSystem`
- [ ] `builders.ts` exports builders for `TransclusionRef`, `ContextSource`

**Test**: `cd $(git rev-parse --show-toplevel)/zbuild && bun test src/test/helpers.spec.ts`

---

### Task 2: Transclusion Parsing

**Files**: `src/domain/parse-transclusion.ts`, `src/domain/parse-transclusion.spec.ts`

**Definition of Done**:

- [ ] `parseTransclusionRefs("Hello ![[file]] world")` →
      `[{ raw: "![[file]]", target: "file", section: undefined }]`
- [ ] `parseTransclusionRefs("![[file#heading]]")` →
      `[{ raw: "![[file#heading]]", target: "file", section: "heading" }]`
- [ ] `parseTransclusionRefs("![[file.md]]")` → `[{ raw: "![[file.md]]", target: "file.md" }]`
- [ ] `parseTransclusionRefs("no refs")` → `[]`
- [ ] `parseTransclusionRefs("[[not-transclusion]]")` → `[]`
- [ ] Multiple refs extracted in order
- [ ] `extractSection` extracts heading to next same-or-higher-level heading
- [ ] `extractSection` returns `SectionNotFound` for missing heading
- [ ] `extractSection` is case-insensitive on heading text

**Test**:
`cd $(git rev-parse --show-toplevel)/zbuild && bun test src/domain/parse-transclusion.spec.ts`

---

### Task 3: Template File Utilities

**Files**: `src/domain/template.ts`, `src/domain/template.spec.ts`

**Definition of Done**:

- [ ] `isTemplateFile("index.template.md")` → `true`
- [ ] `isTemplateFile("index.md")` → `false`
- [ ] `isTemplateFile("data.template.json")` → `true`
- [ ] `isTemplateFile("data.template.html")` → `false`
- [ ] `deriveOutputPath("templates/index.template.md", "templates", "dist")` → `"dist/index.md"`
- [ ] `deriveOutputPath("templates/sub/page.template.md", "templates", "dist")` →
      `"dist/sub/page.md"`
- [ ] `getOutputExtension("index.template.md")` → `"md"`
- [ ] `getOutputExtension("data.template.json")` → `"json"`
- [ ] `getOutputExtension("index.md")` → `undefined`

**Test**: `cd $(git rev-parse --show-toplevel)/zbuild && bun test src/domain/template.spec.ts`

---

### Task 4: Path Resolution

**Files**: `src/domain/resolve-path.ts`, `src/domain/resolve-path.spec.ts`

**Definition of Done**:

- [ ] Bare ref `some-file` resolved relative to containing dir, tries `.md`, `.json`, `.txt`
      extensions
- [ ] Ref with extension `some-file.md` resolved relative to containing dir, no extension search
- [ ] Explicit relative path `../atoms/context-passing` resolved relative to containing dir only (no
      CWD fallback)
- [ ] CWD fallback used when containing-dir resolution fails for bare ref
- [ ] Returns `FileNotFound` when no match in either tier
- [ ] `fileExists` predicate passed in (pure function, no IO)

**Test**: `cd $(git rev-parse --show-toplevel)/zbuild && bun test src/domain/resolve-path.spec.ts`

---

### Task 5: Context Classification and Merging

**Files**: `src/domain/context.ts`, `src/domain/context.spec.ts`

**Definition of Done**:

- [ ] `classifyContextSource("key=value")` → `{ type: 'inline', key: 'key', value: 'value' }`
- [ ] `classifyContextSource("key=val=ue")` → splits on first `=`:
      `{ type: 'inline', key: 'key', value: 'val=ue' }`
- [ ] `classifyContextSource("./data.json")` → `{ type: 'jsonFile', path: './data.json' }`
- [ ] `classifyContextSource("config.env")` → `{ type: 'envFile', path: 'config.env' }`
- [ ] `classifyContextSource("data.txt")` → `{ type: 'envFile', path: 'data.txt' }`
- [ ] `mergeContexts` merges left-to-right, later overwrites earlier
- [ ] `mergeContexts` with empty list returns `{}`

**Test**: `cd $(git rev-parse --show-toplevel)/zbuild && bun test src/domain/context.spec.ts`

---

### Task 6: Mustache Rendering and Escape Functions

**Files**: `src/domain/render.ts`, `src/domain/render.spec.ts`

**Definition of Done**:

- [ ] `selectEscapeFunction("md")` returns identity (input === output)
- [ ] `selectEscapeFunction("txt")` returns identity
- [ ] `selectEscapeFunction("json")` escapes `\`, `"`, `\n`, `\r`, `\t`
- [ ] `renderTemplate("Hello {{name}}", { name: "World" }, "md")` → `Ok("Hello World")`
- [ ] `renderTemplate("{{name}}", { name: '<script>' }, "md")` → raw unescaped string
- [ ] `renderTemplate('{"k": "{{v}}"}', { v: 'line1\nline2' }, "json")` →
      `Ok('{"k": "line1\\nline2"}')`
- [ ] `renderTemplate("{{{raw}}}", { raw: "anything" }, "json")` → raw unescaped
- [ ] `renderTemplate("{{missing}}", {}, "md")` → `Ok("")`
- [ ] Section blocks work: `{{#show}}visible{{/show}}` with `{ show: "yes" }`

**Test**: `cd $(git rev-parse --show-toplevel)/zbuild && bun test src/domain/render.spec.ts`

---

### Task 7: Transclusion Resolution (Pure Domain)

**Files**: `src/domain/resolve.ts`, `src/domain/resolve.spec.ts`

**Definition of Done**:

- [ ] Single-level: root has `![[child]]`, child in map, returns assembled content
- [ ] Nested: root→child→grandchild, all resolved depth-first
- [ ] Deduplication: same file referenced twice, inlined only at first encounter
- [ ] Cycle detection: A→B→A returns `CycleDetected` with chain `[A, B, A]`
- [ ] Self-reference: A→A returns `CycleDetected`
- [ ] Missing file in map returns `FileNotFound`
- [ ] Regular text preserved around transclusion refs
- [ ] Section transclusion `![[file#heading]]` inlines extracted section
- [ ] Non-transclusion `[[file]]` links not modified
- [ ] Uses `resolveRefPath` from Task 4 for path resolution

**Test**: `cd $(git rev-parse --show-toplevel)/zbuild && bun test src/domain/resolve.spec.ts`

---

### Task 8: File Graph Loader (Application)

**Files**: `src/application/load-graph.ts`, `src/application/load-graph.spec.ts`

**Definition of Done**:

- [ ] Single file, no transclusions → map with one entry
- [ ] File with `![[child]]` → discovers and loads both
- [ ] Chain root→child→grandchild → loads all three
- [ ] Diamond (root→A, root→B, A→C, B→C) → loads four unique files
- [ ] Cycle (A→B→A) → loads both files without infinite loop (cycle detected later by domain)
- [ ] Missing file returns `FileNotFound`
- [ ] Path resolution uses two-tier fallback (containing dir, then CWD)
- [ ] All tests use `FakeFileSystem`

**Test**:
`cd $(git rev-parse --show-toplevel)/zbuild && bun test src/application/load-graph.spec.ts`

---

### Task 9: Context Resolution (Application)

**Files**: `src/application/resolve-context.ts`, `src/application/resolve-context.spec.ts`

**Definition of Done**:

- [ ] Inline source `{ type: 'inline', key: 'k', value: 'v' }` → `{ k: 'v' }`
- [ ] JSON file source: reads file, parses JSON, merges top-level keys
- [ ] Env file source: reads file, parses `key=value\n` lines
- [ ] Multiple sources merged left-to-right with overwrite
- [ ] JSON parse failure returns `ContextParseError`
- [ ] Missing file returns `FileNotFound`
- [ ] Env file: blank lines and `#` comments skipped
- [ ] All tests use `FakeFileSystem`

**Test**:
`cd $(git rev-parse --show-toplevel)/zbuild && bun test src/application/resolve-context.spec.ts`

---

### Task 10: Build File Use Case (Application)

**Files**: `src/application/build-file.ts`, `src/application/build-file.spec.ts`

**Definition of Done**:

- [ ] Template `"Hello {{name}}"` + context `name=World` → output `"Hello World"`
- [ ] Template with `![[child]]` + context → transclusion resolved before mustache
- [ ] Full pipeline: transclusion + mustache produces correct output
- [ ] Output written to specified path via FileSystem port
- [ ] Errors from any stage propagate as correct `ZBuildError` variant
- [ ] All tests use `FakeFileSystem`, verify via `fake.written`

**Test**:
`cd $(git rev-parse --show-toplevel)/zbuild && bun test src/application/build-file.spec.ts`

---

### Task 11: Build Directory Use Case (Application)

**Files**: `src/application/build-directory.ts`, `src/application/build-directory.spec.ts`

**Definition of Done**:

- [ ] Directory with two templates → both processed and written
- [ ] Output paths mirror input structure, `.template` stripped
- [ ] Non-template files ignored
- [ ] Nested subdirectories handled
- [ ] Empty directory → Ok, no output
- [ ] Error in one file → fail-fast, return error
- [ ] All tests use `FakeFileSystem`

**Test**:
`cd $(git rev-parse --show-toplevel)/zbuild && bun test src/application/build-directory.spec.ts`

---

### Task 12: CLI Argument Parsing (Infrastructure)

**Files**: `src/infrastructure/cli.ts`, `src/infrastructure/cli.spec.ts`

**Definition of Done**:

- [ ] `parseCliArgs(["input.template.md", "output.md"])` → Ok with input, output, empty context
- [ ] `parseCliArgs(["in.template.md", "out.md", "-c", "key=val"])` → Ok with one context
- [ ] `parseCliArgs(["in.template.md", "out.md", "-c", "key=val", "-c", "f.json"])` → Ok with two
      contexts
- [ ] `parseCliArgs(["-h"])` → help variant
- [ ] `parseCliArgs(["-v"])` → version variant
- [ ] `parseCliArgs([])` → `InvalidArgs` error
- [ ] `parseCliArgs(["input.template.md"])` → `InvalidArgs` error
- [ ] `formatError` produces readable stderr for each `ZBuildError` variant

**Test**: `cd $(git rev-parse --show-toplevel)/zbuild && bun test src/infrastructure/cli.spec.ts`

---

### Task 13: NodeFileSystem Adapter and Contract Tests

**Files**: `src/infrastructure/node-filesystem.ts`, `src/test/filesystem-contract.ts`,
`src/test/fake-filesystem.spec.ts`, `src/infrastructure/node-filesystem.integration.spec.ts`

**Definition of Done**:

- [ ] `NodeFileSystem` implements `FileSystem` port via `Bun.file()`, `Bun.write()`, `node:fs`,
      `node:path`
- [ ] Contract suite: read existing, read missing (FileNotFound), write+read roundtrip, listFiles
      with regex, exists true/false, resolve absolute, dirname parent
- [ ] `fake-filesystem.spec.ts` passes all contract tests
- [ ] `node-filesystem.integration.spec.ts` passes all contract tests with temp dir

**Test (fast)**:
`cd $(git rev-parse --show-toplevel)/zbuild && bun test src/test/fake-filesystem.spec.ts` **Test
(slow)**:
`cd $(git rev-parse --show-toplevel)/zbuild && bun test src/infrastructure/node-filesystem.integration.spec.ts`

---

### Task 14: Composition Root and Entry Point

**Files**: `src/main.ts`

**Definition of Done**:

- [ ] `#!/usr/bin/env bun` shebang
- [ ] Parses CLI args, constructs `NodeFileSystem`, wires use cases
- [ ] Single-file mode: detects file input, calls `buildFile`
- [ ] Directory mode: detects directory input, calls `buildDirectory`
- [ ] Errors → stderr via `formatError`, exit code 1
- [ ] Success → exit code 0
- [ ] `--help` → usage to stdout, exit 0
- [ ] `--version` → version from package.json, exit 0
- [ ] Smoke test: `chmod +x src/main.ts && ./src/main.ts --help` prints usage

**No spec file.** Composition root is pure wiring. All logic tested in tasks 1–13.

---

### Task 15: End-to-End Integration Smoke Test

**Files**: `src/main.integration.spec.ts`

**Definition of Done**:

- [ ] Creates temp dir with template containing transclusion + mustache variable
- [ ] Creates transclusion target file

```
- [ ] Executes `bun src/main.ts <input> <output> -c "key=value"` via `Bun.spawn`
```

- [ ] Reads output file, asserts transclusion resolved and variable rendered
- [ ] Directory mode: two templates processed correctly
- [ ] Exit code 0 on success
- [ ] Exit code 1 + stderr message on missing input
- [ ] Temp dir cleaned up in afterEach

**Test**: `cd $(git rev-parse --show-toplevel)/zbuild && bun test src/main.integration.spec.ts`
<span style="display:none">[^6][^7]</span>

<div align="center">⁂</div>

[^1]: toms-clean-arch-3.md

[^2]: 0015-prompt-architecture-dependency-and-composition-rules-7.md

[^3]: testing.md

[^4]: testing-typescript-2.md

[^5]: toms-clean-code-4.md

[^6]: 0014-atomic-prompt-architecture-6.md

[^7]: 0011-obsidian-compatible-wikilinks-5.md
