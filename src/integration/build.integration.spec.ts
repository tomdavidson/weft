import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from '../application/build.js'
import { toFilePath } from '../domain/types.js'
import { createNodeFileSystem } from '../infrastructure/node-fs.js'

let tempDir: string
const fs = createNodeFileSystem()

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'zbuild-integration-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

const write = async (name: string, content: string) => writeFile(join(tempDir, name), content, 'utf-8')

const read = async (name: string) => readFile(join(tempDir, name), 'utf-8')

describe('Integration: build pipeline', () => {
  it('single file with no transclusions, no context', async () => {
    await write('entry.md', 'Hello world')
    const result = await build({
      entryPath: join(tempDir, 'entry.md'),
      outputPath: join(tempDir, 'out.md'),
      contextSources: [],
      cwd: tempDir,
      ext: 'md',
    }, fs)
    expect(result.isOk()).toBe(true)
    expect(await read('out.md')).toBe('Hello world')
  })

  it('single file with template variables from inline context', async () => {
    await write('entry.md', 'Hello {{name}}, you are {{role}}.')
    const result = await build({
      entryPath: join(tempDir, 'entry.md'),
      outputPath: join(tempDir, 'out.md'),
      contextSources: [{ type: 'inline', key: 'name', value: 'Tom' }, {
        type: 'inline',
        key: 'role',
        value: 'admin',
      }],
      cwd: tempDir,
      ext: 'md',
    }, fs)
    expect(result.isOk()).toBe(true)
    expect(await read('out.md')).toBe('Hello Tom, you are admin.')
  })

  it('transclusion of a child file', async () => {
    await write('root.md', 'Before ![[child]] After')
    await write('child.md', 'CHILD')
    const result = await build({
      entryPath: join(tempDir, 'root.md'),
      outputPath: join(tempDir, 'out.md'),
      contextSources: [],
      cwd: tempDir,
      ext: 'md',
    }, fs)
    expect(result.isOk()).toBe(true)
    expect(await read('out.md')).toBe('Before CHILD After')
  })

  it('chained transclusions with template rendering', async () => {
    await write(
      'root.md',
      '# Doc' + String.fromCharCode(10) + '![[header]]' + String.fromCharCode(10) + '![[body]]',
    )
    await write('header.md', 'Title: {{title}}')
    await write('body.md', 'Author: {{author}}')
    const result = await build({
      entryPath: join(tempDir, 'root.md'),
      outputPath: join(tempDir, 'out.md'),
      contextSources: [{ type: 'inline', key: 'title', value: 'My Doc' }, {
        type: 'inline',
        key: 'author',
        value: 'Tom',
      }],
      cwd: tempDir,
      ext: 'md',
    }, fs)
    expect(result.isOk()).toBe(true)
    const output = await read('out.md')
    expect(output).toContain('Title: My Doc')
    expect(output).toContain('Author: Tom')
  })

  it('context from JSON file merged with inline overrides', async () => {
    await write('entry.md', '{{greeting}} {{name}}')
    await write('ctx.json', JSON.stringify({ greeting: 'Hello', name: 'default' }))
    const result = await build({
      entryPath: join(tempDir, 'entry.md'),
      outputPath: join(tempDir, 'out.md'),
      contextSources: [{ type: 'jsonFile', path: toFilePath(join(tempDir, 'ctx.json')) }, {
        type: 'inline',
        key: 'name',
        value: 'Tom',
      }],
      cwd: tempDir,
      ext: 'md',
    }, fs)
    expect(result.isOk()).toBe(true)
    expect(await read('out.md')).toBe('Hello Tom')
  })

  it('context from env file', async () => {
    await write('entry.md', 'Host: {{DB_HOST}}, Port: {{DB_PORT}}')
    await write('config.env', 'DB_HOST=localhost' + String.fromCharCode(10) + 'DB_PORT=5432')
    const result = await build({
      entryPath: join(tempDir, 'entry.md'),
      outputPath: join(tempDir, 'out.md'),
      contextSources: [{ type: 'envFile', path: toFilePath(join(tempDir, 'config.env')) }],
      cwd: tempDir,
      ext: 'md',
    }, fs)
    expect(result.isOk()).toBe(true)
    expect(await read('out.md')).toBe('Host: localhost, Port: 5432')
  })

  it('transclusion in subdirectory resolves relative paths', async () => {
    await mkdir(join(tempDir, 'sub'), { recursive: true })
    await write('root.md', '![[sub/part]]')
    await write('sub/part.md', 'from sub')
    const result = await build({
      entryPath: join(tempDir, 'root.md'),
      outputPath: join(tempDir, 'out.md'),
      contextSources: [],
      cwd: tempDir,
      ext: 'md',
    }, fs)
    expect(result.isOk()).toBe(true)
    expect(await read('out.md')).toBe('from sub')
  })

  it('diamond dependency resolves correctly', async () => {
    await write('root.md', '![[a]] ![[b]]')
    await write('a.md', 'A(![[shared]])')
    await write('b.md', 'B(![[shared]])')
    await write('shared.md', 'S')
    const result = await build({
      entryPath: join(tempDir, 'root.md'),
      outputPath: join(tempDir, 'out.md'),
      contextSources: [],
      cwd: tempDir,
      ext: 'md',
    }, fs)
    expect(result.isOk()).toBe(true)
    const output = await read('out.md')
    expect(output).toContain('A(S)')
  })

  it('returns FileNotFound for missing entry file', async () => {
    const result = await build({
      entryPath: join(tempDir, 'nope.md'),
      outputPath: join(tempDir, 'out.md'),
      contextSources: [],
      cwd: tempDir,
      ext: 'md',
    }, fs)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().type).toBe('FileNotFound')
  })

  it('returns FileNotFound for missing transclusion target', async () => {
    await write('root.md', '![[missing]]')
    const result = await build({
      entryPath: join(tempDir, 'root.md'),
      outputPath: join(tempDir, 'out.md'),
      contextSources: [],
      cwd: tempDir,
      ext: 'md',
    }, fs)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().type).toBe('FileNotFound')
  })

  it('creates output directory if it does not exist', async () => {
    await write('entry.md', 'content')
    const result = await build({
      entryPath: join(tempDir, 'entry.md'),
      outputPath: join(tempDir, 'deep', 'nested', 'out.md'),
      contextSources: [],
      cwd: tempDir,
      ext: 'md',
    }, fs)
    expect(result.isOk()).toBe(true)
    expect(await read('deep/nested/out.md')).toBe('content')
  })
})
