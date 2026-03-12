import type { WeftError } from './types.js'

export const fileNotFound = (path: string): WeftError => ({
  type: 'FileNotFound',
  path,
  message: 'File not found: ' + path,
})

export const fileReadError = (path: string, cause: string): WeftError => ({
  type: 'FileReadError',
  path,
  cause,
  message: 'Read error (' + path + '): ' + cause,
})

export const cycleDetected = (chain: readonly string[]): WeftError => ({
  type: 'CycleDetected',
  chain,
  message: 'Cycle detected: ' + chain.join(' -> '),
})

export const contextParseError = (source: string, cause: string): WeftError => ({
  type: 'ContextParseError',
  source,
  cause,
  message: 'Context parse error (' + source + '): ' + cause,
})

export const templateRenderError = (path: string | undefined, cause: string): WeftError => ({
  type: 'TemplateRenderError',
  path,
  cause,
  message: path === undefined ? 'Template error: ' + cause : 'Template error (' + path + '): ' + cause,
})
export const invalidArgs = (message: string): WeftError => ({
  type: 'InvalidArgs',
  message: 'Invalid arguments: ' + message,
})

export const sectionNotFound = (file: string, heading: string): WeftError => ({
  type: 'SectionNotFound',
  file,
  heading,
  message: 'Section not found: heading "' + heading + '" in ' + file,
})

export const outputWriteError = (path: string, cause: string): WeftError => ({
  type: 'OutputWriteError',
  path,
  cause,
  message: 'Write error (' + path + '): ' + cause,
})
