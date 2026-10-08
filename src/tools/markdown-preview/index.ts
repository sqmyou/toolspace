import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { markdownStats, outline, renderMarkdown } from './markdown'

const SAMPLE = `# Release notes

A short **Markdown** sample with a [link](https://example.com) and \`inline code\`.

## Changes

- Faster search
- New tool: \`markdown-preview\`
- Fixed a bug in \`escape\`

> Everything renders locally in your browser.

| Tool | Status |
| :--- | ---: |
| parser | done |
| preview | done |

\`\`\`js
const answer = 6 * 7
\`\`\`
`

const tool: Tool = {
  slug: 'markdown-preview',
  name: 'Markdown Preview',
  description: 'Render Markdown to HTML live, with a heading outline and document stats.',
  category: 'Text',
  keywords: ['markdown', 'md', 'preview', 'render', 'html', 'readme', 'commonmark'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 16, spellcheck: false }) as HTMLTextAreaElement
    input.value = SAMPLE
    const preview = el('div', { class: 'ts-md-preview' })
    const outlineList = el('ol', { class: 'ts-md-outline' })
    const statsLine = el('p', { class: 'ts-muted' })
    let html = ''

    function render() {
      html = renderMarkdown(input.value)
      // The renderer escapes text before adding any tags, so this is safe.
      preview.innerHTML = html
      const stats = markdownStats(input.value)
      statsLine.textContent = `${stats.words} words · ${stats.characters} characters · ${stats.headings} headings · ${stats.links} links · ${stats.codeBlocks} code blocks`

      outlineList.replaceChildren()
      for (const heading of outline(input.value)) {
        outlineList.append(el('li', { class: `ts-md-h${heading.level}` }, heading.text))
      }
    }

    input.addEventListener('input', render)

    const output = el(
      'div',
      { class: 'ts-md-out' },
      el('div', { class: 'ts-md-out-head' }, el('span', { class: 'ts-muted' }, 'Rendered HTML'), copyChip(() => html, 'Copy HTML'), el('button', { class: 'ts-button', type: 'button', onclick: () => download('markdown.html', html, 'text/html') }, 'Download')),
      preview,
    )

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-md-grid' }, el('div', { class: 'ts-field' }, el('label', {}, 'Markdown'), input), el('div', { class: 'ts-field' }, el('label', {}, 'Preview'), output)),
        statsLine,
        el('h3', { class: 'ts-subhead' }, 'Outline'),
        outlineList,
        el('p', { class: 'ts-note' }, 'Markdown is parsed and rendered entirely in your browser. Raw HTML in the source is escaped, never executed.'),
      ),
    )

    render()
  },
}

export default tool
