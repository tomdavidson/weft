import { describe, expect, it } from 'bun:test'
import { createFakeFileSystem } from '../test/fake-filesystem.js'
import { expectErr, expectOk } from '../test/helpers.js'
import { loadFileGraph } from './load-graph.js'

describe('loadFileGraph', () => {
  it('loads a single file with no transclusions', async () => {
    const fs = createFakeFileSystem({ '/vault/root.md': 'Hello world' })
    const result = await loadFileGraph('/vault/root.md', '/vault', { cwd: '/project', fs })
    const map = expectOk(result)
    expect(map.size).toBe(1)
    expect(map.get('/vault/root.md')).toBe('Hello world')
  })

  it('discovers and loads a child file', async () => {
    const fs = createFakeFileSystem({
      '/vault/root.md': 'Before ![[child]] After',
      '/vault/child.md': 'Child content',
    })
    const result = await loadFileGraph('/vault/root.md', '/vault', { cwd: '/project', fs })
    const map = expectOk(result)
    expect(map.size).toBe(2)
    expect(map.has('/vault/root.md')).toBe(true)
    expect(map.has('/vault/child.md')).toBe(true)
  })

  it('discovers chain root -> child -> grandchild', async () => {
    const fs = createFakeFileSystem({
      '/vault/root.md': '![[child]]',
      '/vault/child.md': '![[grandchild]]',
      '/vault/grandchild.md': 'deep content',
    })
    const result = await loadFileGraph('/vault/root.md', '/vault', { cwd: '/project', fs })
    const map = expectOk(result)
    expect(map.size).toBe(3)
    expect(map.has('/vault/grandchild.md')).toBe(true)
  })

  it('loads diamond dependency with four unique files', async () => {
    const fs = createFakeFileSystem({
      '/vault/root.md': '![[a]] ![[b]]',
      '/vault/a.md': '![[c]]',
      '/vault/b.md': '![[c]]',
      '/vault/c.md': 'shared',
    })
    const result = await loadFileGraph('/vault/root.md', '/vault', { cwd: '/project', fs })
    const map = expectOk(result)
    expect(map.size).toBe(4)
  })

  it('handles cycle A->B->A without infinite loop', async () => {
    const fs = createFakeFileSystem({ '/vault/a.md': '![[b]]', '/vault/b.md': '![[a]]' })
    const result = await loadFileGraph('/vault/a.md', '/vault', { cwd: '/project', fs })
    const map = expectOk(result)
    expect(map.size).toBe(2)
    expect(map.has('/vault/a.md')).toBe(true)
    expect(map.has('/vault/b.md')).toBe(true)
  })

  it('returns FileNotFound when a referenced file is missing', async () => {
    const fs = createFakeFileSystem({ '/vault/root.md': '![[missing]]' })
    const result = await loadFileGraph('/vault/root.md', '/vault', { cwd: '/project', fs })
    const error = expectErr(result)
    expect(error.type).toBe('FileNotFound')
  })

  it('resolves refs using two-tier fallback (containing dir then CWD)', async () => {
    const fs = createFakeFileSystem({ '/vault/sub/root.md': '![[shared]]', '/project/shared.md': 'from cwd' })
    const result = await loadFileGraph('/vault/sub/root.md', '/vault/sub', { cwd: '/project', fs })
    const map = expectOk(result)
    expect(map.size).toBe(2)
    expect(map.has('/project/shared.md')).toBe(true)
  })

  it('handles section refs by loading the full file', async () => {
    const fs = createFakeFileSystem({
      '/vault/root.md': '![[doc#Details]]',
      '/vault/doc.md': '# Details\nsome content',
    })
    const result = await loadFileGraph('/vault/root.md', '/vault', { cwd: '/project', fs })
    const map = expectOk(result)
    expect(map.size).toBe(2)
    expect(map.has('/vault/doc.md')).toBe(true)
  })
})
