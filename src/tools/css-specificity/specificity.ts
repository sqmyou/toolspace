/**
 * CSS selector specificity.
 *
 * Specificity is the familiar (ids, classes, elements) triple. Selectors are
 * split on top-level commas first, so a group like `a, b` is scored per part.
 */

export interface Specificity {
  ids: number
  classes: number
  elements: number
}

export interface SelectorScore {
  selector: string
  specificity: Specificity
  important: boolean
}

export function compareSpecificity(a: Specificity, b: Specificity): number {
  return a.ids - b.ids || a.classes - b.classes || a.elements - b.elements
}

export function formatSpecificity(s: Specificity): string {
  return `(${s.ids}, ${s.classes}, ${s.elements})`
}

/** Split a selector list on commas that are not inside brackets or parentheses. */
export function splitSelectorList(input: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of input) {
    if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1)
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts.filter(Boolean)
}

const FUNCTIONAL_PSEUDO = /:(not|is|has|matches|any)\(/i

/** Compute the specificity of a single complex selector. */
export function specificityOf(selector: string, important = false): SelectorScore {
  let body = selector.trim()
  let importantFlag = important
  if (/!\s*important/i.test(body)) {
    importantFlag = true
    body = body.replace(/!\s*important/gi, '')
  }

  const result: Specificity = { ids: 0, classes: 0, elements: 0 }
  countInto(body, result)
  return { selector: selector.trim(), specificity: result, important: importantFlag }
}

function countInto(selector: string, result: Specificity): void {
  let text = selector

  // :where() contributes nothing; blank it out before the general scan.
  text = text.replace(/:where\(([^()]*)\)/gi, '')

  // :is(), :not() and :has() take the specificity of their most specific
  // argument, so each is replaced by that inner selector.
  while (FUNCTIONAL_PSEUDO.test(text)) {
    const before = text
    text = text.replace(/:(?:not|is|has|matches|any)\(([^()]*)\)/gi, (_whole, inner: string) => {
      const parts = splitSelectorList(inner)
      let best: Specificity | null = null
      for (const part of parts) {
        const score: Specificity = { ids: 0, classes: 0, elements: 0 }
        countInto(part, score)
        if (!best || compareSpecificity(score, best) > 0) best = score
      }
      if (!best) return ''
      result.ids += best.ids
      result.classes += best.classes
      result.elements += best.elements
      return ''
    })
    if (text === before) break
  }

  // IDs.
  const ids = text.match(/#[\w-]+/g)
  if (ids) result.ids += ids.length

  // Classes.
  const classes = text.match(/\.[\w-]+/g)
  if (classes) result.classes += classes.length

  // Attribute selectors.
  const attrs = text.match(/\[[^\]]*\]/g)
  if (attrs) result.classes += attrs.length

  // Pseudo-elements count as elements.
  const pseudoElements = text.match(/::[\w-]+/g)
  if (pseudoElements) result.elements += pseudoElements.length

  // Pseudo-classes count as classes (the :: ones have already been removed).
  // A single leading colon is a pseudo-class; `::` is handled just above.
  const withoutPseudoElements = text.replace(/::[\w-]+/g, '')
  const pseudoClasses = withoutPseudoElements.match(/(?<!:):[\w-]+/g)
  if (pseudoClasses) result.classes += pseudoClasses.length

  // Type selectors: a word at the start or after a combinator, not a class/id.
  const elements = text
    .replace(/::[\w-]+/g, '')
    .replace(/#[\w-]+/g, '')
    .replace(/\.[\w-]+/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/(?<!:):[\w-]+/g, '')
  for (const token of elements.split(/[\s>+~]+/)) {
    if (token === '' || token === '*') continue
    if (/^[a-zA-Z][\w-]*$/.test(token)) result.elements++
  }
}

export function scoreSelectorList(input: string): SelectorScore[] {
  return splitSelectorList(input).map((selector) => specificityOf(selector))
}

export interface SelectorReport {
  scores: SelectorScore[]
  max: Specificity
  sorted: SelectorScore[]
}

export function analyse(input: string): SelectorReport {
  const scores = scoreSelectorList(input)
  const max = scores.reduce<Specificity>(
    (best, score) => (compareSpecificity(score.specificity, best) > 0 ? score.specificity : best),
    { ids: 0, classes: 0, elements: 0 },
  )
  const sorted = [...scores].sort((a, b) => compareSpecificity(b.specificity, a.specificity))
  return { scores, max, sorted }
}
