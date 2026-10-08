import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { buildUrl, decodeUrl, encodeUrl, parseUrl, type QueryParam } from './url'

const tool: Tool = {
  slug: 'url-editor',
  name: 'URL & Query String Editor',
  description: 'Decode, edit and rebuild URLs with a table of query parameters.',
  category: 'Encoding',
  keywords: ['url', 'query string', 'percent encoding', 'uri', 'params', 'decode'],
  render(root) {
    const input = el('textarea', {
      class: 'ts-textarea',
      rows: 3,
      placeholder: 'https://example.com/path?a=1&b=2#top',
      'aria-label': 'URL',
    }) as HTMLTextAreaElement

    let parsed = { base: '', params: [] as QueryParam[], hash: '' }
    const paramList = el('div', { class: 'ts-param-list' })
    const encodeBox = el('input', { type: 'checkbox', checked: true }) as HTMLInputElement
    const sortBox = el('input', { type: 'checkbox' }) as HTMLInputElement
    const built = el('textarea', { class: 'ts-textarea', rows: 3, readonly: true }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })

    function rebuild() {
      built.value = buildUrl(parsed.base, parsed.params, parsed.hash, {
        encode: encodeBox.checked,
        sort: sortBox.checked,
      })
    }

    function paramRow(param: QueryParam, index: number) {
      const key = el('input', { class: 'ts-input ts-mono', value: param.key }) as HTMLInputElement
      const value = el('input', { class: 'ts-input ts-mono', value: param.value }) as HTMLInputElement
      key.addEventListener('input', () => {
        parsed.params[index].key = key.value
        rebuild()
      })
      value.addEventListener('input', () => {
        parsed.params[index].value = value.value
        rebuild()
      })
      return el(
        'div',
        { class: 'ts-param-row' },
        key,
        value,
        el('button', {
          class: 'ts-button ts-icon-button',
          type: 'button',
          title: 'Remove',
          onclick: () => {
            parsed.params.splice(index, 1)
            renderParams()
            rebuild()
          },
        }, '✕'),
      )
    }

    function renderParams() {
      paramList.replaceChildren(
        ...parsed.params.map(paramRow),
        el(
          'button',
          {
            class: 'ts-button',
            type: 'button',
            onclick: () => {
              parsed.params.push({ key: '', value: '' })
              renderParams()
              rebuild()
            },
          },
          '+ Add parameter',
        ),
      )
    }

    function parseInput() {
      try {
        parsed = parseUrl(input.value)
        error.hidden = true
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not parse this URL.'
        error.hidden = false
      }
      renderParams()
      rebuild()
    }

    input.addEventListener('input', parseInput)
    encodeBox.addEventListener('change', rebuild)
    sortBox.addEventListener('change', rebuild)

    const codec = el('div', { class: 'ts-copy-list' })
    function renderCodec() {
      codec.replaceChildren(
        el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'Encode'), copyChip(() => encodeUrl(input.value))),
        el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'Decode'), copyChip(() => decodeUrl(input.value))),
      )
    }
    input.addEventListener('input', renderCodec)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'URL or path'), input),
        error,
        el('h3', { class: 'ts-subhead' }, 'Query parameters'),
        paramList,
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('label', { class: 'ts-inline-field' }, encodeBox, 'Percent-encode values'),
          el('label', { class: 'ts-inline-field' }, sortBox, 'Sort keys'),
        ),
        el('h3', { class: 'ts-subhead' }, 'Rebuilt URL'),
        built,
        el('div', { class: 'ts-row ts-wrap' }, copyChip(() => built.value, 'Copy URL')),
        el('h3', { class: 'ts-subhead' }, 'Encode / decode whole URL'),
        codec,
        el('p', { class: 'ts-note' }, 'All parsing happens locally.'),
      ),
    )

    parseInput()
    renderCodec()
  },
}

export default tool
