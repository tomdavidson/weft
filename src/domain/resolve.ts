import { err, ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import { dirname } from 'node:path'
import { cycleDetected, fileNotFound, sectionNotFound } from '../domain/errors.js'
import { extractSection, parseTransclusionRefs } from './parse-transclusion.js'
import { resolveRefPath } from './resolve-path.js'
import type { TransclusionRef, WeftError } from './types.js'

export type ResolveInput = { readonly filename: string; readonly fileMap: ReadonlyMap<string, string> }

export type ResolveEnv = { readonly vaultRoot: string; readonly cwd: string }

type ResolveContext = {
  readonly cwd: string
  readonly fileMap: ReadonlyMap<string, string>
  readonly fileExists: (p: string) => boolean
  readonly visited: ReadonlySet<string>
  readonly stack: ReadonlySet<string>
}

type ResolveResult = { readonly content: string; readonly visited: ReadonlySet<string> }

type FileWithRefs = {
  readonly content: string
  readonly filePath: string
  readonly refs: readonly TransclusionRef[]
}

type InlineAccumulator = {
  readonly result: string
  readonly lastIndex: number
  readonly visited: ReadonlySet<string>
}

type ResolveOneRefInput = {
  readonly file: FileWithRefs
  readonly ctx: ResolveContext
  readonly dir: string
  readonly acc: InlineAccumulator
  readonly ref: TransclusionRef
}

const applySectionIfNeeded = (
  inlined: string,
  ref: TransclusionRef,
  childPath: string,
): Result<string, WeftError> => {
  if (ref.section === undefined || ref.section === '' || inlined.length === 0) {
    return ok(inlined)
  }
  return extractSection(inlined, ref.section).mapErr(e => sectionNotFound(childPath, e.heading))
}

const resolveFile = (filePath: string, ctx: ResolveContext): Result<ResolveResult, WeftError> => {
  const content = ctx.fileMap.get(filePath)
  if (content === undefined) {
    return err(fileNotFound(filePath))
  }
  if (ctx.stack.has(filePath)) {
    return err(cycleDetected([...ctx.stack, filePath]))
  }
  if (ctx.visited.has(filePath)) {
    return ok({ content: '', visited: ctx.visited })
  }

  const innerCtx: ResolveContext = {
    ...ctx,
    visited: new Set([...ctx.visited, filePath]),
    stack: new Set([...ctx.stack, filePath]),
  }

  const refs = parseTransclusionRefs(content)
  if (refs.length === 0) {
    return ok({ content, visited: innerCtx.visited })
  }

  return inlineRefs({ content, filePath, refs }, innerCtx)
}

const resolveOneRef = (input: ResolveOneRefInput): Result<InlineAccumulator, WeftError> => {
  const { file, ctx, dir, acc, ref } = input
  const rawIndex = file.content.indexOf(ref.raw, acc.lastIndex)
  const prefix = file.content.slice(acc.lastIndex, rawIndex)
  const currentCtx: ResolveContext = { ...ctx, visited: acc.visited }

  return resolveRefPath(ref, { containingDir: dir, cwd: ctx.cwd, fileExists: ctx.fileExists }).andThen(
    resolvedPath =>
      resolveFile(resolvedPath, currentCtx).andThen(({ content: childContent, visited: updatedVisited }) =>
        applySectionIfNeeded(childContent, ref, resolvedPath).map(section => ({
          result: acc.result + prefix + section.trim(),
          lastIndex: rawIndex + ref.raw.length,
          visited: updatedVisited,
        }))
      )
  )
}

const inlineRefs = (file: FileWithRefs, ctx: ResolveContext): Result<ResolveResult, WeftError> => {
  const dir = dirname(file.filePath)
  const initial: InlineAccumulator = { result: '', lastIndex: 0, visited: ctx.visited }

  return file.refs.reduce<Result<InlineAccumulator, WeftError>>(
    (accResult, ref) => accResult.andThen(acc => resolveOneRef({ file, ctx, dir, acc, ref })),
    ok(initial),
  ).map(acc => ({ content: acc.result + file.content.slice(acc.lastIndex), visited: acc.visited }))
}

export const resolveTransclusions = (input: ResolveInput, env: ResolveEnv): Result<string, WeftError> => {
  const ctx: ResolveContext = {
    cwd: env.cwd,
    fileMap: input.fileMap,
    fileExists: (p: string): boolean => input.fileMap.has(p),
    visited: new Set<string>(),
    stack: new Set<string>(),
  }
  return resolveFile(input.filename, ctx).map(({ content }) => content)
}
