import { describe, expect, it } from 'bun:test'
import { expectOk } from '../test/helpers.js'
import { resolveTransclusions } from './resolve.js'

const NL = String.fromCharCode(10)

describe('resolveTransclusions', () => {
  it('returns content unchanged when no transclusion refs', () => {
    const fileMap = new Map([['/root.md', 'Hello world']])
    const result = resolveTransclusions({ filename: '/root.md', fileMap }, {
      vaultRoot: '/vault',
      cwd: '/project',
    })
    expect(expectOk(result)).toBe('Hello world')
  })

  it('resolves a single-level transclusion', () => {
    const fileMap = new Map([['/vault/root.md', 'Before ![[child]] After'], [
      '/vault/child.md',
      'Child content',
    ]])
    const result = resolveTransclusions({ filename: '/vault/root.md', fileMap }, {
      vaultRoot: '/vault',
      cwd: '/project',
    })
    expect(expectOk(result)).toBe('Before Child content After')
  })

  it('resolves nested transclusions depth-first', () => {
    const fileMap = new Map([['/vault/root.md', '![[child]]'], ['/vault/child.md', '![[grandchild]]'], [
      '/vault/grandchild.md',
      'deep',
    ]])
    const result = resolveTransclusions({ filename: '/vault/root.md', fileMap }, {
      vaultRoot: '/vault',
      cwd: '/project',
    })
    expect(expectOk(result)).toBe('deep')
  })

  it('deduplicates: second reference to same file inlines empty string', () => {
    const fileMap = new Map([['/vault/root.md', '![[shared]] then ![[shared]]'], [
      '/vault/shared.md',
      'once',
    ]])
    const result = resolveTransclusions({ filename: '/vault/root.md', fileMap }, {
      vaultRoot: '/vault',
      cwd: '/project',
    })
    expect(expectOk(result)).toBe('once then ')
  })

  it('detects cycle A->B->A and returns CycleDetected', () => {
    const fileMap = new Map([['/vault/a.md', '![[b]]'], ['/vault/b.md', '![[a]]']])
    const result = resolveTransclusions({ filename: '/vault/a.md', fileMap }, {
      vaultRoot: '/vault',
      cwd: '/project',
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.type).toBe('CycleDetected')
    }
  })

  it('detects self-reference cycle and returns CycleDetected', () => {
    const fileMap = new Map([['/vault/self.md', '![[self]]']])
    const result = resolveTransclusions({ filename: '/vault/self.md', fileMap }, {
      vaultRoot: '/vault',
      cwd: '/project',
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.type).toBe('CycleDetected')
    }
  })

  it('returns FileNotFound when referenced file is not in map', () => {
    const fileMap = new Map([['/vault/root.md', '![[missing]]']])
    const result = resolveTransclusions({ filename: '/vault/root.md', fileMap }, {
      vaultRoot: '/vault',
      cwd: '/project',
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.type).toBe('FileNotFound')
    }
  })

  it('preserves surrounding text around transclusion refs', () => {
    const fileMap = new Map([['/vault/root.md', 'alpha ![[child]] beta'], ['/vault/child.md', 'middle']])
    const result = resolveTransclusions({ filename: '/vault/root.md', fileMap }, {
      vaultRoot: '/vault',
      cwd: '/project',
    })
    expect(expectOk(result)).toBe('alpha middle beta')
  })

  it('handles section transclusion via heading extraction', () => {
    const content = ['# Intro', 'intro text', '## Details', 'detail content', '## Other', 'other content']
      .join(NL)
    const fileMap = new Map([['/vault/root.md', '![[doc#Details]]'], ['/vault/doc.md', content]])
    const result = resolveTransclusions({ filename: '/vault/root.md', fileMap }, {
      vaultRoot: '/vault',
      cwd: '/project',
    })
    const resolved = expectOk(result)
    expect(resolved).toContain('detail content')
    expect(resolved).not.toContain('other content')
    expect(resolved).not.toContain('intro text')
  })

  it('leaves non-transclusion wikilinks untouched', () => {
    const fileMap = new Map([['/vault/root.md', 'See [[other-page]] for info']])
    const result = resolveTransclusions({ filename: '/vault/root.md', fileMap }, {
      vaultRoot: '/vault',
      cwd: '/project',
    })
    expect(expectOk(result)).toBe('See [[other-page]] for info')
  })

  it('handles diamond dependency (A->B, A->C, B->D, C->D) with dedup', () => {
    const fileMap = new Map([['/vault/a.md', '![[b]] ![[c]]'], ['/vault/b.md', '![[d]]'], [
      '/vault/c.md',
      '![[d]]',
    ], ['/vault/d.md', 'shared']])
    const result = resolveTransclusions({ filename: '/vault/a.md', fileMap }, {
      vaultRoot: '/vault',
      cwd: '/project',
    })
    const resolved = expectOk(result)
    const sharedCount = resolved.split('shared').length - 1
    expect(sharedCount).toBe(1)
  })
})
