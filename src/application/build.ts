import { ResultAsync } from 'neverthrow'
import type { Result } from 'neverthrow'
import { renderTemplate } from '../domain/render.js'
import { resolveTransclusions } from '../domain/resolve.js'
import type { ContextSource, SupportedExtension, WeftError } from '../domain/types.js'
import { renderWithMustache } from '../infrastructure/mustache-adapter.js'
import { loadFileGraph } from './load-graph.js'
import type { FileSystem } from './ports.js'
import { resolveContext } from './resolve-context.js'

export type BuildOptions = {
  readonly entryPath: string
  readonly outputPath: string | undefined
  readonly contextSources: readonly ContextSource[]
  readonly cwd: string
  readonly ext: SupportedExtension
}

type BuildContext = Record<string, string>
type FileGraph = ReadonlyMap<string, string>

export const build = async (options: BuildOptions, fs: FileSystem): Promise<Result<string, WeftError>> => {
  const { entryPath, contextSources, cwd, ext } = options

  return new ResultAsync(resolveContext(contextSources, fs)).andThen((context: BuildContext) =>
    new ResultAsync(loadFileGraph(entryPath, cwd, { cwd, fs })).map((fileMap: FileGraph) => ({
      context,
      fileMap,
    }))
  ).andThen(({ context, fileMap }) =>
    resolveTransclusions({ filename: entryPath, fileMap }, { vaultRoot: cwd, cwd }).map(resolvedStr => ({
      context,
      resolvedStr,
    }))
  ).andThen(({ context, resolvedStr }) => renderTemplate(renderWithMustache)(resolvedStr, context, ext))
    .then(res => res)
}
