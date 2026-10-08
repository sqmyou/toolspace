import { describe, expect, it } from 'vitest'
import { escapeHtml, markdownStats, outline, renderMarkdown } from './markdown'

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml('<script>"x" & \'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;')
  })
})

describe('renderMarkdown', () => {
  it('renders headings of each level', () => {
    expect(renderMarkdown('# One')).toBe('<h1>One</h1>')
    expect(renderMarkdown('### Three')).toBe('<h3>Three</h3>')
  })

  it('renders paragraphs and joins wrapped lines', () => {
    expect(renderMarkdown('hello\nworld')).toBe('<p>hello world</p>')
    expect(renderMarkdown('a\n\nb')).toBe('<p>a</p>\n<p>b</p>')
  })

  it('renders inline emphasis and code', () => {
    expect(renderMarkdown('**bold**')).toBe('<p><strong>bold</strong></p>')
    expect(renderMarkdown('*italic*')).toBe('<p><em>italic</em></p>')
    expect(renderMarkdown('~~gone~~')).toBe('<p><del>gone</del></p>')
    expect(renderMarkdown('use `a*b*c` here')).toBe('<p>use <code>a*b*c</code> here</p>')
  })

  it('renders links and images', () => {
    expect(renderMarkdown('[site](https://example.com)')).toBe('<p><a href="https://example.com">site</a></p>')
    expect(renderMarkdown('![alt](pic.png)')).toBe('<p><img src="pic.png" alt="alt"></p>')
  })

  it('renders fenced code blocks without interpreting contents', () => {
    const html = renderMarkdown('```js\nconst a = 1 < 2\n```')
    expect(html).toBe('<pre><code class="language-js">const a = 1 &lt; 2</code></pre>')
  })

  it('renders unordered and ordered lists', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>')
  })

  it('renders blockquotes recursively', () => {
    expect(renderMarkdown('> quoted')).toBe('<blockquote><p>quoted</p></blockquote>')
  })

  it('renders tables with alignment', () => {
    const html = renderMarkdown('| a | b |\n| :-- | --: |\n| 1 | 2 |')
    expect(html).toContain('<th style="text-align:left">a</th>')
    expect(html).toContain('<th style="text-align:right">b</th>')
    expect(html).toContain('<td style="text-align:left">1</td>')
  })

  it('renders horizontal rules', () => {
    expect(renderMarkdown('---')).toBe('<hr>')
  })

  it('does not allow raw HTML through', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('handles a mixed document', () => {
    const html = renderMarkdown('# Title\n\nSome **text**.\n\n- one\n- two\n')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>text</strong>')
    expect(html).toContain('<li>two</li>')
  })
})

describe('markdownStats', () => {
  it('counts the main structures', () => {
    const stats = markdownStats('# A\n\n[x](y)\n\n```\ncode here\n```')
    expect(stats.headings).toBe(1)
    expect(stats.links).toBe(1)
    expect(stats.codeBlocks).toBe(1)
    expect(stats.words).toBeGreaterThan(0)
  })
})

describe('outline', () => {
  it('lists headings with their level', () => {
    expect(outline('# A\n## B\ntext')).toEqual([
      { level: 1, text: 'A' },
      { level: 2, text: 'B' },
    ])
  })
})
