import { describe, expect, it } from 'bun:test'
import { deriveOutputPath, getOutputExtension, isTemplateFile } from './template.js'
import type { SupportedExtension } from './types.js'

describe('isTemplateFile', () => {
  it('returns true for .template.md', () => {
    expect(isTemplateFile('index.template.md')).toBe(true)
  })

  it('returns true for .template.json', () => {
    expect(isTemplateFile('data.template.json')).toBe(true)
  })

  it('returns true for .template.txt', () => {
    expect(isTemplateFile('notes.template.txt')).toBe(true)
  })

  it('returns false for non-template files', () => {
    expect(isTemplateFile('index.md')).toBe(false)
  })

  it('returns false for unsupported template extensions', () => {
    expect(isTemplateFile('data.template.html')).toBe(false)
  })

  it('returns false for bare .template with no extension', () => {
    expect(isTemplateFile('file.template')).toBe(false)
  })

  it('matches case-insensitively', () => {
    expect(isTemplateFile('INDEX.TEMPLATE.MD')).toBe(true)
  })
})

describe('deriveOutputPath', () => {
  it('strips .template segment and re-roots to output base', () => {
    expect(deriveOutputPath('templates/index.template.md', 'templates', 'dist')).toBe('dist/index.md')
  })

  it('preserves subdirectory structure', () => {
    expect(deriveOutputPath('templates/sub/page.template.md', 'templates', 'dist')).toBe('dist/sub/page.md')
  })

  it('handles json templates', () => {
    expect(deriveOutputPath('templates/data.template.json', 'templates', 'dist')).toBe('dist/data.json')
  })

  it('handles txt templates', () => {
    expect(deriveOutputPath('templates/notes.template.txt', 'templates', 'dist')).toBe('dist/notes.txt')
  })
})

describe('getOutputExtension', () => {
  it('returns md for .template.md files', () => {
    expect(getOutputExtension('index.template.md')).toBe('md' as SupportedExtension)
  })

  it('returns json for .template.json files', () => {
    expect(getOutputExtension('data.template.json')).toBe('json' as SupportedExtension)
  })

  it('returns txt for .template.txt files', () => {
    expect(getOutputExtension('notes.template.txt')).toBe('txt' as SupportedExtension)
  })

  it('returns undefined for non-template files', () => {
    expect(getOutputExtension('index.md')).toBeUndefined()
  })

  it('returns undefined for unsupported extensions', () => {
    expect(getOutputExtension('data.template.html')).toBeUndefined()
  })
})
