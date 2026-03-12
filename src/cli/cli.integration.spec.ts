import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

describe('CLI: build pipeline', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'weft-cli-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  test('writes output file to disk', async () => {
    const entry = path.join(tmpDir, 'entry.md')
    const output = path.join(tmpDir, 'out.md')
    await writeFile(entry, 'Hello world')

    const proc = Bun.spawn(['bun', 'run', 'src/cli/index.ts', entry, '-o', output])
    await proc.exited
    expect(proc.exitCode).toBe(0)

    const written = await readFile(output, 'utf-8')
    expect(written).toBe('Hello world')
  })

  test('writes to stdout when no -o flag', async () => {
    const entry = path.join(tmpDir, 'entry.md')
    await writeFile(entry, 'Hello world')

    const proc = Bun.spawn(['bun', 'run', 'src/cli/index.ts', entry])
    const stdout = await new Response(proc.stdout).text()
    await proc.exited
    expect(proc.exitCode).toBe(0)
    expect(stdout).toBe('Hello world')
  })

  test('renders template variables from inline context', async () => {
    const entry = path.join(tmpDir, 'entry.md')
    const output = path.join(tmpDir, 'out.md')
    await writeFile(entry, 'Hello {{name}}')

    const proc = Bun.spawn(['bun', 'run', 'src/cli/index.ts', entry, '-o', output, '-c', 'name=Tom'])
    await proc.exited
    expect(proc.exitCode).toBe(0)

    const written = await readFile(output, 'utf-8')
    expect(written).toBe('Hello Tom')
  })

  test('resolves transclusion and writes result', async () => {
    const entry = path.join(tmpDir, 'entry.md')
    const child = path.join(tmpDir, 'child.md')
    const output = path.join(tmpDir, 'out.md')
    await writeFile(entry, 'Before ![[child]] After')
    await writeFile(child, 'INCLUDED')

    const proc = Bun.spawn(['bun', 'run', 'src/cli/index.ts', entry, '-o', output])
    await proc.exited
    expect(proc.exitCode).toBe(0)

    const written = await readFile(output, 'utf-8')
    expect(written).toBe('Before INCLUDED After')
  })

  test('creates output directory if it does not exist', async () => {
    const entry = path.join(tmpDir, 'entry.md')
    const output = path.join(tmpDir, 'deep/nested/out.md')
    await writeFile(entry, 'Hello world')

    const proc = Bun.spawn(['bun', 'run', 'src/cli/index.ts', entry, '-o', output])
    await proc.exited
    expect(proc.exitCode).toBe(0)

    const written = await readFile(output, 'utf-8')
    expect(written).toBe('Hello world')
  })

  test('exits non-zero for missing entry file', async () => {
    const output = path.join(tmpDir, 'out.md')

    const proc = Bun.spawn(['bun', 'run', 'src/cli/index.ts', 'nonexistent.md', '-o', output])
    await proc.exited
    expect(proc.exitCode).not.toBe(0)
  })
})
