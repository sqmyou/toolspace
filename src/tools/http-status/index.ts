import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { CATEGORY_LABELS, lookupStatus, parseStatus, searchStatuses, type HttpStatus, type StatusCategory } from './status'

const ORDER: StatusCategory[] = ['informational', 'success', 'redirect', 'client-error', 'server-error']

const tool: Tool = {
  slug: 'http-status',
  name: 'HTTP Status Codes',
  description: 'Look up any HTTP status code, or search by name and meaning.',
  category: 'Web',
  keywords: ['http', 'status', 'code', '404', '500', 'redirect', 'rest', 'api'],
  render(root) {
    const query = el('input', { class: 'ts-input', placeholder: 'Search by code or meaning, e.g. 404 or timeout' }) as HTMLInputElement
    const lookupInput = el('input', { class: 'ts-input ts-mono', placeholder: 'Code', maxlength: 3 }) as HTMLInputElement
    const lookupOut = el('div', { class: 'ts-status-lookup' })
    const list = el('div', { class: 'ts-status-list' })
    const count = el('p', { class: 'ts-muted' })
    let category: StatusCategory | 'all' = 'all'

    function renderLookup() {
      lookupOut.replaceChildren()
      if (!lookupInput.value.trim()) return
      try {
        const code = parseStatus(lookupInput.value)
        const status = lookupStatus(code)
        if (!status) {
          lookupOut.append(el('p', { class: 'ts-muted' }, `No standard entry for ${code}.`))
          return
        }
        lookupOut.append(statusCard(status, true))
      } catch (err) {
        lookupOut.append(el('p', { class: 'ts-error' }, err instanceof Error ? err.message : 'Bad code'))
      }
    }

    function statusCard(status: HttpStatus, big = false) {
      return el(
        'div',
        { class: `ts-status-card ts-status-${status.category}${big ? ' ts-status-big' : ''}` },
        el('code', { class: 'ts-status-code' }, String(status.code)),
        el('div', { class: 'ts-status-body' }, el('strong', {}, status.name), el('p', { class: 'ts-status-desc' }, status.description)),
        copyChip(String(status.code), 'Copy'),
      )
    }

    function render() {
      list.replaceChildren()
      const results = searchStatuses(query.value).filter((status) => category === 'all' || status.category === category)
      count.textContent = `${results.length} of ${searchStatuses('').length} codes`
      if (results.length === 0) list.append(el('p', { class: 'ts-muted' }, 'Nothing matched.'))
      for (const status of results) list.append(statusCard(status))
    }

    query.addEventListener('input', render)
    lookupInput.addEventListener('input', renderLookup)

    const filters = el(
      'div',
      { class: 'ts-row ts-wrap' },
      el('button', { class: `ts-chip${category === 'all' ? ' ts-chip-active' : ''}`, type: 'button', onclick: () => setCategory('all') }, 'All'),
      ...ORDER.map((name) => el('button', { class: 'ts-chip', type: 'button', onclick: () => setCategory(name) }, CATEGORY_LABELS[name])),
    )

    function setCategory(next: StatusCategory | 'all') {
      category = next
      for (const [index, button] of [...filters.children].entries()) {
        button.classList.toggle('ts-chip-active', index === 0 ? category === 'all' : ORDER[index - 1] === category)
      }
      render()
    }

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-row ts-wrap' }, el('div', { class: 'ts-inline-field' }, el('label', {}, 'Look up a code'), lookupInput), el('div', { class: 'ts-inline-field ts-grow' }, el('label', {}, 'Search'), query)),
        lookupOut,
        filters,
        count,
        list,
        el('p', { class: 'ts-note' }, 'Codes outside the standard table are still classified by their hundreds digit.'),
      ),
    )

    render()
  },
}

export default tool
