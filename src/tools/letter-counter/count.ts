/**
 * Pure counting logic for the letter counter. No DOM in here, so it is cheap
 * to test.
 *
 * Everything is Unicode-aware: `\p{L}` covers accented letters, Greek,
 * Cyrillic and CJK, and characters are counted as code points rather than
 * UTF-16 units so an emoji counts once instead of twice.
 */

export interface CountResult {
  /** Code points, including whitespace. */
  characters: number
  charactersNoSpaces: number
  letters: number
  digits: number
  punctuation: number
  spaces: number
  words: number
  uniqueWords: number
  sentences: number
  paragraphs: number
  lines: number
  upper: number
  lower: number
  readingSeconds: number
}

/**
 * A word is a run of letters (optionally followed by letters, digits, an
 * apostrophe or a hyphen) or a run of digits on its own. So "don't" is one
 * word, "well-known" is one word, and "42" is a word but "-" is not.
 */
const WORD_RE = /\p{L}[\p{L}\p{N}'\u2019-]*|\p{N}+/gu
const SENTENCE_END = /[.!?\u2026]+(?=\s|$)/g

const LETTER = /\p{L}/u
const NUMBER = /\p{N}/u
const WHITESPACE = /\s/u

export function countText(input: string): CountResult {
  const characters = [...input].length
  const charactersNoSpaces = [...input].filter((char) => !WHITESPACE.test(char)).length

  const words = input.match(WORD_RE) ?? []
  const trimmed = input.trim()

  return {
    characters,
    charactersNoSpaces,
    letters: (input.match(/\p{L}/gu) ?? []).length,
    digits: (input.match(/\p{N}/gu) ?? []).length,
    punctuation: (input.match(/\p{P}/gu) ?? []).length,
    spaces: (input.match(/\s/gu) ?? []).length,
    words: words.length,
    uniqueWords: new Set(words.map((word) => word.toLowerCase())).size,
    sentences: countSentences(input),
    paragraphs: trimmed === '' ? 0 : trimmed.split(/\n\s*\n+/).filter((block) => block.trim() !== '').length,
    lines: input === '' ? 0 : input.split('\n').length,
    upper: (input.match(/\p{Lu}/gu) ?? []).length,
    lower: (input.match(/\p{Ll}/gu) ?? []).length,
    readingSeconds: words.length === 0 ? 0 : Math.round((words.length / 200) * 60),
  }
}

/** Sentences are runs of text closed by `.`, `!`, `?` or `…`, or by the end. */
export function countSentences(input: string): number {
  const trimmed = input.trim()
  if (trimmed === '') return 0
  if (!LETTER.test(trimmed) && !NUMBER.test(trimmed)) return 0
  const parts = trimmed.split(SENTENCE_END).filter((part) => LETTER.test(part) || NUMBER.test(part))
  return Math.max(parts.length, 1)
}

export interface LetterCount {
  letter: string
  count: number
}

/** Most-used letters first, ties broken alphabetically. */
export function letterFrequency(input: string, limit = 12): LetterCount[] {
  const counts = new Map<string, number>()
  for (const char of input.toLowerCase()) {
    if (!LETTER.test(char)) continue
    counts.set(char, (counts.get(char) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([letter, count]) => ({ letter, count }))
    .sort((a, b) => b.count - a.count || a.letter.localeCompare(b.letter))
    .slice(0, limit)
}

export type LimitKind = 'char' | 'word'

export interface PlatformLimit {
  platform: string
  field: string
  limit: number
  kind: LimitKind
  note: string
}

/**
 * Published limits for the fields people actually hit. Character limits are
 * the ones the platforms enforce on submission; the word limits are the
 * readability targets that tools like Yoast and Rank Math warn about.
 */
export const LIMITS: PlatformLimit[] = [
  { platform: 'Meta', field: 'Title tag', limit: 60, kind: 'char', note: 'Google truncates around 60 characters' },
  { platform: 'Meta', field: 'Meta description', limit: 160, kind: 'char', note: 'Anything past this is cut in results' },
  { platform: 'Google', field: 'Title (pixel-safe)', limit: 55, kind: 'char', note: 'Roughly 600px wide at 16px Arial' },
  { platform: 'Google', field: 'Description', limit: 155, kind: 'char', note: 'Desktop snippet width' },
  { platform: 'Twitter / X', field: 'Post', limit: 280, kind: 'char', note: 'Standard (non-premium) accounts' },
  { platform: 'Twitter / X', field: 'Username', limit: 15, kind: 'char', note: 'Also known as a handle' },
  { platform: 'Twitter / X', field: 'Bio', limit: 160, kind: 'char', note: 'Profile description' },
  { platform: 'Instagram', field: 'Caption', limit: 2200, kind: 'char', note: 'Truncated to 125 in the feed' },
  { platform: 'Instagram', field: 'Username', limit: 30, kind: 'char', note: 'Letters, numbers, periods and underscores' },
  { platform: 'Facebook', field: 'Post', limit: 63206, kind: 'char', note: 'Practical limit before the "see more" fold' },
  { platform: 'Facebook', field: 'Page name', limit: 75, kind: 'char', note: 'Displayed under the profile picture' },
  { platform: 'YouTube', field: 'Video title', limit: 100, kind: 'char', note: 'Shown in search and suggested' },
  { platform: 'YouTube', field: 'Description', limit: 5000, kind: 'char', note: 'Only the first ~157 show above the fold' },
  { platform: 'Snapchat', field: 'Display name', limit: 30, kind: 'char', note: 'Shown in chat and stories' },
  { platform: 'Pinterest', field: 'Pin description', limit: 500, kind: 'char', note: 'Truncated to about 50 in the grid' },
  { platform: 'Pinterest', field: 'Profile bio', limit: 160, kind: 'char', note: 'Shown on the profile page' },
  { platform: 'SEO', field: 'Body copy target', limit: 300, kind: 'word', note: 'Shortest length that usually ranks' },
  { platform: 'SEO', field: 'Blog post target', limit: 1500, kind: 'word', note: 'Common long-form target' },
]

export type LimitState = 'ok' | 'near' | 'over'

export interface LimitStatus extends PlatformLimit {
  used: number
  ratio: number
  state: LimitState
  remaining: number
}

/** `near` starts at 90% of the limit, which is where editors usually panic. */
export function evaluateLimit(limit: PlatformLimit, counts: CountResult): LimitStatus {
  const used = limit.kind === 'char' ? counts.characters : counts.words
  const ratio = limit.limit === 0 ? 0 : used / limit.limit
  const state: LimitState = used > limit.limit ? 'over' : ratio >= 0.9 ? 'near' : 'ok'
  return { ...limit, used, ratio, state, remaining: limit.limit - used }
}

export function evaluateLimits(counts: CountResult, platform = ''): LimitStatus[] {
  const pool = platform === '' ? LIMITS : LIMITS.filter((limit) => limit.platform === platform)
  return pool.map((limit) => evaluateLimit(limit, counts))
}

export function limitPlatforms(): string[] {
  return [...new Set(LIMITS.map((limit) => limit.platform))]
}

/** "1m 30s" / "45s" / "2h 05m" — compact, for the readout. */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const rest = seconds % 60
    return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
  }
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
}
