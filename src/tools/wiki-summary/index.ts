import {
  actions,
  badge,
  button,
  copyRow,
  imageBlock,
  note,
  panel,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { normalizeTitle, parseSummary, summaryUrl, type WikiSummary } from './wiki'

const SAMPLE = 'JavaScript'

const tool: Tool = {
  slug: 'wiki-summary',
  name: 'Wikipedia Summary',
  description: 'Paste a Wikipedia title or link to get a clean summary, lead image and canonical URL.',
  category: 'Text',
  keywords: ['wikipedia', 'wiki', 'summary', 'article', 'encyclopedia', 'extract', 'lookup', 'research'],
  remote: {
    host: 'en.wikipedia.org',
    note: 'It asks Wikipedia\u2019s public REST API for the summary of the title you type. The title is the only thing sent; no cookies, no account, no tracking.',
  },
  render(root) {
    const input = textField({ value: SAMPLE, placeholder: 'Article title or Wikipedia link\u2026', onInput: () => queue() })
    input.spellcheck = false
    input.setAttribute('aria-label', 'Wikipedia article title or link')

    const status = el('div', { class: 'ts-k-actions' })
    const body = el('div', { class: 'ts-k-prose' })
    const links = el('div', { class: 'ts-k-kvlist' })
    const preview = imageBlock({ title: 'Lead image', alt: 'Article lead image', maxHeight: 320 })
    preview.root.hidden = true

    let seq = 0
    let timer: number | undefined

    /** Debounce, so typing a title does not fire a request per keystroke. */
    function queue() {
      window.clearTimeout(timer)
      timer = window.setTimeout(lookUp, 450)
    }

    function clear() {
      body.replaceChildren()
      links.replaceChildren()
      preview.image.removeAttribute('src')
      preview.root.hidden = true
    }

    function paint(summary: WikiSummary) {
      status.replaceChildren(
        badge(summary.disambiguation ? 'Disambiguation page' : 'Article found', summary.disambiguation ? 'warn' : 'ok'),
      )
      body.replaceChildren(
        el('h3', { class: 'ts-k-prose__title' }, summary.title),
        summary.description ? el('p', { class: 'ts-k-prose__desc' }, summary.description) : '',
        el('p', {}, summary.extract || 'This article has no summary text.'),
      )
      links.replaceChildren(
        copyRow('Title', summary.title),
        summary.url ? copyRow('Article', summary.url) : '',
      )
      if (summary.thumbnail) {
        preview.image.referrerPolicy = 'no-referrer'
        preview.image.alt = `${summary.title} lead image`
        preview.image.src = summary.thumbnail.src
        preview.caption.textContent = `${summary.thumbnail.width}\u00d7${summary.thumbnail.height}`
      } else {
        preview.image.removeAttribute('src')
        preview.root.hidden = true
      }
    }

    async function lookUp() {
      const current = ++seq
      const title = normalizeTitle(input.value)
      if (!title) {
        status.replaceChildren(input.value.trim() === '' ? '' : note('Paste an article title or a Wikipedia link.', 'warn'))
        clear()
        return
      }

      status.replaceChildren(badge(`Looking up ${title}\u2026`, 'neutral'))
      try {
        const response = await fetch(summaryUrl(title), { headers: { accept: 'application/json' } })
        if (current !== seq) return
        if (response.status === 404) {
          status.replaceChildren(badge(`No article called \u201c${title}\u201d.`, 'warn'))
          clear()
          return
        }
        if (!response.ok) {
          status.replaceChildren(badge(`Wikipedia returned HTTP ${response.status}.`, 'danger'))
          clear()
          return
        }
        const summary = parseSummary(await response.json())
        if (current !== seq) return
        paint(summary)
      } catch {
        if (current !== seq) return
        status.replaceChildren(badge('Could not reach Wikipedia. Check your connection and try again.', 'danger'))
        clear()
      }
    }

    preview.image.addEventListener('load', () => {
      preview.root.hidden = false
    })
    preview.image.addEventListener('error', () => {
      preview.root.hidden = true
    })

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Title', icon: 'globe' },
          input,
          actions(
            button('Look up', { icon: 'search', variant: 'primary', onClick: () => void lookUp() }),
            button('Clear', {
              onClick: () => {
                input.value = ''
                input.focus()
                void lookUp()
              },
            }),
          ),
          status,
          note('This tool uses the network. Only the article title you type is sent, to Wikipedia\u2019s public API. Nothing else leaves this page.'),
        ),
        preview.root,
        panel({ title: 'Summary', icon: 'text' }, body),
        panel({ title: 'Links', icon: 'info' }, links),
      ),
    )

    void lookUp()
  },
}

export default tool
