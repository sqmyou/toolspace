import { describe, expect, it } from 'vitest'
import { decodeEntities, htmlToMarkdown, htmlToText, markdownToHtml } from './html'

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('a &amp; b')).toBe('a & b')
    expect(decodeEntities('&lt;tag&gt;')).toBe('<tag>')
    expect(decodeEntities('&#169; &#x2014;')).toBe('© —')
  })

  it('leaves unknown entities alone', () => {
    expect(decodeEntities('&weird;')).toBe('&weird;')
  })
})

describe('htmlToMarkdown', () => {
  it('converts headings and paragraphs', () => {
    expect(htmlToMarkdown('<h1>Title</h1><p>Hello <strong>world</strong>.</p>')).toBe(
      '# Title\n\nHello **world**.',
    )
  })

  it('converts links, images and inline code', () => {
    expect(htmlToMarkdown('<p><a href="https://x.dev">x</a></p>')).toBe('[x](https://x.dev)')
    expect(htmlToMarkdown('<img src="a.png" alt="A">')).toBe('![A](a.png)')
    expect(htmlToMarkdown('<p>Use <code>npm ci</code></p>')).toBe('Use `npm ci`')
  })

  it('converts emphasis and strikethrough', () => {
    expect(htmlToMarkdown('<em>a</em> <i>b</i> <del>c</del>')).toBe('*a* *b* ~~c~~')
  })

  it('converts a fenced code block and keeps the language', () => {
    const md = htmlToMarkdown('<pre><code class="language-js">const a = 1\nconst b = 2</code></pre>')
    expect(md).toBe('```js\nconst a = 1\nconst b = 2\n```')
  })

  it('converts unordered and ordered lists', () => {
    expect(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>')).toBe('- one\n- two')
    expect(htmlToMarkdown('<ol><li>first</li><li>second</li></ol>')).toBe('1. first\n2. second')
  })

  it('converts tables with a header row', () => {
    const md = htmlToMarkdown('<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>')
    expect(md).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |')
  })

  it('converts blockquotes', () => {
    expect(htmlToMarkdown('<blockquote><p>quoted</p></blockquote>')).toBe('> quoted')
  })

  it('drops scripts, styles and comments entirely', () => {
    const md = htmlToMarkdown('<style>p{}</style><p>keep</p><script>alert(1)</script><!-- note -->')
    expect(md).toBe('keep')
  })

  it('escapes Markdown punctuation found in text', () => {
    expect(htmlToMarkdown('<p>2 * 3 * 4</p>')).toBe('2 \\* 3 \\* 4')
  })
})

describe('round trip', () => {
  it('markdown -> html -> markdown is stable', () => {
    const source = '# Title\n\nSome **bold** and a [link](https://x.dev).\n\n- one\n- two'
    const html = markdownToHtml(source)
    const back = htmlToMarkdown(html)
    expect(back).toBe(source)
  })
})

describe('htmlToText', () => {
  it('strips markup and keeps the words', () => {
    expect(htmlToText('<h1>Hi</h1><p>a <b>b</b></p>')).toBe('Hi\na b')
  })
})
