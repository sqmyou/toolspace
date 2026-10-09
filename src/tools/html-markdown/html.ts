/**
 * HTML ⇄ Markdown.
 *
 * The reverse direction reuses the CommonMark-ish renderer from the Markdown
 * preview tool, so the two features cannot drift apart. The forward direction
 * (HTML -> Markdown) is a small tokenizer plus a tree walk: enough for the
 * semantic markup people paste (headings, lists, links, images, code, tables,
 * emphasis), and it drops the presentational noise instead of guessing at it.
 */
import { renderMarkdown } from '../markdown-preview/markdown'

export { renderMarkdown as markdownToHtml }

interface HtmlElement {
  type: 'element'
  tag: string
  attrs: Record<string, string>
  children: HtmlNode[]
}

interface TextNode {
  type: 'text'
  text: string
}

type HtmlNode = HtmlElement | TextNode

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

/** Elements whose text content is never rendered as Markdown. */
const SKIP_TAGS = new Set(['script', 'style', 'head', 'noscript', 'template', 'title', 'svg', 'canvas'])

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©',
  reg: '®', trade: '™', mdash: '—', ndash: '–', hellip: '…', laquo: '«',
  raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', middot: '·',
  bull: '•', deg: '°', euro: '€', pound: '£', yen: '¥', times: '×',
  divide: '÷', le: '≤', ge: '≥', ne: '≠', minus: '−', prime: '′',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = parseInt(body.slice(2), 16)
      return Number.isFinite(code) ? safeCodePoint(code) : whole
    }
    if (body.startsWith('#')) {
      const code = parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? safeCodePoint(code) : whole
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole
  })
}

function safeCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/g
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const match of raw.matchAll(ATTR_RE)) {
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    attrs[match[1].toLowerCase()] = decodeEntities(value)
  }
  return attrs
}

/** Build a small DOM-like tree from an HTML string. Malformed markup is tolerated. */
export function parseHtml(input: string): HtmlElement {
  const root: HtmlElement = { type: 'element', tag: '#root', attrs: {}, children: [] }
  const stack: HtmlElement[] = [root]
  let cursor = 0

  // Comments, doctypes and CDATA carry no Markdown, so drop them before the walk.
  const source = input.replace(/<!--[\s\S]*?-->/g, '').replace(/<![^>]*>/g, '')

  for (const match of source.matchAll(TAG_RE)) {
    const index = match.index ?? 0
    if (index > cursor) {
      const text = source.slice(cursor, index)
      stack[stack.length - 1].children.push({ type: 'text', text })
    }
    cursor = index + match[0].length

    const tag = match[1].toLowerCase()
    const closing = match[0].startsWith('</')
    const selfClosing = match[0].endsWith('/>') || VOID_TAGS.has(tag)

    if (closing) {
      // Unwind to the matching open tag; ignore stray closers.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i
          break
        }
      }
      continue
    }

    const element: HtmlElement = { type: 'element', tag, attrs: parseAttrs(match[2]), children: [] }
    stack[stack.length - 1].children.push(element)
    if (!selfClosing) stack.push(element)
  }

  if (cursor < source.length) root.children.push({ type: 'text', text: source.slice(cursor) })
  return root
}

/* -------------------------------------------------------------------------
   HTML -> Markdown
   ------------------------------------------------------------------------- */

/** Escape the characters that would otherwise change meaning in Markdown. */
function escapeText(text: string): string {
  return text.replace(/([\\`*_[\]])/g, '\\$1')
}

function collapse(text: string): string {
  return decodeEntities(text).replace(/\s+/g, ' ')
}

function listDepth(node: HtmlElement): number {
  return node.children.filter((child) => child.type === 'element').length ? 1 : 0
}

function renderChildren(node: HtmlElement): string {
  return node.children.map((child) => renderNode(child)).join('')
}

function renderInlineChildren(node: HtmlElement): string {
  return renderChildren(node).replace(/\s+/g, ' ').trim()
}

function renderListItem(item: HtmlElement, ordered: boolean, index: number, indent: string): string {
  const marker = ordered ? `${index + 1}. ` : '- '
  const body = renderChildren(item).trim().replace(/\n{2,}/g, '\n')
  const lines = body.split('\n')
  const first = `${indent}${marker}${lines[0] ?? ''}`.trimEnd()
  const rest = lines.slice(1).map((line) => `${indent}${' '.repeat(marker.length)}${line}`.trimEnd())
  return [first, ...rest].join('\n')
}

function renderList(node: HtmlElement, indent: string): string {
  const ordered = node.tag === 'ol'
  const items: string[] = []
  let index = 0
  for (const child of node.children) {
    if (child.type === 'element' && child.tag === 'li') {
      items.push(renderListItem(child, ordered, index, indent))
      index++
    }
  }
  return `\n\n${items.join('\n')}\n\n`
}

function renderTable(node: HtmlElement): string {
  const rows: string[][] = []
  const walk = (element: HtmlElement) => {
    if (element.type !== 'element') return
    if (element.tag === 'tr') {
      const cells: string[] = []
      for (const cell of element.children) {
        if (cell.type === 'element' && (cell.tag === 'td' || cell.tag === 'th')) {
          cells.push(renderInlineChildren(cell).replace(/\|/g, '\\|'))
        }
      }
      if (cells.length) rows.push(cells)
      return
    }
    for (const child of element.children) if (child.type === 'element') walk(child)
  }
  walk(node)

  if (rows.length === 0) return ''
  const width = Math.max(...rows.map((row) => row.length))
  const pad = (row: string[]) => Array.from({ length: width }, (_, i) => row[i] ?? '')
  const header = pad(rows[0])
  const body = rows.slice(1).map(pad)
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`
  const separator = `| ${Array.from({ length: width }, () => '---').join(' | ')} |`
  return `\n\n${[line(header), separator, ...body.map(line)].join('\n')}\n\n`
}

function codeLanguage(element: HtmlElement): string {
  const match = /language-([\w+-]+)/.exec(element.attrs.class ?? '')
  return match ? match[1] : ''
}

function renderNode(node: HtmlNode): string {
  if (node.type === 'text') return escapeText(collapse(node.text))

  const { tag } = node
  if (SKIP_TAGS.has(tag)) return ''

  switch (tag) {
    case 'br':
      return '\n'
    case 'hr':
      return '\n\n---\n\n'
    case 'img': {
      const alt = node.attrs.alt ?? ''
      const src = node.attrs.src ?? ''
      return src ? `![${alt}](${src})` : ''
    }
    case 'a': {
      const href = node.attrs.href ?? ''
      const text = renderInlineChildren(node) || href
      return href ? `[${text}](${href})` : text
    }
    case 'strong':
    case 'b':
      return `**${renderInlineChildren(node)}**`
    case 'em':
    case 'i':
      return `*${renderInlineChildren(node)}*`
    case 'del':
    case 's':
    case 'strike':
      return `~~${renderInlineChildren(node)}~~`
    case 'code':
      return `\`${decodeEntities(renderChildren(node)).trim()}\``
    case 'pre': {
      const code = node.children.find((child): child is HtmlElement => child.type === 'element' && child.tag === 'code')
      const language = code ? codeLanguage(code) : codeLanguage(node)
      const raw = (code ?? node).children.map((child) => (child.type === 'text' ? decodeEntities(child.text) : renderNode(child))).join('')
      const fence = raw.includes('```') ? '````' : '```'
      return `\n\n${fence}${language}\n${raw.replace(/\n$/, '')}\n${fence}\n\n`
    }
    case 'ul':
    case 'ol':
      return listDepth(node) ? renderList(node, '') : ''
    case 'table':
      return renderTable(node)
    case 'blockquote': {
      const inner = renderChildren(node).trim().replace(/\n{3,}/g, '\n\n')
      return `\n\n${inner.split('\n').map((line) => `> ${line}`.trimEnd()).join('\n')}\n\n`
    }
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Number(tag[1])
      return `\n\n${'#'.repeat(level)} ${renderInlineChildren(node)}\n\n`
    }
    case 'p': {
      const inner = renderChildren(node).trim()
      return inner ? `\n\n${inner}\n\n` : ''
    }
    default:
      return renderChildren(node)
  }
}

/** Convert an HTML string to Markdown. */
export function htmlToMarkdown(input: string): string {
  const tree = parseHtml(input)
  const markdown = renderChildren(tree)
  return tidy(markdown)
}

/** Collapse the loose blank lines the tree walk leaves behind. */
function tidy(markdown: string): string {
  return markdown
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '')
    .trim()
    .concat('\n')
    .replace(/\n$/, '')
}

/** Text with markup removed, for a plain-text preview or reading time. */
export function htmlToText(input: string): string {
  const tree = parseHtml(input)
  const blockTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'blockquote', 'section', 'article', 'br', 'pre'])
  const collect = (node: HtmlNode): string => {
    if (node.type === 'text') return decodeEntities(node.text)
    if (SKIP_TAGS.has(node.tag)) return ''
    const inner = node.children.map(collect).join('')
    return blockTags.has(node.tag) ? `${inner}\n` : inner
  }
  return collect(tree)
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
