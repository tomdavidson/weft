export type FilePath =
  & string
  & { readonly __brand: unique symbol }

// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- branded FilePath constructor
export const toFilePath = (value: string): FilePath => value as FilePath

export type SupportedExtension = 'md' | 'json' | 'txt'

export const SUPPORTED_EXTENSIONS: readonly SupportedExtension[] = ['md', 'json', 'txt'] as const

export type TransclusionRef = { readonly raw: string; readonly target: string; readonly section?: string }

export type ContextSource = { readonly type: 'inline'; readonly key: string; readonly value: string } | {
  readonly type: 'jsonFile'
  readonly path: FilePath
} | { readonly type: 'envFile'; readonly path: FilePath }

export type ZBuildError = // revert
  | { readonly type: 'FileNotFound'; readonly path: string; readonly message: string }
  | {
    readonly type: 'FileReadError'
    readonly path: string
    readonly cause: string
    readonly message: string
  }
  | { readonly type: 'CycleDetected'; readonly chain: readonly string[]; readonly message: string }
  | {
    readonly type: 'ContextParseError'
    readonly source: string
    readonly cause: string
    readonly message: string
  }
  | {
    readonly type: 'TemplateRenderError'
    readonly path?: string
    readonly cause: string
    readonly message: string
  }
  | { readonly type: 'InvalidArgs'; readonly message: string }
  | {
    readonly type: 'SectionNotFound'
    readonly file: string
    readonly heading: string
    readonly message: string
  }
  | {
    readonly type: 'OutputWriteError'
    readonly path: string
    readonly cause: string
    readonly message: string
  }
