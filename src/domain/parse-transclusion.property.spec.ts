import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { parseTransclusionRefs } from './parse-transclusion'

// Non-whitespace char that won't break wikilink syntax
const safeChar = fc.char().filter(c => !'[]#\n!'.includes(c) && c.trim().length > 0)

// Targets: at least one visible char, no leading/trailing whitespace
const targetArb = fc.stringOf(safeChar, { minLength: 1, maxLength: 30 })

// Sections: same constraints, no # or brackets
const sectionArb = fc.stringOf(fc.char().filter(c => !'[]\n!'.includes(c) && c.trim().length > 0), {
  minLength: 1,
  maxLength: 20,
})

// Filler text that cannot accidentally form ![[...]]
const fillerArb = fc.stringOf(fc.char().filter(c => !'[]!'.includes(c)), { minLength: 0, maxLength: 40 })

describe('parseTransclusionRefs (property-based)', () => {
  it('round-trips ![[target]]', () => {
    fc.assert(fc.property(targetArb, fillerArb, fillerArb, (target, before, after) => {
      const input = `${before}![[${target}]]${after}`
      const refs = parseTransclusionRefs(input)
      expect(refs).toHaveLength(1)
      expect(refs[0].target).toBe(target)
      expect(refs[0].section).toBeUndefined()
      expect(refs[0].raw).toBe(`![[${target}]]`)
    }))
  })

  it('round-trips ![[target#section]]', () => {
    fc.assert(fc.property(targetArb, sectionArb, fillerArb, fillerArb, (target, section, before, after) => {
      const input = `${before}![[${target}#${section}]]${after}`
      const refs = parseTransclusionRefs(input)
      expect(refs).toHaveLength(1)
      expect(refs[0].target).toBe(target)
      expect(refs[0].section).toBe(section)
      expect(refs[0].raw).toBe(`![[${target}#${section}]]`)
    }))
  })

  it('every ref.raw is a substring of the input', () => {
    fc.assert(fc.property(fc.string({ maxLength: 200 }), input => {
      const refs = parseTransclusionRefs(input)
      for (const ref of refs) {
        expect(input).toContain(ref.raw)
      }
    }))
  })

  it('never throws on arbitrary input', () => {
    fc.assert(fc.property(fc.string({ maxLength: 500 }), input => {
      expect(() => parseTransclusionRefs(input)).not.toThrow()
    }))
  })

  it('ref count matches constructed pattern count', () => {
    fc.assert(fc.property(fc.array(targetArb, { minLength: 0, maxLength: 5 }), fillerArb, (targets, sep) => {
      const input = targets.map(t => `${sep}![[${t}]]`).join(sep)
      const refs = parseTransclusionRefs(input)
      expect(refs).toHaveLength(targets.length)
    }))
  })

  it('ignores non-transclusion wikilinks [[ref]]', () => {
    fc.assert(fc.property(targetArb, fillerArb, (target, filler) => {
      const input = `${filler}[[${target}]]${filler}`
      const refs = parseTransclusionRefs(input)
      expect(refs).toHaveLength(0)
    }))
  })

  it('returns refs in order of appearance', () => {
    fc.assert(fc.property(fc.array(targetArb, { minLength: 2, maxLength: 5 }), targets => {
      const input = targets.map(t => `text ![[${t}]]`).join(' ')
      const refs = parseTransclusionRefs(input)
      expect(refs).toHaveLength(targets.length)
      for (let i = 0; i < refs.length; i++) {
        expect(refs[i].target).toBe(targets[i])
      }
    }))
  })

  it('bracket-free input yields no refs', () => {
    fc.assert(
      fc.property(fc.stringOf(fc.char().filter(c => !'[]!'.includes(c)), { maxLength: 100 }), input => {
        expect(parseTransclusionRefs(input)).toHaveLength(0)
      }),
    )
  })
})
