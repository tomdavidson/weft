import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createNodeFileSystem } from './node-fs.js'

let tempDir: string
let fs: ReturnType<typeof createNodeFileSystem>

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'zbuild-test-'))
  fs = createNodeFileSystem()
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('NodeFileSystem', () => {
  describe('readFile', () => {
    it('reads an existing file', async () => {
      const filePath = join(tempDir, 'test.md')
      await writeFile(filePath, 'hello world', 'utf-8')
      const result = await fs.readFile(filePath)
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBe('hello world')
    })

    it('returns FileNotFound for missing file', async () => {
      const result = await fs.readFile(join(tempDir, 'nope.md'))
      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.type).toBe('FileNotFound')
    })
  })

  describe('writeFile', () => {
    it('writes content to a new file', async () => {
      const filePath = join(tempDir, 'output.md')
      const result = await fs.writeFile(filePath, 'written content')
      expect(result.isOk()).toBe(true)

      const readBack = await fs.readFile(filePath)
      expect(readBack._unsafeUnwrap()).toBe('written content')
    })

    it('overwrites an existing file', async () => {
      const filePath = join(tempDir, 'overwrite.md')
      await writeFile(filePath, 'old', 'utf-8')
      await fs.writeFile(filePath, 'new')
      const readBack = await fs.readFile(filePath)
      expect(readBack._unsafeUnwrap()).toBe('new')
    })

    it('creates intermediate directories', async () => {
      const filePath = join(tempDir, 'sub', 'deep', 'file.md')
      const result = await fs.writeFile(filePath, 'nested')
      expect(result.isOk()).toBe(true)
      const readBack = await fs.readFile(filePath)
      expect(readBack._unsafeUnwrap()).toBe('nested')
    })
  })

  describe('exists', () => {
    it('returns true for existing file', async () => {
      const filePath = join(tempDir, 'exists.md')
      await writeFile(filePath, 'hi', 'utf-8')
      expect(await fs.exists(filePath)).toBe(true)
    })

    it('returns false for missing file', async () => {
      expect(await fs.exists(join(tempDir, 'nope.md'))).toBe(false)
    })
  })

  describe('listFiles', () => {
    it('lists files matching a pattern', async () => {
      await writeFile(join(tempDir, 'a.md'), '', 'utf-8')
      await writeFile(join(tempDir, 'b.md'), '', 'utf-8')
      await writeFile(join(tempDir, 'c.txt'), '', 'utf-8')
      const result = await fs.listFiles(tempDir, /\.md$/)
      expect(result.isOk()).toBe(true)
      const files = result._unsafeUnwrap().toSorted()
      expect(files.length).toBe(2)
      expect(files[0]).toContain('a.md')
      expect(files[1]).toContain('b.md')
    })

    it('returns empty array when no files match', async () => {
      await writeFile(join(tempDir, 'a.txt'), '', 'utf-8')
      const result = await fs.listFiles(tempDir, /\.json$/)
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual([])
    })
  })

  describe('resolve', () => {
    it('resolves path segments', () => {
      const result = fs.resolve('/project', 'sub', 'file.md')
      expect(result).toBe('/project/sub/file.md')
    })
  })

  describe('dirname', () => {
    it('returns parent directory', () => {
      expect(fs.dirname('/project/sub/file.md')).toBe('/project/sub')
    })
  })
})
