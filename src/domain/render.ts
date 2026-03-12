import type { Result } from 'neverthrow'
import type { SupportedExtension, WeftError } from './types.js'

const identityEscape = (text: string): string => text

const jsonEscape = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(
    /\t/g,
    '\\t',
  )

const escapeByExtension: Record<SupportedExtension, (text: string) => string> = {
  md: identityEscape,
  txt: identityEscape,
  json: jsonEscape,
} as const

export const selectEscapeFunction = (ext: SupportedExtension): (text: string) => string =>
  escapeByExtension[ext]

export type RenderFn = (
  template: string,
  view: Record<string, string>,
  escapeFn: (text: string) => string,
) => Result<string, WeftError>

export const renderTemplate =
  (render: RenderFn) =>
  (content: string, context: Record<string, string>, ext: SupportedExtension): Result<string, WeftError> =>
    render(content, context, selectEscapeFunction(ext))
