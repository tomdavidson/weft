import type { Result } from 'neverthrow'
import type { ZBuildError } from '../domain/types.js'

export type FileSystem = {
  readonly readFile: (path: string) => Promise<Result<string, ZBuildError>>
  readonly writeFile: (path: string, content: string) => Promise<Result<void, ZBuildError>>
  readonly listFiles: (directory: string, pattern: RegExp) => Promise<Result<readonly string[], ZBuildError>>
  readonly exists: (path: string) => Promise<boolean>
  readonly resolve: (...segments: readonly string[]) => string
  readonly dirname: (path: string) => string
}
