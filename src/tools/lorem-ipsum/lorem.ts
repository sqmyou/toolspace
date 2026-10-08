/** Lorem ipsum generation with a swappable word source. */

export const CLASSIC_WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore ' +
  'et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ' +
  'ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat ' +
  'nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt ' +
  'mollit anim id est laborum'
).split(' ')

export const SOFTWARE_WORDS = (
  'deploy commit branch merge rebase revert pipeline build artifact container image cluster node ' +
  'request response latency throughput cache invalidate schema migrate rollback replica shard index ' +
  'query transaction idempotent retry backoff timeout endpoint payload auth token session middleware ' +
  'runtime compiler linter formatter refactor test coverage snapshot'
).split(' ')

export type WordSource = 'classic' | 'software'

export function wordsFor(source: WordSource): string[] {
  return source === 'software' ? SOFTWARE_WORDS : CLASSIC_WORDS
}

export type Rng = () => number

export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** Build one sentence: capitalised, with a random length and a full stop. */
export function sentence(rng: Rng, words: string[], min = 6, max = 14): string {
  const count = randomInt(rng, min, max)
  const parts = Array.from({ length: count }, () => words[randomInt(rng, 0, words.length - 1)])
  const text = parts.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1) + '.'
}

export function paragraph(rng: Rng, words: string[], sentences = 4): string {
  return Array.from({ length: sentences }, () => sentence(rng, words)).join(' ')
}

export interface LoremOptions {
  source: WordSource
  unit: 'paragraphs' | 'sentences' | 'words'
  count: number
  classicOpening: boolean
  rng?: Rng
}

export function generateLorem(options: LoremOptions): string {
  const rng = options.rng ?? Math.random
  const words = wordsFor(options.source)
  const count = Math.max(1, Math.min(200, Math.floor(options.count)))

  if (options.unit === 'words') {
    return Array.from({ length: count }, () => words[randomInt(rng, 0, words.length - 1)]).join(' ')
  }

  if (options.unit === 'sentences') {
    const sentences = Array.from({ length: count }, () => sentence(rng, words))
    if (options.classicOpening) sentences[0] = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    return sentences.join(' ')
  }

  const paragraphs = Array.from({ length: count }, () => paragraph(rng, words))
  if (options.classicOpening) paragraphs[0] = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
  return paragraphs.join('\n\n')
}
