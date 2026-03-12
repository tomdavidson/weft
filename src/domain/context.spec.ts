import { describe, expect, it } from 'bun:test'
import { classifyContextSource, mergeContexts } from './context.js'
import { toFilePath } from './types'
import type { ContextSource } from './types.js'

describe('classifyContextSource', () => {
  it('classifies key=value as inline', () => {
    const result = classifyContextSource('key=value')
    expect(result).toEqual({ type: 'inline', key: 'key', value: 'value' })
  })

  it('splits on first = only for inline', () => {
    const result = classifyContextSource('key=val=ue')
    expect(result).toEqual({ type: 'inline', key: 'key', value: 'val=ue' })
  })

  it('classifies .json file as jsonFile', () => {
    const result = classifyContextSource('./data.json')
    expect(result).toEqual({ type: 'jsonFile', path: toFilePath('./data.json') })
  })

  it('classifies .env file as envFile', () => {
    const result = classifyContextSource('config.env')
    expect(result).toEqual({ type: 'envFile', path: toFilePath('config.env') })
  })

  it('classifies .txt file as envFile', () => {
    const result = classifyContextSource('data.txt')
    expect(result).toEqual({ type: 'envFile', path: toFilePath('data.txt') })
  })

  it('classifies path with directory as jsonFile', () => {
    const result = classifyContextSource('./config/settings.json')
    expect(result).toEqual({ type: 'jsonFile', path: toFilePath('./config/settings.json') })
  })

  it('classifies path with directory as envFile for .env', () => {
    const result = classifyContextSource('./config/vars.env')
    expect(result).toEqual({ type: 'envFile', path: toFilePath('./config/vars.env') })
  })
})

describe('mergeContexts', () => {
  it('returns empty record for empty sources', () => {
    const result = mergeContexts([], new Map())
    expect(result).toEqual({})
  })

  it('merges a single inline source', () => {
    const sources: readonly ContextSource[] = [{ type: 'inline', key: 'name', value: 'World' }]
    const result = mergeContexts(sources, new Map())
    expect(result).toEqual({ name: 'World' })
  })

  it('merges multiple inline sources left-to-right', () => {
    const sources: readonly ContextSource[] = [{ type: 'inline', key: 'a', value: '1' }, {
      type: 'inline',
      key: 'b',
      value: '2',
    }]
    const result = mergeContexts(sources, new Map())
    expect(result).toEqual({ a: '1', b: '2' })
  })

  it('later inline overwrites earlier for same key', () => {
    const sources: readonly ContextSource[] = [{ type: 'inline', key: 'x', value: 'first' }, {
      type: 'inline',
      key: 'x',
      value: 'second',
    }]
    const result = mergeContexts(sources, new Map())
    expect(result).toEqual({ x: 'second' })
  })

  it('merges jsonFile source from resolved map', () => {
    const sources: readonly ContextSource[] = [{ type: 'jsonFile', path: toFilePath('data.json') }]
    const resolved = new Map<string, Record<string, string>>([['data.json', { foo: 'bar', baz: 'qux' }]])
    const result = mergeContexts(sources, resolved)
    expect(result).toEqual({ foo: 'bar', baz: 'qux' })
  })

  it('merges envFile source from resolved map', () => {
    const sources: readonly ContextSource[] = [{ type: 'envFile', path: toFilePath('config.env') }]
    const resolved = new Map<string, Record<string, string>>([['config.env', {
      DB_HOST: 'localhost',
      DB_PORT: '5432',
    }]])
    const result = mergeContexts(sources, resolved)
    expect(result).toEqual({ DB_HOST: 'localhost', DB_PORT: '5432' })
  })

  it('merges mixed sources left-to-right with overwrite', () => {
    const sources: readonly ContextSource[] = [{ type: 'jsonFile', path: toFilePath('base.json') }, {
      type: 'inline',
      key: 'name',
      value: 'override',
    }, { type: 'envFile', path: toFilePath('extra.env') }]
    const resolved = new Map<string, Record<string, string>>([['base.json', {
      name: 'original',
      title: 'Doc',
    }], ['extra.env', { env: 'prod' }]])
    const result = mergeContexts(sources, resolved)
    expect(result).toEqual({ name: 'override', title: 'Doc', env: 'prod' })
  })

  it('skips file source not found in resolved map', () => {
    const sources: readonly ContextSource[] = [{ type: 'jsonFile', path: toFilePath('missing.json') }, {
      type: 'inline',
      key: 'fallback',
      value: 'yes',
    }]
    const result = mergeContexts(sources, new Map())
    expect(result).toEqual({ fallback: 'yes' })
  })
})
