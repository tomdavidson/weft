import { ResultAsync } from 'neverthrow'
import type { Result } from 'neverthrow'
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { FileSystem } from '../application/ports.js'
import { fileNotFound, fileReadError, outputWriteError } from '../domain/errors.js'
import type { ZBuildError } from '../domain/types.js'

const hasCode = (e: unknown): e is { readonly code: string } =>
  typeof e === 'object' && e !== null && 'code' in e &&
  typeof (e as { readonly code: unknown }).code === 'string'

const toReadError = (path: string) => (e: unknown): ZBuildError =>
  hasCode(e) && e.code === 'ENOENT' ?
    fileNotFound(path) :
    fileReadError(path, e instanceof Error ? e.message : String(e))

const toWriteError = (path: string) => (e: unknown): ZBuildError =>
  outputWriteError(path, e instanceof Error ? e.message : String(e))

export const createNodeFileSystem = (): FileSystem => ({
  readFile: async (path: string): Promise<Result<string, ZBuildError>> =>
    ResultAsync.fromPromise(readFile(path, 'utf-8'), toReadError(path)),

  writeFile: async (path: string, content: string): Promise<Result<void, ZBuildError>> =>
    ResultAsync.fromPromise(mkdir(dirname(path), { recursive: true }), toWriteError(path)).andThen(() =>
      ResultAsync.fromPromise(writeFile(path, content, 'utf-8'), toWriteError(path))
    ),

  listFiles: async (directory: string, pattern: RegExp): Promise<Result<readonly string[], ZBuildError>> =>
    ResultAsync.fromPromise(readdir(directory), toReadError(directory)).map(entries =>
      entries.filter(name => pattern.test(name)).map(name => join(directory, name))
    ),

  exists: async (path: string): Promise<boolean> => access(path).then(() => true, () => false),

  resolve: (...segments: readonly string[]): string => resolve(...segments),

  dirname: (path: string): string => dirname(path),
})
