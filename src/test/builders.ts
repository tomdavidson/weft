import type { ContextSource, TransclusionRef } from '../domain/types.js'
import { toFilePath } from '../domain/types.js'

export const buildTransclusionRef = (overrides: Partial<TransclusionRef> = {}): TransclusionRef => ({
  raw: '![[default]]',
  target: 'default',
  ...overrides,
})

export const buildInlineContext = (
  overrides: Partial<Extract<ContextSource, { readonly type: 'inline' }>> = {},
): ContextSource => ({ type: 'inline', key: 'defaultKey', value: 'defaultValue', ...overrides })

export const buildJsonFileContext = (
  overrides: Partial<Extract<ContextSource, { readonly type: 'jsonFile' }>> = {},
): ContextSource => ({ type: 'jsonFile', path: toFilePath('default.json'), ...overrides })

export const buildEnvFileContext = (
  overrides: Partial<Extract<ContextSource, { readonly type: 'envFile' }>> = {},
): ContextSource => ({ type: 'envFile', path: toFilePath('default.env'), ...overrides })
