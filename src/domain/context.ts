import type { ContextSource } from './types'
import { toFilePath } from './types'

export const classifyContextSource = (raw: string): ContextSource => {
  if (raw.endsWith('.json')) {
    return { type: 'jsonFile', path: toFilePath(raw) }
  }

  if (raw.endsWith('.env') || raw.endsWith('.txt')) {
    return { type: 'envFile', path: toFilePath(raw) }
  }

  const eqIdx = raw.indexOf('=')
  if (eqIdx > 0) {
    return { type: 'inline', key: raw.slice(0, eqIdx), value: raw.slice(eqIdx + 1) }
  }

  return { type: 'jsonFile', path: toFilePath(raw) }
}

export const mergeContexts = (
  sources: readonly ContextSource[],
  resolved: ReadonlyMap<string, Record<string, string>>,
): Record<string, string> =>
  Object.fromEntries(
    sources.flatMap(source =>
      source.type === 'inline' ?
        [[source.key, source.value]] :
        Object.entries(resolved.get(source.path) ?? {})
    ),
  )
