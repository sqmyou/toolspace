/** Text statistics and common readability scores. */

export interface TextStats {
  characters: number
  charactersNoSpaces: number
  words: number
  sentences: number
  paragraphs: number
  lines: number
  uniqueWords: number
  /** Average word length in characters. */
  averageWordLength: number
  readingSeconds: number
  speakingSeconds: number
  fleschReadingEase: number
  fleschKincaidGrade: number
  gunningFog: number
  longestWord: string
}

/** Split into words, ignoring punctuation. */
export function countWords(text: string): string[] {
  return text.match(/[\p{L}\p{N}''-]+/gu) ?? []
}

export function countSentences(text: string): number {
  const matches = text.match(/[^.!?…]+[.!?…]+/g)
  const trimmed = text.trim()
  if (!matches) return trimmed.length ? 1 : 0
  // Trailing text with no terminator still counts as a sentence.
  const consumed = matches.join('').trim()
  return consumed.length < trimmed.length ? matches.length + 1 : matches.length
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  if (w.length <= 3) return 1
  const cleaned = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
  const groups = cleaned.match(/[aeiouy]{1,2}/g)
  return Math.max(1, groups ? groups.length : 1)
}

export function analyzeText(text: string): TextStats {
  const words = countWords(text)
  const sentences = countSentences(text)
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length
  const lower = words.map((w) => w.toLowerCase())
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0)
  const wordCount = words.length

  const safeWords = Math.max(1, wordCount)
  const safeSentences = Math.max(1, sentences)
  const syllablesPerWord = totalSyllables / safeWords
  const wordsPerSentence = wordCount / safeSentences

  const fleschReadingEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord
  const fleschKincaidGrade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59
  // Gunning Fog: complex words are those with 3+ syllables.
  const complexWords = words.filter((w) => countSyllables(w) >= 3).length
  const gunningFog = 0.4 * (wordsPerSentence + 100 * (complexWords / safeWords))

  const longest = words.reduce((longest, w) => (w.length > longest.length ? w : longest), '')

  return {
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    words: wordCount,
    sentences,
    paragraphs,
    lines: text.split('\n').length,
    uniqueWords: new Set(lower).size,
    averageWordLength: wordCount ? words.reduce((sum, w) => sum + w.length, 0) / wordCount : 0,
    readingSeconds: Math.round((wordCount / 225) * 60),
    speakingSeconds: Math.round((wordCount / 140) * 60),
    fleschReadingEase: wordCount ? fleschReadingEase : 0,
    fleschKincaidGrade: wordCount ? fleschKincaidGrade : 0,
    gunningFog: wordCount ? gunningFog : 0,
    longestWord: longest,
  }
}

/** Human-readable label for a Flesch reading-ease score. */
export function readingEaseLabel(score: number): string {
  if (score >= 90) return 'very easy (5th grade)'
  if (score >= 80) return 'easy (6th grade)'
  if (score >= 70) return 'fairly easy (7th grade)'
  if (score >= 60) return 'standard (8th–9th grade)'
  if (score >= 50) return 'fairly hard (10th–12th)'
  if (score >= 30) return 'hard (college)'
  return 'very hard (college graduate)'
}
