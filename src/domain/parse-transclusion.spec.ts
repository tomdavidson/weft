import { describe, expect, it } from 'bun:test'
import { expectErr, expectOk } from '../test/helpers.js'
import { extractSection, parseTransclusionRefs } from './parse-transclusion.js'

describe('parseTransclusionRefs', () => {
  it('extracts a single ref from surrounding text', () => {
    const refs = parseTransclusionRefs('Hello ![[file]] world')
    expect(refs).toEqual([{ raw: '![[file]]', target: 'file', section: undefined }])
  })

  it('extracts ref with heading section', () => {
    const refs = parseTransclusionRefs('![[file#heading]]')
    expect(refs).toEqual([{ raw: '![[file#heading]]', target: 'file', section: 'heading' }])
  })

  it('extracts ref with explicit extension', () => {
    const refs = parseTransclusionRefs('![[file.md]]')
    expect(refs).toEqual([{ raw: '![[file.md]]', target: 'file.md', section: undefined }])
  })

  it('returns empty array when no refs', () => {
    expect(parseTransclusionRefs('no refs here')).toEqual([])
  })

  it('ignores non-transclusion wikilinks', () => {
    expect(parseTransclusionRefs('[[not-transclusion]]')).toEqual([])
  })

  it('extracts multiple refs in order', () => {
    const refs = parseTransclusionRefs('start ![[a]] middle ![[b#sec]] end')
    expect(refs).toEqual([{ raw: '![[a]]', target: 'a', section: undefined }, {
      raw: '![[b#sec]]',
      target: 'b',
      section: 'sec',
    }])
  })

  it('handles ref with relative path', () => {
    const refs = parseTransclusionRefs('![[../atoms/context-passing]]')
    expect(refs).toEqual([{
      raw: '![[../atoms/context-passing]]',
      target: '../atoms/context-passing',
      section: undefined,
    }])
  })

  it('trims whitespace from target and section', () => {
    const refs = parseTransclusionRefs('![[  file  #  heading  ]]')
    expect(refs).toEqual([{ raw: '![[  file  #  heading  ]]', target: 'file', section: 'heading' }])
  })
})

describe('extractSection', () => {
  const doc = [
    '# Intro',
    'Intro text',
    '',
    '## Section 1',
    'Content 1',
    '',
    '### Subsection',
    'Sub content',
    '',
    '## Section 2',
    'Content 2',
  ].join('\n')

  it('extracts heading to next same-or-higher-level heading', () => {
    const result = expectOk(extractSection(doc, 'Section 1'))
    expect(result).toBe('## Section 1\nContent 1\n\n### Subsection\nSub content\n')
  })

  it('extracts subsection to next same-or-higher-level heading', () => {
    const result = expectOk(extractSection(doc, 'Subsection'))
    expect(result).toBe('### Subsection\nSub content\n')
  })

  it('extracts until EOF when no subsequent heading', () => {
    const result = expectOk(extractSection(doc, 'Section 2'))
    expect(result).toBe('## Section 2\nContent 2')
  })

  it('returns SectionNotFound for missing heading', () => {
    const error = expectErr(extractSection(doc, 'Missing'))
    expect(error.type).toBe('SectionNotFound')
  })

  it('is case-insensitive on heading text', () => {
    const result = extractSection(doc, ' sEctiON 1  ')
    expect(result.isOk()).toBe(true)
  })

  it('includes the heading line itself in the output', () => {
    const result = expectOk(extractSection(doc, 'Intro'))
    expect(result.startsWith('# Intro')).toBe(true)
  })
})
