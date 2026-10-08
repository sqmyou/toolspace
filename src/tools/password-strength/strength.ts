/**
 * Password strength estimation.
 *
 * Pure and offline. The estimate starts from the Shannon entropy of the
 * character pool, then takes the *worst* case across the ways an attacker could
 * describe the password: as a whole, as a repeated or sequential unit, or as a
 * keypad pattern. That keeps "aaaaaaaa" and "qwerty123" from scoring well.
 */

export interface StrengthResult {
  /** Guesses needed to crack the password, on a log10 scale. */
  guessesLog10: number
  /** Short label such as "weak" or "strong". */
  label: 'very weak' | 'weak' | 'fair' | 'strong' | 'very strong'
  /** 0-4, suitable for a meter width. */
  score: number
  /** Estimated Shannon entropy in bits. */
  entropyBits: number
  /** Human-readable estimate at an offline attack rate, or null when instant. */
  crackTime: string
  /** Concrete advice for improving the password. */
  suggestions: string[]
  /** Things that noticeably weaken the password. */
  weaknesses: string[]
}

const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', 'qwerty', '111111', '123123', 'abc123',
  'password1', 'letmein', 'welcome', 'monkey', 'dragon', 'iloveyou', 'admin',
  'login', 'princess', 'sunshine', 'football', 'master', 'shadow', 'superman',
  'michael', 'trustno1', 'hunter2', 'passw0rd', 'root', 'toor', 'qwerty123',
])

const COMMON_WORDS = [
  'password', 'admin', 'welcome', 'letmein', 'secret', 'love', 'monkey',
  'dragon', 'master', 'shadow', 'summer', 'winter', 'spring', 'autumn',
  'football', 'soccer', 'baseball', 'princess', 'sunshine', 'qwerty',
]

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890']
const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', '0123456789']

/** Number of distinct characters an attacker would have to try. */
function characterPool(password: string): number {
  let pool = 0
  if (/[a-z]/.test(password)) pool += 26
  if (/[A-Z]/.test(password)) pool += 26
  if (/[0-9]/.test(password)) pool += 10
  if (/[^A-Za-z0-9]/.test(password)) pool += 33
  if (/[^\u0000-\u007f]/.test(password)) pool += 100
  return Math.max(pool, 1)
}

function reverse(text: string): string {
  return text.split('').reverse().join('')
}

/** Longest run of a repeated character, e.g. "aaa" -> 3. */
function longestRepeatRun(password: string): number {
  let best = 1
  let run = 1
  for (let i = 1; i < password.length; i++) {
    run = password[i] === password[i - 1] ? run + 1 : 1
    if (run > best) best = run
  }
  return password.length === 0 ? 0 : best
}

/** Length of the longest ascending/descending run of consecutive characters. */
function longestSequenceRun(password: string): number {
  if (password.length < 2) return password.length
  const lower = password.toLowerCase()
  let best = 1
  for (const sequence of [...SEQUENCES, reverse('abcdefghijklmnopqrstuvwxyz'), reverse('0123456789')]) {
    let run = 1
    for (let i = 1; i < lower.length; i++) {
      if (sequence.includes(lower[i - 1] + lower[i])) {
        run++
        best = Math.max(best, run)
      } else {
        run = 1
      }
    }
  }
  return best
}

/** True when every character sits on one keyboard row in a straight line. */
function isKeyboardPattern(password: string): boolean {
  const lower = password.toLowerCase()
  return KEYBOARD_ROWS.some((row) => {
    for (let start = 0; start < row.length; start++) {
      const slice = row.slice(start)
      if (slice.length >= lower.length && (slice.startsWith(lower) || reverse(slice).startsWith(lower))) return true
    }
    return false
  })
}

/** Shortest repeated unit that tiles the whole string, or null. */
function repeatingUnit(password: string): string | null {
  for (let size = 1; size <= password.length / 2; size++) {
    if (password.length % size !== 0) continue
    const unit = password.slice(0, size)
    if (unit.repeat(password.length / size) === password) return unit
  }
  return null
}

function romanNumeralPattern(password: string): boolean {
  return /^(?=.*[ivxlcdm])[ivxlcdm]+$/i.test(password) && password.length <= 9
}

/** Best guess count for a substring, in log10. */
function segmentGuessesLog10(segment: string): number {
  if (!segment) return 0
  const pool = characterPool(segment)
  return segment.length * Math.log10(pool)
}

/**
 * Estimate the number of guesses, in log10.
 *
 * Considers the password as a whole, as a repetition, as a numeric run and as a
 * keyboard pattern, then returns whichever an attacker would prefer (smallest).
 */
export function estimateGuessesLog10(password: string): number {
  if (!password) return 0

  let best = segmentGuessesLog10(password)

  const unit = repeatingUnit(password)
  if (unit && unit.length < password.length) {
    best = Math.min(best, segmentGuessesLog10(unit) + Math.log10(password.length / unit.length))
  }

  // A password built from a known word plus a little extra is far weaker than
  // its raw character entropy suggests: the attacker only guesses the suffix.
  const lower = password.toLowerCase()
  if (COMMON_PASSWORDS.has(lower)) {
    best = Math.min(best, Math.log10(1000 + password.length))
  } else {
    for (const word of COMMON_WORDS) {
      if (!lower.includes(word)) continue
      const extra = password.length - word.length
      const candidate = Math.log10(COMMON_WORDS.length * 40) + extra * Math.log10(characterPool(password))
      best = Math.min(best, candidate)
      break
    }
  }

  if (/^\d+$/.test(password)) {
    // A numeric PIN or year is guessed by value, not by digit entropy.
    const numeric = Math.log10(Number(password) + 1)
    best = Math.min(best, numeric)
  }

  if (isKeyboardPattern(password)) {
    best = Math.min(best, segmentGuessesLog10(password) - password.length * 0.35)
  }

  if (romanNumeralPattern(password)) {
    best = Math.min(best, password.length * Math.log10(7))
  }

  return Math.max(best, 0)
}

function formatDuration(seconds: number): string {
  if (seconds < 1) return 'instantly'
  const units: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [365, 'day'],
    [1000, 'year'],
    [1000, 'thousand years'],
    [1000, 'million years'],
    [1000, 'billion years'],
  ]
  let value = seconds
  let index = 0
  while (index < units.length - 1 && value >= units[index][0]) {
    value /= units[index][0]
    index++
  }
  const unit = units[index][1]
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'}`
}

function labelFor(score: number): StrengthResult['label'] {
  return (['very weak', 'weak', 'fair', 'strong', 'very strong'] as const)[score]
}

/**
 * Score a password.
 *
 * `guessesPerSecond` defaults to a fast offline attack against a weak hash,
 * which is the realistic worst case for a stolen password database.
 */
export function analyzePassword(password: string, guessesPerSecond = 1e10): StrengthResult {
  const guessesLog10 = estimateGuessesLog10(password)
  const entropyBits = password ? password.length * Math.log2(characterPool(password)) : 0
  const weaknesses: string[] = []
  const suggestions: string[] = []

  if (!password) {
    return {
      guessesLog10: 0,
      label: 'very weak',
      score: 0,
      entropyBits: 0,
      crackTime: 'instantly',
      suggestions: ['Enter a password to analyse.'],
      weaknesses: [],
    }
  }

  const lower = password.toLowerCase()
  const repeat = longestRepeatRun(password)
  const sequence = longestSequenceRun(password)

  if (COMMON_PASSWORDS.has(lower)) {
    weaknesses.push('This is one of the most common passwords in the world.')
    suggestions.push('Avoid passwords from breach lists entirely.')
  }
  for (const word of COMMON_WORDS) {
    if (lower.includes(word)) {
      weaknesses.push(`Contains the common word "${word}".`)
      suggestions.push('Avoid dictionary words, even with substitutions.')
      break
    }
  }
  if (repeat >= 3) {
    weaknesses.push(`Repeats a character ${repeat} times in a row.`)
    suggestions.push('Break up repeated characters.')
  }
  if (sequence >= 4) {
    weaknesses.push('Contains a straight run like "abcd" or "1234".')
    suggestions.push('Avoid sequential characters.')
  }
  if (isKeyboardPattern(password)) {
    weaknesses.push('Follows a straight keyboard pattern.')
    suggestions.push('Avoid keyboard walks such as "qwerty" or "asdf".')
  }
  if (/^\d+$/.test(password)) {
    weaknesses.push('Made only of digits.')
    suggestions.push('Mix letters and symbols in, not just digits.')
  }
  if (password.length < 12) {
    suggestions.push('Aim for at least 12 characters.')
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    suggestions.push('Add a symbol or two.')
  }

  const score = scoreFromGuesses(guessesLog10)
  const seconds = Math.pow(10, guessesLog10) / guessesPerSecond

  return {
    guessesLog10,
    label: labelFor(score),
    score,
    entropyBits,
    crackTime: formatDuration(seconds),
    suggestions: [...new Set(suggestions)],
    weaknesses,
  }
}

function scoreFromGuesses(guessesLog10: number): number {
  if (guessesLog10 < 6) return 0
  if (guessesLog10 < 9) return 1
  if (guessesLog10 < 12) return 2
  if (guessesLog10 < 16) return 3
  return 4
}
