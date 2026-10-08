/**
 * A compact CommonMark-ish renderer.
 *
 * It covers the syntax people actually type: headings, lists, tables,
 * blockquotes, code fences, inline emphasis, links and images. Output is
 * escaped first, so a document can never inject markup.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char])
}

function inline(text: string): string {
  let out = escapeHtml(text)
  // Inline code first so its contents are not re-parsed as emphasis.
  const codes: string[] = []
  out = out.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(code)
    return `\u0000${codes.length - 1}\u0000`
  })
  out = out
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
  return out.replace(/\u0000(\d+)\u0000/g, (_, index: string) => `<code>${codes[Number(index)]}</code>`)
}

/** Render Markdown to an HTML string. */
export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const html: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    // Fenced code block.
    const fence = /^\s*(```|~~~)\s*([\w+-]*)\s*$/.exec(line)
    if (fence) {
      const marker = fence[1]
      const language = fence[2]
      const body: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trimStart().startsWith(marker)) {
        body.push(lines[index])
        index += 1
      }
      index += 1
      const cls = language ? ` class="language-${escapeHtml(language)}"` : ''
      html.push(`<pre><code${cls}>${escapeHtml(body.join('\n'))}</code></pre>`)
      continue
    }

    // Heading.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level}>${inline(heading[2].replace(/\s+#+\s*$/, ''))}</h${level}>`)
      index += 1
      continue
    }

    // Horizontal rule.
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      html.push('<hr>')
      index += 1
      continue
    }

    // Blockquote.
    if (/^\s*>/.test(line)) {
      const body: string[] = []
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        body.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }
      html.push(`<blockquote>${renderMarkdown(body.join('\n'))}</blockquote>`)
      continue
    }

    // Table: a header row followed by a separator row.
    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[index + 1])) {
      const cells = (row: string) => row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((cell) => cell.trim())
      const header = cells(line)
      const aligns = cells(lines[index + 1]).map((spec) => {
        const left = spec.startsWith(':')
        const right = spec.endsWith(':')
        return left && right ? 'center' : right ? 'right' : left ? 'left' : ''
      })
      index += 2
      const rows: string[][] = []
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(cells(lines[index]))
        index += 1
      }
      const head = header.map((cell, i) => `<th${aligns[i] ? ` style="text-align:${aligns[i]}"` : ''}>${inline(cell)}</th>`).join('')
      const body = rows
        .map((row) => `<tr>${header.map((_, i) => `<td${aligns[i] ? ` style="text-align:${aligns[i]}"` : ''}>${inline(row[i] ?? '')}</td>`).join('')}</tr>`)
        .join('')
      html.push(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`)
      continue
    }

    // Lists (ordered or unordered).
    const listItem = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (listItem) {
      const ordered = /\d/.test(listItem[2])
      const items: string[] = []
      while (index < lines.length) {
        const match = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[index])
        if (!match) break
        items.push(match[3])
        index += 1
      }
      const tag = ordered ? 'ol' : 'ul'
      html.push(`<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`)
      continue
    }

    // Paragraph: consume until a blank line or another block starts.
    const paragraph: string[] = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !/^\s*(#{1,6}\s|>|```|~~~|[-*+]\s|\d+[.)]\s)/.test(lines[index])) {
      paragraph.push(lines[index])
      index += 1
    }
    html.push(`<p>${inline(paragraph.join(' '))}</p>`)
  }

  return html.join('\n')
}

export interface MarkdownStats {
  words: number
  characters: number
  headings: number
  links: number
  codeBlocks: number
}

export function markdownStats(source: string): MarkdownStats {
  const withoutCode = source.replace(/```[\s\S]*?```/g, '')
  return {
    words: (withoutCode.match(/\S+/g) ?? []).length,
    characters: source.length,
    headings: (source.match(/^#{1,6}\s/gm) ?? []).length,
    links: (source.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length,
    codeBlocks: Math.floor((source.match(/^\s*(```|~~~)/gm) ?? []).length / 2),
  }
}

/** A plain-text outline of the headings, useful for long documents. */
export function outline(source: string): { level: number; text: string }[] {
  const result: { level: number; text: string }[] = []
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    const match = /^(#{1,6})\s+(.*)$/.exec(line)
    if (match) result.push({ level: match[1].length, text: match[2].replace(/\s+#+\s*$/, '').trim() })
  }
  return result
}
