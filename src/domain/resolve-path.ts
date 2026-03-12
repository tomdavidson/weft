import { err, ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import { extname, resolve } from 'node:path'
import { fileNotFound } from './errors.js'
import type { TransclusionRef, WeftError } from './types.js'
import { SUPPORTED_EXTENSIONS } from './types.js'

export type ResolvePathEnv = {
  readonly containingDir: string
  readonly cwd: string
  readonly fileExists: (p: string) => boolean
}

const isExplicitRelative = (target: string): boolean => target.startsWith('./') || target.startsWith('../')

const hasExtension = (target: string): boolean => extname(target).length > 0

const tryResolve = (base: string, target: string, fileExists: (p: string) => boolean): string | undefined => {
  if (hasExtension(target)) {
    const candidate = resolve(base, target)
    return fileExists(candidate) ? candidate : undefined
  }

  const matchedExt = SUPPORTED_EXTENSIONS.find(ext => fileExists(resolve(base, `${target}.${ext}`)))

  return matchedExt ? resolve(base, `${target}.${matchedExt}`) : undefined
}

export const resolveRefPath = (ref: TransclusionRef, env: ResolvePathEnv): Result<string, WeftError> => {
  const fromContaining = tryResolve(env.containingDir, ref.target, env.fileExists)
  if (fromContaining !== undefined) return ok(fromContaining)

  if (isExplicitRelative(ref.target)) {
    return err(fileNotFound(resolve(env.containingDir, ref.target)))
  }

  const fromCwd = tryResolve(env.cwd, ref.target, env.fileExists)
  if (fromCwd !== undefined) return ok(fromCwd)

  return err(fileNotFound(ref.target))
}
