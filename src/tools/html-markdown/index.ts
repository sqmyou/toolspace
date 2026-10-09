import {
  actions,
  button,
  copyButton,
  download,
  field,
  grid,
  note,
  outputBlock,
  panel,
  segmented,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { htmlToMarkdown, htmlToText, markdownToHtml } from './html'

const HTML_SAMPLE = `<h1>Release notes</h1>
<p>We shipped <strong>three</strong> things this week. See the <a href="https://example.com/log">changelog</a>.</p>
<ul>
  <li>Faster search</li>
  <li>Dark mode</li>
</ul>
<pre><code class="language-bash">npm install toolspace</code></pre>`

const MARKDOWN_SAMPLE = `# Release notes

We shipped **three** things this week.

- Faster search
- Dark mode

\`\`\`bash
npm install toolspace
\`\`\``

type Direction = 'html2md' | 'md2html'

const tool: Tool = {
  slug: 'html-markdown',
  name: 'HTML ⇄ Markdown Converter',
  description: 'Convert HTML to Markdown and back, dropping presentational markup rather than guessing at it.',
  category: 'Text',
  keywords: ['html', 'markdown', 'convert', 'md', 'rich text', 'paste', 'cleanup'],
  render(root) {
    let direction: Direction = 'html2md'
    const input = textarea({ rows: 16, value: HTML_SAMPLE, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    let result = ''
    const output = outputBlock('', { label: 'Output', copy: () => result })

    const directionControl = segmented({
      label: 'Direction',
      value: direction,
      items: [
        { value: 'html2md', label: 'HTML → Markdown' },
        { value: 'md2html', label: 'Markdown → HTML' },
      ],
      onChange: (value) => {
        direction = value as Direction
        sample()
        run()
      },
    })

    function sample() {
      input.value = direction === 'html2md' ? HTML_SAMPLE : MARKDOWN_SAMPLE
    }

    function run() {
      const source = input.value
      if (!source.trim()) {
        result = ''
        output.body.replaceChildren('')
        output.setMeta('')
        error.hidden = true
        return
      }
      try {
        result = direction === 'html2md' ? htmlToMarkdown(source) : markdownToHtml(source)
        output.body.replaceChildren(result)
        const words = direction === 'html2md' ? htmlToText(source).split(/\s+/).filter(Boolean).length : 0
        output.setMeta(
          direction === 'html2md'
            ? `${result.split('\n').length} lines · ${words} words of text`
            : `${result.split('\n').length} lines of HTML`,
        )
        error.hidden = true
      } catch (err) {
        result = ''
        output.body.replaceChildren('')
        output.setMeta('')
        error.textContent = err instanceof Error ? err.message : 'Could not convert that input.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Convert', icon: 'refresh' },
          directionControl,
          actions(
            button('Load sample', { icon: 'refresh', onClick: () => { sample(); run() } }),
            button('Clear', { icon: 'x', onClick: () => { input.value = ''; run() } }),
          ),
          grid(320, field(input, { label: 'Input' }), field(output, { label: 'Output' })),
          error,
        ),
        actions(
          copyButton(() => result, { label: 'Copy' }),
          button('Download', {
            icon: 'download',
            onClick: () =>
              download(direction === 'html2md' ? 'document.md' : 'document.html', result, direction === 'html2md' ? 'text/markdown' : 'text/html'),
          }),
        ),
        note('Script, style and comment content is removed. Formatting tags that have no Markdown meaning are unwrapped to their text.'),
      ),
    )

    run()
  },
}

export default tool
