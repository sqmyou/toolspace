/** Titles to slugs, and slugs to a set of SEO/social meta tags. */

/** Split Latin text into accent-free words via NFD normalisation. */
function deburr(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function slugify(input: string, separator = '-'): string {
  return deburr(input)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`\\${separator}{2,}`, 'g'), separator)
    .replace(new RegExp(`^\\${separator}|\\${separator}$`, 'g'), '')
}

export function titleCase(input: string): string {
  const minor = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'up', 'yet'])
  const words = input.trim().split(/\s+/)
  return words
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index !== 0 && index !== words.length - 1 && minor.has(lower)) return lower
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

export interface SeoInput {
  title: string
  description: string
  url: string
  image?: string
  siteName?: string
  twitterHandle?: string
  type?: string
}

export function metaTags(input: SeoInput): { name: string; content: string }[] {
  const { title, description, url, image, siteName, twitterHandle, type = 'website' } = input
  const tags: { name: string; content: string }[] = [
    { name: 'description', content: description },
  ]
  const og = [
    ['og:title', title],
    ['og:description', description],
    ['og:type', type],
    ['og:url', url],
    ...(image ? [['og:image', image]] : []),
    ...(siteName ? [['og:site_name', siteName]] : []),
  ]
  for (const [name, content] of og) if (content) tags.push({ name, content })

  const twitterCard = image ? 'summary_large_image' : 'summary'
  tags.push({ name: 'twitter:card', content: twitterCard })
  if (twitterHandle) tags.push({ name: 'twitter:site', content: twitterHandle.startsWith('@') ? twitterHandle : `@${twitterHandle}` })
  tags.push({ name: 'twitter:title', content: title })
  tags.push({ name: 'twitter:description', content: description })
  if (image) tags.push({ name: 'twitter:image', content: image })

  return tags.filter((tag) => tag.content)
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderHtml(tags: { name: string; content: string }[]): string {
  return tags
    .map((tag) => {
      const attr = tag.name.startsWith('og:') || tag.name.startsWith('twitter:') ? 'property' : 'name'
      return `<meta ${attr}="${tag.name}" content="${escapeAttr(tag.content)}" />`
    })
    .join('\n')
}

export interface SeoWarning {
  field: string
  message: string
}

/** Length checks roughly matching what search and social crawlers display. */
export function seoAudit(input: SeoInput): SeoWarning[] {
  const warnings: SeoWarning[] = []
  const length = input.title.trim().length
  if (length === 0) warnings.push({ field: 'title', message: 'Title is empty.' })
  else if (length < 30) warnings.push({ field: 'title', message: `Title is short (${length} characters); aim for about 50–60.` })
  else if (length > 60) warnings.push({ field: 'title', message: `Title is long (${length} characters); around 60 keeps it from being cut off.` })

  const desc = input.description.trim().length
  if (desc === 0) warnings.push({ field: 'description', message: 'Description is empty.' })
  else if (desc < 50) warnings.push({ field: 'description', message: `Description is short (${desc} characters); aim for about 120–160.` })
  else if (desc > 160) warnings.push({ field: 'description', message: `Description is long (${desc} characters); around 160 avoids truncation.` })

  if (!input.url.trim()) warnings.push({ field: 'url', message: 'Canonical URL is missing.' })
  if (!input.image?.trim()) warnings.push({ field: 'image', message: 'No social image set; link previews will be plain.' })

  return warnings
}
