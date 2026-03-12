import Mustache from 'mustache'
import { Result } from 'neverthrow'
import { templateRenderError } from '../domain/errors.js'
import type { ZBuildError } from '../domain/types.js'

const toRenderError = (e: unknown): ZBuildError =>
  templateRenderError('-unknown path-', e instanceof Error ? e.message : String(e))

const withEscapeFn = <T>(escapeFn: (text: string) => string, fn: () => T): T => {
  const original = Mustache.escape
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data
  Mustache.escape = escapeFn
  const result = fn()
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data
  Mustache.escape = original
  return result
}

export const renderWithMustache = (
  template: string,
  view: Record<string, string>,
  escapeFn: (text: string) => string,
): Result<string, ZBuildError> =>
  withEscapeFn(escapeFn, () => Result.fromThrowable(() => Mustache.render(template, view), toRenderError)())
