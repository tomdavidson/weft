import { describe, expect, it } from 'bun:test'
import { toFilePath } from '../domain/types.js'
import { createFakeFileSystem } from '../test/fake-filesystem.js'
import { expectErr, expectOk } from '../test/helpers.js'
import { build } from './build.js'

describe('build', () => {
  it('renders a single file with no transclusions and no context', async () => {
    const fs = createFakeFileSystem({ '/project/entry.md': 'Hello world' })
    const result = await build({
      entryPath: '/project/entry.md',
      contextSources: [],
      cwd: '/project',
      ext: 'md',
    }, fs)
    const content = expectOk(result)
    expect(content).toBe('Hello world')
  })

  it('resolves transclusions then renders template variables', async () => {
    const fs = createFakeFileSystem({
      '/project/entry.md': 'Before ![[child]] After',
      '/project/child.md': '{{name}}',
    })
    const result = await build({
      entryPath: '/project/entry.md',
      contextSources: [{ type: 'inline', key: 'name', value: 'Tom' }],
      cwd: '/project',
      ext: 'md',
    }, fs)
    const content = expectOk(result)
    expect(content).toBe('Before Tom After')
  })

  it('resolves context from a JSON file', async () => {
    const fs = createFakeFileSystem({
      '/project/entry.md': 'Title: {{title}}',
      '/project/ctx.json': '{"title": "My Doc"}',
    })
    const result = await build({
      entryPath: '/project/entry.md',
      contextSources: [{ type: 'jsonFile', path: toFilePath('/project/ctx.json') }],
      cwd: '/project',
      ext: 'md',
    }, fs)
    const content = expectOk(result)
    expect(content).toBe('Title: My Doc')
  })

  it('propagates FileNotFound when entry file is missing', async () => {
    const fs = createFakeFileSystem()
    const result = await build({
      entryPath: '/project/missing.md',
      contextSources: [],
      cwd: '/project',
      ext: 'md',
    }, fs)
    const error = expectErr(result)
    expect(error.type).toBe('FileNotFound')
  })

  it('propagates ContextParseError for invalid JSON context', async () => {
    const fs = createFakeFileSystem({ '/project/entry.md': 'Hello', '/project/bad.json': '{broken' })
    const result = await build({
      entryPath: '/project/entry.md',
      contextSources: [{ type: 'jsonFile', path: toFilePath('/project/bad.json') }],
      cwd: '/project',
      ext: 'md',
    }, fs)
    const error = expectErr(result)
    expect(error.type).toBe('ContextParseError')
  })

  it('propagates FileNotFound when transclusion target is missing', async () => {
    const fs = createFakeFileSystem({ '/project/entry.md': '![[missing]]' })
    const result = await build({
      entryPath: '/project/entry.md',
      contextSources: [],
      cwd: '/project',
      ext: 'md',
    }, fs)
    const error = expectErr(result)
    expect(error.type).toBe('FileNotFound')
  })

  it('handles chained transclusions with context', async () => {
    const fs = createFakeFileSystem({
      '/project/root.md': 'Start ![[a]] End',
      '/project/a.md': '(A ![[b]] A)',
      '/project/b.md': '{{val}}',
    })
    const result = await build({
      entryPath: '/project/root.md',
      contextSources: [{ type: 'inline', key: 'val', value: 'deep' }],
      cwd: '/project',
      ext: 'md',
    }, fs)
    const content = expectOk(result)
    expect(content).toBe('Start (A deep A) End')
  })

  it('applies JSON escaping for .json extension', async () => {
    const fs = createFakeFileSystem({ '/project/entry.json': '{"key": "{{val}}"}' })
    const result = await build({
      entryPath: '/project/entry.json',
      contextSources: [{ type: 'inline', key: 'val', value: 'line1\nline2' }],
      cwd: '/project',
      ext: 'json',
    }, fs)
    const content = expectOk(result)
    expect(content).toBe('{"key": "line1\\nline2"}')
  })

  it('returns the rendered content string on success', async () => {
    const fs = createFakeFileSystem({ '/project/entry.md': 'Result: {{x}}' })
    const result = await build({
      entryPath: '/project/entry.md',
      contextSources: [{ type: 'inline', key: 'x', value: '42' }],
      cwd: '/project',
      ext: 'md',
    }, fs)
    const output = expectOk(result)
    expect(output).toBe('Result: 42')
  })
})
