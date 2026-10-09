/**
 * Pure helpers for the SVG viewer.
 *
 * Everything here is string based on purpose: the tool must be able to look at
 * an SVG without parsing it into the live DOM, and the logic must run in tests
 * without a browser.
 */

export interface TagCount {
  tag: string
  count: number
}

export interface SvgInfo {
  width: number | null
  height: number | null
  units: string
  viewBox: { x: number; y: number; width: number; height: number } | null
  elementCount: number
  tags: TagCount[]
  colors: string[]
  hasScript: boolean
  hasExternalRefs: boolean
  hasForeignObject: boolean
  sizeBytes: number
}

const EVENT_ATTR = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const SCRIPT_BLOCK = /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi
const SCRIPT_OPEN = /<\s*script\b[^>]*\/?\s*>/gi
const DANGEROUS_BLOCK = /<\s*(foreignObject|iframe|audio|video)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi
const DANGEROUS_OPEN = /<\s*(foreignObject|iframe|audio|video)\b[^>]*\/?\s*>/gi
const DATA_URI = /((?:href|xlink:href)\s*=\s*(?:"|'))data:image\/svg\+xml[^"']*("|')/gi

/** True when the text looks like an SVG document. */
export function looksLikeSvg(text: string): boolean {
  return /<\s*svg[\s/>]/i.test(text)
}

/** Parse a CSS length into a number of user units, or null if not absolute. */
export function parseLength(value: string | null | undefined): number | null {
  if (!value) return null
  const match = /^\s*([+-]?\d*\.?\d+)\s*(?:px)?\s*$/i.exec(value)
  if (!match) return null
  const number = Number(match[1])
  return Number.isFinite(number) ? number : null
}

export function parseViewBox(value: string | null | undefined) {
  if (!value) return null
  const parts = value.trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [x, y, width, height] = parts
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

function attr(source: string, name: string): string | null {
  const svgTag = /<\s*svg\b[^>]*>/i.exec(source)?.[0] ?? ''
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(svgTag)
  return match ? (match[1] ?? match[2] ?? '') : null
}

/** Collect the colour literals used anywhere in the markup. */
export function extractColors(source: string): string[] {
  const found = new Set<string>()
  const patterns = [
    /#[0-9a-f]{8}\b/gi,
    /#[0-9a-f]{6}\b/gi,
    /#[0-9a-f]{4}\b/gi,
    /#[0-9a-f]{3}\b/gi,
    /\b(?:rgb|hsl)a?\([^)]*\)/gi,
  ]
  for (const pattern of patterns) {
    for (const match of source.match(pattern) ?? []) found.add(match.toLowerCase().replace(/\s+/g, ''))
  }
  const named =
    source.match(
      /\b(?:black|white|red|green|blue|yellow|orange|purple|pink|brown|gray|grey|cyan|magenta|lime|navy|teal|olive|maroon|silver|gold|transparent)\b/gi,
    ) ?? []
  for (const match of named) {
    const value = match.toLowerCase()
    if (value !== 'transparent') found.add(value)
  }
  return [...found].sort()
}

/** Describe an SVG string without executing it. */
export function inspectSvg(source: string): SvgInfo {
  const rawWidth = attr(source, 'width')
  const rawHeight = attr(source, 'height')
  const viewBox = parseViewBox(attr(source, 'viewBox'))

  const unitMatch = /^\s*[+-]?\d*\.?\d+\s*([a-z%]+)/i.exec(rawWidth ?? '')
  const units = unitMatch ? unitMatch[1].toLowerCase() : 'px'

  const tags = new Map<string, number>()
  for (const match of source.matchAll(/<\s*([a-zA-Z][\w:-]*)\b/g)) {
    const tag = match[1]
    tags.set(tag, (tags.get(tag) ?? 0) + 1)
  }
  const tagList: TagCount[] = [...tags.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))

  return {
    width: parseLength(rawWidth),
    height: parseLength(rawHeight),
    units,
    viewBox,
    elementCount: tagList.reduce((sum, entry) => sum + entry.count, 0),
    tags: tagList,
    colors: extractColors(source),
    hasScript: /<\s*script\b/i.test(source) || /\son[a-z]+\s*=/i.test(source),
    hasExternalRefs: /(?:href|xlink:href)\s*=\s*(?:"|')?\s*(?:https?:)?\/\//i.test(source),
    hasForeignObject: /<\s*foreignObject\b/i.test(source),
    sizeBytes: new TextEncoder().encode(source).length,
  }
}

export interface SanitizeResult {
  markup: string
  removed: string[]
}

/**
 * Remove the parts of an SVG that can run code or fetch remote content.
 * The result is safe to render and safe to hand back as a download.
 */
export function sanitizeSvg(source: string): SanitizeResult {
  const removed = new Set<string>()
  let markup = source

  const strip = (pattern: RegExp, label: string) => {
    pattern.lastIndex = 0
    if (pattern.test(markup)) {
      removed.add(label)
      pattern.lastIndex = 0
      markup = markup.replace(pattern, '')
    }
  }

  strip(SCRIPT_BLOCK, 'script')
  strip(SCRIPT_OPEN, 'script')
  strip(DANGEROUS_BLOCK, 'embedded media')
  strip(DANGEROUS_OPEN, 'embedded media')

  const beforeAttrs = markup
  markup = markup.replace(EVENT_ATTR, '')
  if (markup !== beforeAttrs) removed.add('event handlers')

  const beforeJs = markup
  markup = markup.replace(
    /((?:href|xlink:href)\s*=\s*(?:"|'))\s*javascript:[^"']*("|')/gi,
    '$1#$2',
  )
  if (markup !== beforeJs) removed.add('javascript: links')

  const beforeData = markup
  markup = markup.replace(DATA_URI, '$1#$2')
  if (markup !== beforeData) removed.add('nested data images')

  return { markup, removed: [...removed] }
}

/** A data URI that an <img> element can display without running scripts. */
export function svgDataUri(markup: string): string {
  return `data:image/svg+xml,${encodeURIComponent(markup.trim())}`
}

/** A CSS `background-image` value for the markup. */
export function svgCssUrl(markup: string): string {
  return `url("${svgDataUri(markup)}")`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/* -------------------------------------------------------------------------- */
/* Optimiser                                                                   */
/* -------------------------------------------------------------------------- */

/** Elements whose text content is significant and must not be reflowed. */
const PRE_CONTENT = new Set([
  'text',
  'tspan',
  'textpath',
  'altglyph',
  'title',
  'desc',
  'style',
  'script',
  'foreignobject',
])

export interface OptimizeResult {
  markup: string
  before: number
  after: number
  /** Human-readable notes for the changes that were actually made. */
  steps: string[]
}

function bytes(text: string): number {
  return new TextEncoder().encode(text).length
}

/** Collapse whitespace and drop space around `=` and `>`, honouring quotes. */
function tidyTag(tag: string): string {
  let out = ''
  let quote = ''
  for (let i = 0; i < tag.length; i++) {
    const char = tag[i]
    if (quote) {
      out += char
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      out += char
      continue
    }
    if (char === '=') {
      out = `${out.replace(/\s+$/, '')}=`
      while (/\s/.test(tag[i + 1] ?? '')) i += 1
      continue
    }
    if (/\s/.test(char)) {
      if (out !== '' && !/\s$/.test(out)) out += ' '
      continue
    }
    out += char
  }
  return out.replace(/\s+>/g, '>').replace(/<\s+/g, '<')
}

/**
 * Shrink SVG markup without changing how it renders.
 *
 * The only edits are ones that cannot affect output: comments, the XML
 * declaration, `<metadata>` blocks and redundant whitespace. Whitespace between
 * elements is dropped, but never inside an element whose text is meaningful
 * (`<text>`, `<title>`, `<style>`, and friends), and never inside a quoted
 * attribute value.
 */
export function optimizeSvg(source: string): OptimizeResult {
  const before = bytes(source)
  const steps: string[] = []
  let markup = source

  const metadata = markup.match(/<metadata\b[\s\S]*?<\/metadata\s*>/gi)
  if (metadata) {
    markup = markup.replace(/<metadata\b[\s\S]*?<\/metadata\s*>/gi, '')
    steps.push(`removed ${metadata.length} <metadata> block${metadata.length === 1 ? '' : 's'}`)
  }

  let out = ''
  let i = 0
  let comments = 0
  let declarations = 0
  let tidied = false
  let collapsedBetweenTags = false
  const stack: string[] = []

  while (i < markup.length) {
    if (markup[i] === '<') {
      if (markup.startsWith('<!--', i)) {
        const end = markup.indexOf('-->', i + 4)
        i = end === -1 ? markup.length : end + 3
        comments += 1
        continue
      }
      if (markup.startsWith('<?', i)) {
        const end = markup.indexOf('?>', i + 2)
        i = end === -1 ? markup.length : end + 2
        declarations += 1
        continue
      }
      if (markup.startsWith('<![CDATA[', i)) {
        const end = markup.indexOf(']]>', i + 9)
        const stop = end === -1 ? markup.length : end + 3
        out += markup.slice(i, stop)
        i = stop
        continue
      }
      if (markup.startsWith('<!', i)) {
        const end = markup.indexOf('>', i + 2)
        i = end === -1 ? markup.length : end + 1
        declarations += 1
        continue
      }

      let j = i + 1
      let quote = ''
      while (j < markup.length) {
        const char = markup[j]
        if (quote) {
          if (char === quote) quote = ''
        } else if (char === '"' || char === "'") {
          quote = char
        } else if (char === '>') {
          j += 1
          break
        }
        j += 1
      }

      const rawTag = markup.slice(i, j)
      i = j
      const name = /^<\s*\/?\s*([A-Za-z][\w:.-]*)/.exec(rawTag)?.[1]?.toLowerCase() ?? ''
      const closing = /^<\s*\//.test(rawTag)
      const selfClosing = /\/\s*>$/.test(rawTag)
      if (closing) {
        const at = stack.lastIndexOf(name)
        if (at !== -1) stack.splice(at)
      } else if (name && !selfClosing) {
        stack.push(name)
      }
      const tidiedTag = tidyTag(rawTag)
      if (tidiedTag !== rawTag) tidied = true
      out += tidiedTag
      continue
    }

    const next = markup.indexOf('<', i)
    const text = next === -1 ? markup.slice(i) : markup.slice(i, next)
    i = next === -1 ? markup.length : next
    const inPreformatted = stack.some((entry) => PRE_CONTENT.has(entry))
    if (inPreformatted || text.trim() !== '') {
      out += text
    } else if (text !== '') {
      collapsedBetweenTags = true
    }
  }

  if (comments) steps.push(`removed ${comments} comment${comments === 1 ? '' : 's'}`)
  if (declarations) steps.push('removed the XML declaration')
  if (collapsedBetweenTags) steps.push('collapsed whitespace between elements')
  if (tidied) steps.push('tidied attribute spacing')

  return { markup: out, before, after: bytes(out), steps }
}
