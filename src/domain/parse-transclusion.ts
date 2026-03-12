import { err, ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import type { TransclusionRef } from './types.js'

const TRANSCLUSION_RE = /!\[\[(?<target>[^\]#]+?)(?:#(?<section>[^\]]+?))?\]\]/g

const getGroup = (match: RegExpMatchArray, name: string): string | undefined => match.groups?.[name]?.trim()

const nonEmpty = (value: string | undefined): string | undefined =>
  value === undefined || value === '' ? undefined : value

const toRef = (match: RegExpMatchArray): TransclusionRef => ({
  raw: match[0],
  target: getGroup(match, 'target') ?? '',
  section: nonEmpty(getGroup(match, 'section')),
})

export const parseTransclusionRefs = (content: string): readonly TransclusionRef[] =>
  Array.from(content.matchAll(TRANSCLUSION_RE)).map(toRef)

type ParsedHeading = { readonly level: number; readonly title: string }

const HEADING_RE = /^(?<hashes>#{1,6})\s+(?<title>.*)$/

const parseHeading = (line: string): ParsedHeading | undefined => {
  const match = HEADING_RE.exec(line.trim())
  return match?.groups ?
    { level: match.groups.hashes.length, title: match.groups.title.trim().toLowerCase() } :
    undefined
}

const findStartIndex = (lines: readonly string[], target: string): number =>
  lines.findIndex(line => parseHeading(line)?.title === target)

const findEndIndex = (lines: readonly string[], startIndex: number, startLevel: number): number => {
  const endOffset = lines.slice(startIndex + 1).findIndex(line => {
    const parsed = parseHeading(line)
    return parsed !== undefined && parsed.level <= startLevel
  })
  return endOffset === -1 ? lines.length : startIndex + 1 + endOffset
}

export const extractSection = (
  content: string,
  heading: string,
): Result<string, { readonly type: 'SectionNotFound'; readonly heading: string }> => {
  const lines = content.split('\n')
  const target = heading.trim().toLowerCase()
  const startIndex = findStartIndex(lines, target)
  if (startIndex === -1) return err({ type: 'SectionNotFound', heading })

  const startHeading = parseHeading(lines[startIndex])
  if (!startHeading) return err({ type: 'SectionNotFound', heading })

  const endIndex = findEndIndex(lines, startIndex, startHeading.level)
  return ok(lines.slice(startIndex, endIndex).join('\n'))
}
