import { basename, join, relative } from 'node:path'
import type { SupportedExtension } from './types.js'
import { SUPPORTED_EXTENSIONS } from './types.js'

const TEMPLATE_FILE_RE = /\.template\.(md|json|txt)$/i

const isSupportedExtension = (value: string): value is SupportedExtension =>
  SUPPORTED_EXTENSIONS.some(e => e === value)

export const isTemplateFile = (filename: string): boolean => TEMPLATE_FILE_RE.test(basename(filename))

export const deriveOutputPath = (templatePath: string, inputBase: string, outputBase: string): string => {
  const rel = relative(inputBase, templatePath)
  const stripped = rel.replace('.template.', '.')
  return join(outputBase, stripped)
}

export const getOutputExtension = (filename: string): SupportedExtension | undefined => {
  const match = TEMPLATE_FILE_RE.exec(basename(filename))
  if (!match) return undefined

  const ext = match[1].toLowerCase()
  return isSupportedExtension(ext) ? ext : undefined
}
