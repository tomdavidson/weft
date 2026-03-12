import type { Result } from 'neverthrow'
import type { WeftError } from '../domain/types.js'

export type FileSystem = {
  readonly readFile: (path: string) => Promise<Result<string, WeftError>>
  readonly writeFile: (path: string, content: string) => Promise<Result<void, WeftError>>
  readonly listFiles: (directory: string, pattern: RegExp) => Promise<Result<readonly string[], WeftError>>
  readonly exists: (path: string) => Promise<boolean>
  readonly resolve: (...segments: readonly string[]) => string
  readonly dirname: (path: string) => string
}
