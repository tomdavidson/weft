import { err, ok, Result } from 'neverthrow'
import { mergeContexts } from '../domain/context.js'
import type { ContextSource, WeftError } from '../domain/types.js'
import type { FileSystem } from './ports.js'

const NEWLINE = 10

const parseEnvContent = (content: string): Record<string, string> => {
  const entries: readonly (readonly [string, string])[] = content.split(String.fromCharCode(NEWLINE)).map(
    line => line.trim()
  ).filter((line): boolean => {
    if (line.length === 0) return false
    if (line.startsWith('#')) return false
    return line.includes('=')
  }).map(line => {
    const eqIdx = line.indexOf('=')
    const key = line.slice(0, eqIdx).trim()
    const value = line.slice(eqIdx + 1).trim()
    return [key, value] as const
  }).filter(([k]) => k.length > 0)

  // Object.fromEntries returns Record<string, unknown> here; we only emit string values.
  return Object.fromEntries(entries) as Record<string, string>
}

const safeJsonParse = Result.fromThrowable(
  (input: string): unknown => JSON.parse(input),
  (e): string => (e instanceof Error ? e.message : String(e)),
)

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' && value !== null && Object.values(value).every(v => typeof v === 'string')

const parseJsonContent = (content: string, path: string): Result<Record<string, string>, WeftError> =>
  safeJsonParse(content).mapErr((cause): WeftError => ({
    type: 'ContextParseError',
    source: path,
    cause,
    message: `Context parse error (${path}): ${cause}`,
  })).andThen(value =>
    isStringRecord(value) ?
      ok(value) :
      err(
        {
          type: 'ContextParseError' as const,
          source: path,
          cause: 'JSON is not an object with string values',
          message: `Context parse error (${path}): JSON is not an object with string values`,
        } satisfies WeftError,
      )
  )

const accumulateFileSource =
  (fs: FileSystem) =>
  async (
    accPromise: Promise<Result<ReadonlyMap<string, Record<string, string>>, WeftError>>,
    source: Extract<ContextSource, { readonly type: 'jsonFile' | 'envFile' }>,
  ): Promise<Result<ReadonlyMap<string, Record<string, string>>, WeftError>> => {
    const acc = await accPromise
    if (acc.isErr()) return acc

    const content = await fs.readFile(source.path)
    return content.andThen(text =>
      source.type === 'jsonFile' ? parseJsonContent(text, source.path) : ok(parseEnvContent(text))
    ).map(parsed =>
      new Map([...acc.value, [source.path, parsed]]) as ReadonlyMap<string, Record<string, string>>
    )
  }

const resolveFileSources = async (
  fileSources: readonly Extract<ContextSource, { readonly type: 'jsonFile' | 'envFile' }>[],
  fs: FileSystem,
): Promise<Result<ReadonlyMap<string, Record<string, string>>, WeftError>> =>
  fileSources.reduce<Promise<Result<ReadonlyMap<string, Record<string, string>>, WeftError>>>(
    accumulateFileSource(fs),
    Promise.resolve(
      ok(new Map<string, Record<string, string>>() as ReadonlyMap<string, Record<string, string>>),
    ),
  )

export const resolveContext = async (
  sources: readonly ContextSource[],
  fs: FileSystem,
): Promise<Result<Record<string, string>, WeftError>> => {
  const fileSources = sources.filter((
    s,
  ): s is Extract<ContextSource, { readonly type: 'jsonFile' | 'envFile' }> => s.type !== 'inline')

  const resolved = await resolveFileSources(fileSources, fs)
  return resolved.map(resolvedMap => mergeContexts(sources, resolvedMap))
}
