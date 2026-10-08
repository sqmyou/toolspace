import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { metaTags, renderHtml, seoAudit, slugify, titleCase } from './slug'

const tool: Tool = {
  slug: 'slug-meta',
  name: 'Slug & Meta Tag Generator',
  description: 'Turn a title into a URL slug and generate SEO and social meta tags.',
  category: 'Web',
  keywords: ['slug', 'seo', 'meta', 'open graph', 'og', 'twitter card', 'url', 'permalink'],
  render(root) {
    const title = el('input', { class: 'ts-input', value: 'The Quick Brown Fox & Friends', 'aria-label': 'Title' }) as HTMLInputElement
    const description = el('textarea', { class: 'ts-textarea', rows: 3, value: 'A privacy-first collection of developer tools that run entirely in your browser.', 'aria-label': 'Description' }) as HTMLTextAreaElement
    const url = el('input', { class: 'ts-input ts-mono', value: 'https://toolspace.sirsamyoudev.workers.dev/tools/slug-meta', 'aria-label': 'URL' }) as HTMLInputElement
    const image = el('input', { class: 'ts-input ts-mono', placeholder: 'https://…/og.png', 'aria-label': 'Image URL' }) as HTMLInputElement
    const site = el('input', { class: 'ts-input', value: 'toolspace', 'aria-label': 'Site name' }) as HTMLInputElement
    const twitter = el('input', { class: 'ts-input', placeholder: '@handle', 'aria-label': 'Twitter handle' }) as HTMLInputElement
    const typeSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const value of ['website', 'article', 'product', 'profile']) typeSelect.append(el('option', { value }, value))

    const separatorSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const [value, label] of [['-', 'Hyphen -'], ['_', 'Underscore _']]) separatorSelect.append(el('option', { value }, label))

    const slugOut = el('code', { class: 'ts-mono ts-big-value' })
    const titleCaseOut = el('code', { class: 'ts-mono ts-value' })
    const htmlOut = el('textarea', { class: 'ts-textarea ts-mono', rows: 12, readonly: true }) as HTMLTextAreaElement
    const auditList = el('div', { class: 'ts-audit-list' })

    function currentInput() {
      return {
        title: title.value,
        description: description.value,
        url: url.value,
        image: image.value || undefined,
        siteName: site.value || undefined,
        twitterHandle: twitter.value || undefined,
        type: typeSelect.value,
      }
    }

    function run() {
      const separator = separatorSelect.value
      slugOut.textContent = slugify(title.value, separator) || '—'
      titleCaseOut.textContent = titleCase(title.value)

      const tags = metaTags(currentInput())
      htmlOut.value = renderHtml(tags)

      auditList.replaceChildren(
        ...seoAudit(currentInput()).map((warning) =>
          el('div', { class: 'ts-audit ts-audit-warning' }, `${warning.field}: ${warning.message}`),
        ),
      )
      if (auditList.childElementCount === 0) {
        auditList.append(el('div', { class: 'ts-audit ts-audit-info' }, 'Looks good.'))
      }
    }

    for (const field of [title, description, url, image, site, twitter]) field.addEventListener('input', run)
    for (const select of [separatorSelect, typeSelect]) select.addEventListener('change', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('h3', { class: 'ts-subhead' }, 'Slug'),
        el('div', { class: 'ts-field' }, el('label', {}, 'Title'), title),
        el('div', { class: 'ts-row ts-wrap' }, el('div', { class: 'ts-inline-field' }, el('label', {}, 'Separator'), separatorSelect), copyChip(() => slugOut.textContent === '—' ? '' : slugOut.textContent ?? '')),
        el('div', { class: 'ts-field' }, el('label', {}, 'Slug'), slugOut),
        el('div', { class: 'ts-field' }, el('label', {}, 'Title case'), titleCaseOut),
        el('h3', { class: 'ts-subhead' }, 'Meta tags'),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Type'), typeSelect),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Site name'), site),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Twitter'), twitter),
        ),
        el('div', { class: 'ts-field' }, el('label', {}, 'Description'), description),
        el('div', { class: 'ts-two-col' },
          el('div', { class: 'ts-field' }, el('label', {}, 'Canonical URL'), url, el('label', {}, 'Social image'), image),
          el('div', { class: 'ts-field' }, el('label', {}, 'Generated HTML'), htmlOut),
        ),
        el('div', { class: 'ts-row ts-wrap' },
          copyChip(() => htmlOut.value, 'Copy HTML'),
          el('button', { class: 'ts-button', type: 'button', onclick: () => download('meta-tags.html', htmlOut.value) }, 'Download')),
        el('h3', { class: 'ts-subhead' }, 'Audit'),
        auditList,
        el('p', { class: 'ts-note' }, 'Length checks are heuristics based on typical search and social display limits.'),
      ),
    )

    run()
  },
}

export default tool
