import { err, ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import { resolve } from 'node:path'
import { fileNotFound } from '../domain/errors.js'
import { parseTransclusionRefs } from '../domain/parse-transclusion.js'
import { SUPPORTED_EXTENSIONS, type TransclusionRef, type WeftError } from '../domain/types.js'
import type { FileSystem } from './ports.js'

const BACKSLASH = 92

type GraphState = {
  readonly queue: readonly string[]
  readonly visited: ReadonlySet<string>
  readonly fileMap: ReadonlyMap<string, string>
}

type GraphDeps = { readonly cwd: string; readonly fs: FileSystem }

type RefContext = {
  readonly containingDir: string
  readonly cwd: string
  readonly fileMap: ReadonlyMap<string, string>
  readonly visited: ReadonlySet<string>
  readonly fs: FileSystem
}

const hasExtension = (target: string): boolean => {
  const lastDot = target.lastIndexOf('.')
  const lastSlash = Math.max(target.lastIndexOf('/'), target.lastIndexOf(String.fromCharCode(BACKSLASH)))
  return lastDot > lastSlash && lastDot > 0
}

const isExplicitRelative = (target: string): boolean => target.startsWith('./') || target.startsWith('../')

const buildCandidates = (target: string, containingDir: string, cwd: string): readonly string[] =>
  hasExtension(target) ?
    [resolve(containingDir, target), ...(isExplicitRelative(target) ? [] : [resolve(cwd, target)])] :
    [
      ...SUPPORTED_EXTENSIONS.map(ext => resolve(containingDir, target + '.' + ext)),
      ...(isExplicitRelative(target) ?
        [] :
        SUPPORTED_EXTENSIONS.map(ext => resolve(cwd, target + '.' + ext))),
    ]

const findFirstExisting = async (
  candidates: readonly string[],
  fileMap: ReadonlyMap<string, string>,
  fs: FileSystem,
): Promise<string | undefined> => {
  if (candidates.length === 0) return undefined
  const [head, ...tail] = candidates
  const exists = fileMap.has(head) || await fs.exists(head)
  return exists ? head : findFirstExisting(tail, fileMap, fs)
}

const resolveRefs = async (
  refs: readonly TransclusionRef[],
  ctx: RefContext,
  acc: readonly string[] = [],
): Promise<Result<readonly string[], WeftError>> => {
  if (refs.length === 0) return ok(acc)
  const [head, ...tail] = refs
  const candidates = buildCandidates(head.target, ctx.containingDir, ctx.cwd)
  const resolved = await findFirstExisting(candidates, ctx.fileMap, ctx.fs)
  if (resolved === undefined) return err(fileNotFound(head.target))
  const next = ctx.visited.has(resolved) ? acc : [...acc, resolved]
  return resolveRefs(tail, ctx, next)
}

// eslint-disable-next-line max-lines-per-function -- flat pipeline, no branching; length is from destructuring and object construction
const processFile = async (
  current: string,
  state: GraphState,
  deps: GraphDeps,
): Promise<Result<GraphState, WeftError>> => {
  const { cwd, fs } = deps
  const readResult = await fs.readFile(current)
  if (readResult.isErr()) return err(readResult.error)
  const content = readResult.value
  const updatedVisited = new Set([...state.visited, current])
  const updatedFileMap = new Map([...state.fileMap, [current, content]])
  const refs = parseTransclusionRefs(content)
  const ctx: RefContext = {
    containingDir: fs.dirname(current),
    cwd,
    fileMap: updatedFileMap,
    visited: updatedVisited,
    fs,
  }
  const newPaths = await resolveRefs(refs, ctx)
  return newPaths.isErr() ?
    err(newPaths.error) :
    ok({
      queue: [...state.queue.slice(1), ...newPaths.value],
      visited: updatedVisited,
      fileMap: updatedFileMap,
    })
}

const processQueue = async (
  state: GraphState,
  deps: GraphDeps,
): Promise<Result<ReadonlyMap<string, string>, WeftError>> => {
  if (state.queue.length === 0) return ok(state.fileMap)
  const [current] = state.queue
  if (state.visited.has(current)) return processQueue({ ...state, queue: state.queue.slice(1) }, deps)

  const next = await processFile(current, state, deps)
  return next.isErr() ? err(next.error) : processQueue(next.value, deps)
}

export const loadFileGraph = async (
  entryPath: string,
  _vaultRoot: string,
  deps: GraphDeps,
): Promise<Result<ReadonlyMap<string, string>, WeftError>> =>
  processQueue({ queue: [entryPath], visited: new Set(), fileMap: new Map() }, deps)
