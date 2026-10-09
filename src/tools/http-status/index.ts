import {
  actions,
  card,
  cards,
  chips,
  copyButton,
  field,
  note,
  panel,
  textField,
  toolLayout,
  type Tone,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { CATEGORY_LABELS, lookupStatus, parseStatus, searchStatuses, type HttpStatus, type StatusCategory } from './status'

const ORDER: StatusCategory[] = ['informational', 'success', 'redirect', 'client-error', 'server-error']

const CATEGORY_TONES: Record<StatusCategory, Tone> = {
  informational: 'neutral',
  success: 'ok',
  redirect: 'warn',
  'client-error': 'danger',
  'server-error': 'accent',
  unknown: 'neutral',
}

const tool: Tool = {
  slug: 'http-status',
  name: 'HTTP Status Codes',
  description: 'Look up any HTTP status code, or search by name and meaning.',
  category: 'Web',
  keywords: ['http', 'status', 'code', '404', '500', 'redirect', 'rest', 'api'],
  render(root) {
    const query = textField({ placeholder: 'Search by code or meaning, e.g. 404 or timeout', onInput: () => render() })
    const lookup = textField({ placeholder: 'Code', mono: true, onInput: () => renderLookup() })
    lookup.maxLength = 3
    const lookupOut = cards()
    const list = cards()
    let category: StatusCategory | 'all' = 'all'

    function statusCard(status: HttpStatus, big = false) {
      return card(
        { title: String(status.code), meta: CATEGORY_LABELS[status.category], metaTone: CATEGORY_TONES[status.category] },
        el(
          'div',
          { class: big ? 'ts-status-big' : 'ts-status-body' },
          el('strong', {}, status.name),
          el('p', { class: 'ts-status-desc' }, status.description),
        ),
        actions(copyButton(String(status.code), { label: 'Copy code', size: 'sm' })),
      )
    }

    function renderLookup() {
      lookupOut.replaceChildren()
      if (!lookup.value.trim()) return
      try {
        const status = lookupStatus(parseStatus(lookup.value))
        lookupOut.append(status ? statusCard(status, true) : note(`No standard entry for ${lookup.value.trim()}.`))
      } catch (err) {
        lookupOut.append(note(err instanceof Error ? err.message : 'Bad code', 'danger'))
      }
    }

    function render() {
      const results = searchStatuses(query.value).filter((status) => category === 'all' || status.category === category)
      list.replaceChildren(...(results.length ? results.map((status) => statusCard(status)) : [note('Nothing matched.')]))
    }

    const filterItems = [
      { label: 'All', value: 'all' as StatusCategory | 'all' },
      ...ORDER.map((name) => ({ label: CATEGORY_LABELS[name], value: name as StatusCategory | 'all' })),
    ]
    const filters = chips(
      filterItems.map((item) => ({
        label: item.label,
        value: item.value,
        onClick: (value: string) => {
          category = value as StatusCategory | 'all'
          render()
        },
      })),
      { selected: 'all' },
    )

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Look up', icon: 'search' }, actions(field(lookup, { label: 'Code' }), field(query, { label: 'Search' }))),
        lookupOut,
        panel({ title: 'All codes', icon: 'list' }, filters, list),
        note('Codes outside the standard table are still classified by their hundreds digit.'),
      ),
    )

    render()
  },
}

export default tool
