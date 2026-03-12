import { describe, expect, it } from 'bun:test'
import { err, ok } from 'neverthrow'
import { expectErr, expectOk } from './helpers.js'

describe('expectOk', () => {
  it('returns the value when result is Ok', () => {
    const result = ok<string, string>('hello')
    const value = expectOk(result)
    expect(value).toBe('hello')
  })

  it('throws when result is Err', () => {
    const result = err<string>('boom')
    expect(() => expectOk(result)).toThrow()
  })
})

describe('expectErr', () => {
  it('returns the error when result is Err', () => {
    const result = err<string>('boom')
    const error = expectErr(result)
    expect(error).toBe('boom')
  })

  it('throws when result is Ok', () => {
    const result = ok<string, string>('hello')
    expect(() => expectErr(result)).toThrow()
  })
})
