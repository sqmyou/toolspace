import {
  actions,
  button,
  copyButton,
  copyRow,
  download,
  field,
  grid,
  kvList,
  note,
  outputBlock,
  panel,
  select,
  textField,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { metaTags, renderHtml, seoAudit, slugify, titleCase } from './slug'

const tool: Tool = {
  slug: 'slug-meta',
  name: 'Slug & Meta Tag Generator',
  description: 'Turn a title into a URL slug and generate SEO and social meta tags.',
  category: 'Web',
  keywords: ['slug', 'seo', 'meta', 'open graph', 'og', 'twitter card', 'url', 'permalink'],
  render(root) {
    const title = textField({ value: 'The Quick Brown Fox & Friends', onInput: () => run() })
    const description = textarea({
      rows: 3,
      value: 'A small collection of fast, focused tools.',
      onInput: () => run(),
    })
    const url = textField({ value: 'https://toolspace.sirsamyoudev.workers.dev/tools/slug-meta', mono: true, onInput: () => run() })
    const image = textField({ placeholder: 'https://…/og.png', mono: true, onInput: () => run() })
    const site = textField({ value: 'toolspace', onInput: () => run() })
    const twitter = textField({ placeholder: '@handle', onInput: () => run() })
    const typeSelect = select({
      options: ['website', 'article', 'product', 'profile'].map((value) => ({ value, label: value })),
      value: 'website',
      onChange: () => run(),
    })
    const separatorSelect = select({
      options: [
        { value: '-', label: 'Hyphen -' },
        { value: '_', label: 'Underscore _' },
      ],
      value: '-',
      onChange: () => run(),
    })

    const slug = outputBlock('—', { label: 'Slug', copy: () => (slug.body.textContent === '—' ? '' : slug.body.textContent ?? '') })
    const titleRow = kvList()
    const audit = el('div', { class: 'ts-audit-list' })
    let html = ''
    const htmlOut = outputBlock('', { label: 'Generated HTML', copy: () => html })

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
      slug.body.replaceChildren(slugify(title.value, separatorSelect.value) || '—')
      slug.setMeta('')
      titleRow.replaceChildren(copyRow('Title case', titleCase(title.value)))

      html = renderHtml(metaTags(currentInput()))
      htmlOut.body.replaceChildren(html)
      htmlOut.setMeta('')

      const warnings = seoAudit(currentInput())
      audit.replaceChildren(
        ...(warnings.length
          ? warnings.map((warning) => el('div', { class: 'ts-audit ts-audit-warning' }, `${warning.field}: ${warning.message}`))
          : [el('div', { class: 'ts-audit ts-audit-info' }, 'Looks good.')]),
      )
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Slug', icon: 'swap' },
          field(title, { label: 'Title' }),
          field(separatorSelect, { label: 'Separator' }),
        ),
        slug,
        panel({ title: 'Title case', icon: 'type' }, titleRow),
        panel(
          { title: 'Meta tags', icon: 'globe' },
          grid(200,
            field(typeSelect, { label: 'Type' }),
            field(site, { label: 'Site name' }),
            field(twitter, { label: 'Twitter' }),
          ),
          field(description, { label: 'Description' }),
          grid(280, field(url, { label: 'Canonical URL' }), field(image, { label: 'Social image' })),
        ),
        htmlOut,
        actions(
          copyButton(() => html, { label: 'Copy HTML' }),
          button('Download', { icon: 'download', onClick: () => download('meta-tags.html', html) }),
        ),
        panel({ title: 'Audit', icon: 'shield' }, audit),
        note('Length checks are heuristics based on typical search and social display limits.'),
      ),
    )

    run()
  },
}

export default tool
