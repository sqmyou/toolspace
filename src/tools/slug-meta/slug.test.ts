import { describe, expect, it } from 'vitest'
import { metaTags, renderHtml, seoAudit, slugify, titleCase } from './slug'

describe('slugify', () => {
  it('lowercases, strips accents and collapses separators', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
    expect(slugify('Café déjà vu')).toBe('cafe-deja-vu')
    expect(slugify('  Multiple   spaces  ')).toBe('multiple-spaces')
  })

  it('turns ampersands into "and"', () => {
    expect(slugify('Salt & Pepper')).toBe('salt-and-pepper')
  })

  it('drops apostrophes', () => {
    expect(slugify("It's OpenHands' turn")).toBe('its-openhands-turn')
  })

  it('supports custom separators', () => {
    expect(slugify('Hello, World!', '_')).toBe('hello_world')
  })

  it('handles empty and symbol-only input', () => {
    expect(slugify('')).toBe('')
    expect(slugify('!!!')).toBe('')
  })
})

describe('titleCase', () => {
  it('capitalises words but keeps minor words lowercase', () => {
    expect(titleCase('the quick brown fox jumps over the lazy dog')).toBe('The Quick Brown Fox Jumps Over the Lazy Dog')
  })

  it('always capitalises the last word', () => {
    expect(titleCase('what is it for')).toBe('What Is It For')
  })
})

describe('metaTags', () => {
  const base = { title: 'Toolspace', description: 'Private dev tools', url: 'https://example.com' }

  it('always emits description, og and twitter basics', () => {
    const names = metaTags(base).map((tag) => tag.name)
    expect(names).toContain('description')
    expect(names).toContain('og:title')
    expect(names).toContain('twitter:card')
    expect(metaTags(base).find((tag) => tag.name === 'twitter:card')?.content).toBe('summary')
  })

  it('uses the large card and adds image tags when an image exists', () => {
    const tags = metaTags({ ...base, image: 'https://example.com/a.png', twitterHandle: 'openhands' })
    expect(tags.find((tag) => tag.name === 'twitter:card')?.content).toBe('summary_large_image')
    expect(tags.find((tag) => tag.name === 'og:image')?.content).toBe('https://example.com/a.png')
    expect(tags.find((tag) => tag.name === 'twitter:site')?.content).toBe('@openhands')
  })
})

describe('renderHtml', () => {
  it('uses property for og/twitter and escapes content', () => {
    const html = renderHtml([{ name: 'og:title', content: 'A "quoted" & <tag>' }, { name: 'description', content: 'plain' }])
    expect(html).toContain('property="og:title"')
    expect(html).toContain('name="description"')
    expect(html).toContain('&quot;quoted&quot; &amp; &lt;tag&gt;')
  })
})

describe('seoAudit', () => {
  it('flags empty fields', () => {
    const warnings = seoAudit({ title: '', description: '', url: '' })
    expect(warnings.map((warning) => warning.field)).toEqual(expect.arrayContaining(['title', 'description', 'url']))
  })

  it('flags lengths outside the ideal range', () => {
    const short = seoAudit({ title: 'Hi', description: 'Short', url: 'https://x.dev' })
    expect(short.some((warning) => warning.field === 'title' && warning.message.includes('short'))).toBe(true)
    const long = seoAudit({ title: 'x'.repeat(80), description: 'y'.repeat(200), url: 'https://x.dev', image: 'https://x.dev/a.png' })
    expect(long.some((warning) => warning.field === 'title' && warning.message.includes('long'))).toBe(true)
    expect(long.some((warning) => warning.field === 'description' && warning.message.includes('long'))).toBe(true)
  })

  it('passes a well-formed setup', () => {
    const warnings = seoAudit({
      title: 'A perfectly reasonable page title',
      description: 'z'.repeat(140),
      url: 'https://example.com',
      image: 'https://example.com/a.png',
    })
    expect(warnings).toEqual([])
  })
})
