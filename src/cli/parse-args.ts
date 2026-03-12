import { err, ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import { extname } from 'node:path'
import type { ContextSource, FilePath, SupportedExtension, WeftError } from '../domain/types.js'
import { SUPPORTED_EXTENSIONS } from '../domain/types.js'

const FLAG_VALUE_STEP = 2

export type ParsedArgs = {
  readonly entryPath: string
  readonly outputPath: string
  readonly contextSources: readonly ContextSource[]
  readonly cwd: string
  readonly ext: SupportedExtension
}

type ParserState = {
  readonly entryPath: string | undefined
  readonly outputPath: string | undefined
  readonly cwd: string | undefined
  readonly contextSources: readonly ContextSource[]
  readonly index: number
}

const INITIAL_STATE: ParserState = {
  entryPath: undefined,
  outputPath: undefined,
  cwd: undefined,
  contextSources: [],
  index: 0,
}

const isSupportedExtension = (ext: string): ext is SupportedExtension =>
  (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)

const detectExtension = (filename: string): SupportedExtension => {
  const raw = extname(filename).slice(1)
  return isSupportedExtension(raw) ? raw : 'md'
}

const parseInlineContext = (pair: string | undefined): Result<ContextSource, WeftError> => {
  if (pair === undefined) {
    return err({ type: 'InvalidArgs', message: 'Context flag -c requires key=value format' })
  }

  const eqIdx = pair.indexOf('=')
  if (eqIdx === -1) {
    return err({ type: 'InvalidArgs', message: 'Context flag -c requires key=value format' })
  }

  return ok({ type: 'inline' as const, key: pair.slice(0, eqIdx), value: pair.slice(eqIdx + 1) })
}

const safeFilePath = (value: string | undefined): Result<FilePath, WeftError> => {
  if (value === undefined || value.length === 0) {
    return err({ type: 'InvalidArgs', message: 'Context file path is required' })
  }

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- branded type factory
  return ok(value as FilePath)
}

const handleOutputFlag = (argv: readonly string[], state: ParserState): ParserState => ({
  ...state,
  outputPath: argv[state.index + 1],
  index: state.index + FLAG_VALUE_STEP,
})

const handleContextFlag = (argv: readonly string[], state: ParserState): Result<ParserState, WeftError> => {
  const result = parseInlineContext(argv[state.index + 1])
  if (result.isErr()) return err(result.error)
  return ok({
    ...state,
    contextSources: [...state.contextSources, result.value],
    index: state.index + FLAG_VALUE_STEP,
  })
}

const addJsonSource = (argv: readonly string[], state: ParserState): Result<ParserState, WeftError> => {
  const pathResult = safeFilePath(argv[state.index + 1])
  if (pathResult.isErr()) return err(pathResult.error)

  return ok({
    ...state,
    contextSources: [...state.contextSources, { type: 'jsonFile' as const, path: pathResult.value }],
    index: state.index + FLAG_VALUE_STEP,
  })
}

const addEnvSource = (argv: readonly string[], state: ParserState): Result<ParserState, WeftError> => {
  const pathResult = safeFilePath(argv[state.index + 1])
  if (pathResult.isErr()) return err(pathResult.error)

  return ok({
    ...state,
    contextSources: [...state.contextSources, { type: 'envFile' as const, path: pathResult.value }],
    index: state.index + FLAG_VALUE_STEP,
  })
}

const handleCwdFlag = (argv: readonly string[], state: ParserState): ParserState => ({
  ...state,
  cwd: argv[state.index + 1],
  index: state.index + FLAG_VALUE_STEP,
})

type FlagHandler = (argv: readonly string[], state: ParserState) => Result<ParserState, WeftError>

const FLAG_HANDLERS: Record<string, FlagHandler> = {
  '-o': (argv, state) => ok(handleOutputFlag(argv, state)),
  '--output': (argv, state) => ok(handleOutputFlag(argv, state)),
  '-c': handleContextFlag,
  '--context': handleContextFlag,
  '--json': addJsonSource,
  '--env': addEnvSource,
  '--cwd': (argv, state) => ok(handleCwdFlag(argv, state)),
} as const

const getFlagHandler = (arg: string): FlagHandler | undefined => FLAG_HANDLERS[arg]

const processArg = (argv: readonly string[], state: ParserState): Result<ParserState, WeftError> => {
  const arg = argv[state.index]
  const handler = getFlagHandler(arg)

  if (handler !== undefined) {
    return handler(argv, state)
  }

  if (state.entryPath === undefined) {
    return ok({ ...state, entryPath: arg, index: state.index + 1 })
  }

  return ok({ ...state, index: state.index + 1 })
}

const processArgs = (argv: readonly string[], state: ParserState): Result<ParserState, WeftError> => {
  if (state.index >= argv.length) return ok(state)
  const result = processArg(argv, state)
  if (result.isErr()) return result
  return processArgs(argv, result.value)
}

export const parseArgs = (argv: readonly string[]): Result<ParsedArgs, WeftError> => {
  const result = processArgs(argv, INITIAL_STATE)
  if (result.isErr()) return err(result.error)

  const { entryPath, outputPath, cwd, contextSources } = result.value

  if (entryPath === undefined) {
    return err({ type: 'InvalidArgs', message: 'Missing entry file path' })
  }

  if (outputPath === undefined) {
    return err({ type: 'InvalidArgs', message: 'Missing output path (-o)' })
  }

  return ok({
    entryPath,
    outputPath,
    contextSources,
    cwd: cwd ?? process.cwd(),
    ext: detectExtension(outputPath),
  })
}
