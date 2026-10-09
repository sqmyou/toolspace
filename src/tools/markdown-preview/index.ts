import {
  actions,
  button,
  copyButton,
  field,
  note,
  panel,
  stats,
  stat,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import { download } from '../../core/ui'
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
    const input = textarea({ rows: 16, value: SAMPLE, onInput: () => render() })
    const preview = el('div', { class: 'ts-md-preview' })
    const outlineList = el('ol', { class: 'ts-md-outline' })
    const readout = stats()
    let html = ''

    function render() {
      html = renderMarkdown(input.value)
      // The renderer escapes text before adding any tags, so this is safe.
      preview.innerHTML = html
      const info = markdownStats(input.value)
      readout.replaceChildren(
        stat({ label: 'Words', value: String(info.words) }),
        stat({ label: 'Characters', value: String(info.characters) }),
        stat({ label: 'Headings', value: String(info.headings) }),
        stat({ label: 'Links', value: String(info.links) }),
        stat({ label: 'Code blocks', value: String(info.codeBlocks) }),
      )
      outlineList.replaceChildren(...outline(input.value).map((heading) => el('li', { class: `ts-md-h${heading.level}` }, heading.text)))
    }

    const source = panel({ title: 'Markdown', icon: 'code' }, field(input, { label: 'Markdown' }))
    const rendered = panel(
      { title: 'Rendered', icon: 'eye' },
      actions(copyButton(() => html, { label: 'Copy HTML', size: 'sm' }), button('Download', { icon: 'download', onClick: () => download('markdown.html', html, 'text/html') })),
      preview,
    )

    root.append(
      toolLayout(
        { wide: true },
        el('div', { class: 'ts-k-split' }, source, rendered),
        readout,
        panel({ title: 'Outline', icon: 'list' }, outlineList),
        note('Markdown is parsed and rendered entirely in your browser. Raw HTML in the source is escaped, never executed.'),
      ),
    )

    render()
  },
}

export default tool
