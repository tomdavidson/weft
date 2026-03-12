import { describe, expect, it } from 'bun:test'
import { expectErr, expectOk } from '../test/helpers.js'
import { parseArgs } from './parse-args.js'

describe('parseArgs', () => {
  it('parses minimal args: entry and output', () => {
    const result = parseArgs(['entry.md', '-o', 'out.md'])
    const opts = expectOk(result)
    expect(opts.entryPath).toBe('entry.md')
    expect(opts.outputPath).toBe('out.md')
    expect(opts.contextSources).toEqual([])
    expect(opts.ext).toBe('md')
  })

  it('parses --output as alias for -o', () => {
    const result = parseArgs(['entry.md', '--output', 'out.txt'])
    const opts = expectOk(result)
    expect(opts.outputPath).toBe('out.txt')
    expect(opts.ext).toBe('txt')
  })

  it('parses inline context with -c key=value', () => {
    const result = parseArgs(['entry.md', '-o', 'out.md', '-c', 'name=World'])
    const opts = expectOk(result)
    expect(opts.contextSources).toEqual([{ type: 'inline', key: 'name', value: 'World' }])
  })

  it('parses multiple -c flags', () => {
    const result = parseArgs(['entry.md', '-o', 'out.md', '-c', 'a=1', '-c', 'b=2'])
    const opts = expectOk(result)
    expect(opts.contextSources.length).toBe(2)
    expect(opts.contextSources[0]).toEqual({ type: 'inline', key: 'a', value: '1' })
    expect(opts.contextSources[1]).toEqual({ type: 'inline', key: 'b', value: '2' })
  })

  it('parses --json for JSON context file', () => {
    const result = parseArgs(['entry.md', '-o', 'out.md', '--json', 'ctx.json'])
    const opts = expectOk(result)
    expect(opts.contextSources.length).toBe(1)
    expect(opts.contextSources[0].type).toBe('jsonFile')
  })

  it('parses --env for env context file', () => {
    const result = parseArgs(['entry.md', '-o', 'out.md', '--env', 'vars.env'])
    const opts = expectOk(result)
    expect(opts.contextSources.length).toBe(1)
    expect(opts.contextSources[0].type).toBe('envFile')
  })

  it('parses --cwd to set working directory', () => {
    const result = parseArgs(['entry.md', '-o', 'out.md', '--cwd', '/my/dir'])
    const opts = expectOk(result)
    expect(opts.cwd).toBe('/my/dir')
  })

  it('auto-detects extension from output filename', () => {
    const result = parseArgs(['entry.json', '-o', 'out.json'])
    const opts = expectOk(result)
    expect(opts.ext).toBe('json')
  })

  it('defaults to md for unsupported extensions', () => {
    const result = parseArgs(['entry.yaml', '-o', 'out.yaml'])
    const opts = expectOk(result)
    expect(opts.ext).toBe('md')
  })

  it('returns InvalidArgs when entry is missing', () => {
    const result = parseArgs(['-o', 'out.md'])
    const error = expectErr(result)
    expect(error.type).toBe('InvalidArgs')
  })

  it('defaults output to undefined when not provided', () => {
    const result = parseArgs(['entry.md'])
    const args = expectOk(result)
    expect(args.outputPath).toBeUndefined()
    expect(args.ext).toBe('md')
  })

  it('returns InvalidArgs for -c without equals sign', () => {
    const result = parseArgs(['entry.md', '-o', 'out.md', '-c', 'noequals'])
    const error = expectErr(result)
    expect(error.type).toBe('InvalidArgs')
  })

  it('handles value with equals sign in -c', () => {
    const result = parseArgs(['entry.md', '-o', 'out.md', '-c', 'eq=a=b'])
    const opts = expectOk(result)
    expect(opts.contextSources[0]).toEqual({ type: 'inline', key: 'eq', value: 'a=b' })
  })

  it('preserves ordering of mixed context sources', () => {
    const result = parseArgs([
      'entry.md',
      '-o',
      'out.md',
      '--json',
      'base.json',
      '-c',
      'name=override',
      '--env',
      'extra.env',
    ])
    const opts = expectOk(result)
    expect(opts.contextSources.length).toBe(3)
    expect(opts.contextSources[0].type).toBe('jsonFile')
    expect(opts.contextSources[1].type).toBe('inline')
    expect(opts.contextSources[2].type).toBe('envFile')
  })
})
