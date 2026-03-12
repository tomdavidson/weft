import { describe, expect, it } from 'bun:test'
import { renderWithMustache } from '../infrastructure/mustache-adapter.js'
import { expectOk } from '../test/helpers.js'
import { renderTemplate, selectEscapeFunction } from './render.js'

const BS = String.fromCharCode(92)
const NL = String.fromCharCode(10)
const CR = String.fromCharCode(13)
const TAB = String.fromCharCode(9)
const DQ = String.fromCharCode(34)

const render = renderTemplate(renderWithMustache)

describe('selectEscapeFunction', () => {
  it('returns identity for md (input === output)', () => {
    const escape = selectEscapeFunction('md')
    const input = 'hello <world> ' + DQ + 'quoted' + DQ
    expect(escape(input)).toBe(input)
  })

  it('returns identity for txt', () => {
    const escape = selectEscapeFunction('txt')
    const input = 'line1' + NL + 'line2'
    expect(escape(input)).toBe(input)
  })

  it('escapes backslash for json', () => {
    const escape = selectEscapeFunction('json')
    const input = 'back' + BS + 'slash'
    const expected = 'back' + BS + BS + 'slash'
    expect(escape(input)).toBe(expected)
  })

  it('escapes double quotes for json', () => {
    const escape = selectEscapeFunction('json')
    const input = 'say ' + DQ + 'hello' + DQ
    const expected = 'say ' + BS + DQ + 'hello' + BS + DQ
    expect(escape(input)).toBe(expected)
  })

  it('escapes newlines for json', () => {
    const escape = selectEscapeFunction('json')
    const input = 'line1' + NL + 'line2'
    const expected = 'line1' + BS + 'nline2'
    expect(escape(input)).toBe(expected)
  })

  it('escapes carriage returns for json', () => {
    const escape = selectEscapeFunction('json')
    const input = 'line1' + CR + 'line2'
    const expected = 'line1' + BS + 'rline2'
    expect(escape(input)).toBe(expected)
  })

  it('escapes tabs for json', () => {
    const escape = selectEscapeFunction('json')
    const input = 'col1' + TAB + 'col2'
    const expected = 'col1' + BS + 'tcol2'
    expect(escape(input)).toBe(expected)
  })
})

describe('renderTemplate', () => {
  it('renders simple variable substitution for md', () => {
    const result = render('Hello {{name}}', { name: 'World' }, 'md')
    expect(expectOk(result)).toBe('Hello World')
  })

  it('passes through raw triple-stache unescaped for md', () => {
    const result = render('{{{name}}}', { name: '<script>' }, 'md')
    expect(expectOk(result)).toBe('<script>')
  })

  it('escapes json values with json escape function', () => {
    const v = 'line' + NL + '1' + TAB + '2'
    const result = render('{' + DQ + 'k' + DQ + ': ' + DQ + '{{v}}' + DQ + '}', { v }, 'json')
    const expected = '{' + DQ + 'k' + DQ + ': ' + DQ + 'line' + BS + 'n1' + BS + 't2' + DQ + '}'
    expect(expectOk(result)).toBe(expected)
  })

  it('passes through raw triple-stache unescaped for json', () => {
    const result = render('{{{raw}}}', { raw: 'anything' }, 'json')
    expect(expectOk(result)).toBe('anything')
  })

  it('renders missing variable as empty string', () => {
    const result = render('{{missing}}', {}, 'md')
    expect(expectOk(result)).toBe('')
  })

  it('renders section blocks when truthy', () => {
    const result = render('{{#show}}visible{{/show}}', { show: 'yes' }, 'md')
    expect(expectOk(result)).toBe('visible')
  })

  it('renders inverted section when falsy', () => {
    const result = render('{{^show}}hidden{{/show}}', {}, 'md')
    expect(expectOk(result)).toBe('hidden')
  })

  it('hides section block when falsy', () => {
    const result = render('{{#show}}visible{{/show}}', {}, 'md')
    expect(expectOk(result)).toBe('')
  })

  it('renders txt with identity escape', () => {
    const result = render('Hello {{name}}', { name: '<b>World</b>' }, 'txt')
    expect(expectOk(result)).toBe('Hello <b>World</b>')
  })
})
