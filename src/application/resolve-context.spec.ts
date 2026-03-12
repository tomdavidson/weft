import { describe, expect, it } from 'bun:test'
import { toFilePath } from '../domain/types'
import type { ContextSource } from '../domain/types.js'
import { createFakeFileSystem } from '../test/fake-filesystem.js'
import { expectErr, expectOk } from '../test/helpers.js'
import { resolveContext } from './resolve-context.js'

describe('resolveContext', () => {
  it('resolves inline source directly', async () => {
    const fs = createFakeFileSystem()
    const sources: readonly ContextSource[] = [{ type: 'inline', key: 'name', value: 'World' }]
    const result = await resolveContext(sources, fs)
    const ctx = expectOk(result)
    expect(ctx).toEqual({ name: 'World' })
  })

  it('resolves JSON file source by reading and parsing', async () => {
    const fs = createFakeFileSystem({ '/project/data.json': '{"title": "Doc", "version": "1.0"}' })
    const sources: readonly ContextSource[] = [{ type: 'jsonFile', path: toFilePath('/project/data.json') }]
    const result = await resolveContext(sources, fs)
    const ctx = expectOk(result)
    expect(ctx).toEqual({ title: 'Doc', version: '1.0' })
  })

  it('resolves env file source by reading and parsing key=value lines', async () => {
    const NL = String.fromCharCode(10)
    const fs = createFakeFileSystem({ '/project/config.env': 'DB_HOST=localhost' + NL + 'DB_PORT=5432' })
    const sources: readonly ContextSource[] = [{ type: 'envFile', path: toFilePath('/project/config.env') }]
    const result = await resolveContext(sources, fs)
    const ctx = expectOk(result)
    expect(ctx).toEqual({ DB_HOST: 'localhost', DB_PORT: '5432' })
  })

  it('env file skips blank lines and comments', async () => {
    const NL = String.fromCharCode(10)
    const content = '# comment' + NL + NL + 'key=val' + NL + '# another'
    const fs = createFakeFileSystem({ '/project/vars.env': content })
    const sources: readonly ContextSource[] = [{ type: 'envFile', path: toFilePath('/project/vars.env') }]
    const result = await resolveContext(sources, fs)
    const ctx = expectOk(result)
    expect(ctx).toEqual({ key: 'val' })
  })

  it('merges multiple sources left-to-right with overwrite', async () => {
    const fs = createFakeFileSystem({ '/project/base.json': '{"name": "original", "title": "Doc"}' })
    const sources: readonly ContextSource[] = [{ type: 'jsonFile', path: toFilePath('/project/base.json') }, {
      type: 'inline',
      key: 'name',
      value: 'override',
    }]
    const result = await resolveContext(sources, fs)
    const ctx = expectOk(result)
    expect(ctx).toEqual({ name: 'override', title: 'Doc' })
  })

  it('returns ContextParseError for invalid JSON file', async () => {
    const fs = createFakeFileSystem({ '/project/bad.json': '{not valid json' })
    const sources: readonly ContextSource[] = [{ type: 'jsonFile', path: toFilePath('/project/bad.json') }]
    const result = await resolveContext(sources, fs)
    const error = expectErr(result)
    expect(error.type).toBe('ContextParseError')
  })

  it('returns FileNotFound for missing file source', async () => {
    const fs = createFakeFileSystem()
    const sources: readonly ContextSource[] = [{
      type: 'jsonFile',
      path: toFilePath('/project/missing.json'),
    }]
    const result = await resolveContext(sources, fs)
    const error = expectErr(result)
    expect(error.type).toBe('FileNotFound')
  })

  it('returns empty context for empty sources', async () => {
    const fs = createFakeFileSystem()
    const result = await resolveContext([], fs)
    const ctx = expectOk(result)
    expect(ctx).toEqual({})
  })
})
