import type { ZBuildError } from './types.js'

export const fileNotFound = (path: string): ZBuildError => ({
  type: 'FileNotFound',
  path,
  message: 'File not found: ' + path,
})

export const fileReadError = (path: string, cause: string): ZBuildError => ({
  type: 'FileReadError',
  path,
  cause,
  message: 'Read error (' + path + '): ' + cause,
})

export const cycleDetected = (chain: readonly string[]): ZBuildError => ({
  type: 'CycleDetected',
  chain,
  message: 'Cycle detected: ' + chain.join(' -> '),
})

export const contextParseError = (source: string, cause: string): ZBuildError => ({
  type: 'ContextParseError',
  source,
  cause,
  message: 'Context parse error (' + source + '): ' + cause,
})

export const templateRenderError = (path: string | undefined, cause: string): ZBuildError => ({
  type: 'TemplateRenderError',
  path,
  cause,
  message: path === undefined ? 'Template error: ' + cause : 'Template error (' + path + '): ' + cause,
})
export const invalidArgs = (message: string): ZBuildError => ({
  type: 'InvalidArgs',
  message: 'Invalid arguments: ' + message,
})

export const sectionNotFound = (file: string, heading: string): ZBuildError => ({
  type: 'SectionNotFound',
  file,
  heading,
  message: 'Section not found: heading "' + heading + '" in ' + file,
})

export const outputWriteError = (path: string, cause: string): ZBuildError => ({
  type: 'OutputWriteError',
  path,
  cause,
  message: 'Write error (' + path + '): ' + cause,
})
