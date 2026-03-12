import { describe, expect, it } from 'bun:test'
import { buildTransclusionRef } from '../test/builders.js'
import { resolveRefPath } from './resolve-path.js'
import type { TransclusionRef } from './types.js'

const ref = (target: string, section?: string): TransclusionRef => buildTransclusionRef({ target, section })

describe('resolveRefPath', () => {
  it('resolves bare ref relative to containing dir, trying .md first', () => {
    const exists = (p: string) => p === '/vault/molecules/some-file.md'
    const result = resolveRefPath(ref('some-file'), {
      containingDir: '/vault/molecules',
      cwd: '/project',
      fileExists: exists,
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('/vault/molecules/some-file.md')
    }
  })

  it('resolves bare ref trying .json when .md does not exist', () => {
    const exists = (p: string) => p === '/vault/molecules/data.json'
    const result = resolveRefPath(ref('data'), {
      containingDir: '/vault/molecules',
      cwd: '/project',
      fileExists: exists,
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('/vault/molecules/data.json')
    }
  })

  it('resolves bare ref trying .txt when .md and .json do not exist', () => {
    const exists = (p: string) => p === '/vault/molecules/notes.txt'
    const result = resolveRefPath(ref('notes'), {
      containingDir: '/vault/molecules',
      cwd: '/project',
      fileExists: exists,
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('/vault/molecules/notes.txt')
    }
  })

  it('resolves ref with explicit extension without extension search', () => {
    const exists = (p: string) => p === '/vault/molecules/data.json'
    const result = resolveRefPath(ref('data.json'), {
      containingDir: '/vault/molecules',
      cwd: '/project',
      fileExists: exists,
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('/vault/molecules/data.json')
    }
  })

  it('falls back to CWD when containing dir has no match for bare ref', () => {
    const exists = (p: string) => p === '/project/some-file.md'
    const result = resolveRefPath(ref('some-file'), {
      containingDir: '/vault/molecules',
      cwd: '/project',
      fileExists: exists,
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('/project/some-file.md')
    }
  })

  it('falls back to CWD for ref with extension when containing dir fails', () => {
    const exists = (p: string) => p === '/project/data.json'
    const result = resolveRefPath(ref('data.json'), {
      containingDir: '/vault/molecules',
      cwd: '/project',
      fileExists: exists,
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('/project/data.json')
    }
  })

  it('resolves explicit relative path relative to containing dir only', () => {
    const exists = (p: string) => p === '/vault/atoms/context-passing.md'
    const result = resolveRefPath(ref('../atoms/context-passing'), {
      containingDir: '/vault/molecules',
      cwd: '/project',
      fileExists: exists,
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('/vault/atoms/context-passing.md')
    }
  })

  it('does NOT fall back to CWD for explicit relative paths', () => {
    const exists = (p: string) => p === '/project/atoms/context-passing.md'
    const result = resolveRefPath(ref('../atoms/context-passing'), {
      containingDir: '/vault/molecules',
      cwd: '/project',
      fileExists: exists,
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.type).toBe('FileNotFound')
    }
  })

  it('returns FileNotFound when no match in either tier', () => {
    const exists = () => false
    const result = resolveRefPath(ref('missing'), {
      containingDir: '/vault',
      cwd: '/project',
      fileExists: exists,
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.type).toBe('FileNotFound')
    }
  })

  it('handles target with subdirectory path (non-relative)', () => {
    const exists = (p: string) => p === '/vault/sub/deep-file.md'
    const result = resolveRefPath(ref('sub/deep-file'), {
      containingDir: '/vault',
      cwd: '/project',
      fileExists: exists,
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('/vault/sub/deep-file.md')
    }
  })
})
