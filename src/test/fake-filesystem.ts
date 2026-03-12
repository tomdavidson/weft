import { err, ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import { dirname, resolve } from 'node:path'
import type { FileSystem } from '../application/ports.js'
import { fileNotFound } from '../domain/errors.js'
import type { WeftError } from '../domain/types.js'

export type FakeFileSystem = FileSystem & {
  readonly files: ReadonlyMap<string, string>
  readonly written: ReadonlyMap<string, string>
}

export const createFakeFileSystem = (initialFiles: Record<string, string> = {}): FakeFileSystem => {
  const files = new Map<string, string>(Object.entries(initialFiles))
  const written = new Map<string, string>()

  return {
    files,
    written,

    readFile: async (path: string): Promise<Result<string, WeftError>> => {
      const content = await Promise.resolve(files.get(path))
      return content === undefined ? err(fileNotFound(path)) : ok(content)
    },

    writeFile: async (path: string, content: string): Promise<Result<void, WeftError>> => {
      await Promise.resolve()
      files.set(path, content)
      written.set(path, content)
      return ok()
    },

    listFiles: async (directory: string, pattern: RegExp): Promise<Result<readonly string[], WeftError>> =>
      ok([...files.keys()].filter(p => p.startsWith(directory) && pattern.test(p))),

    exists: async (path: string): Promise<boolean> => Promise.resolve(files.has(path)),

    resolve: (...segments: readonly string[]): string => resolve(...segments),

    dirname: (path: string): string => dirname(path),
  }
}
