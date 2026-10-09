import {
  actions,
  button,
  checkbox,
  copyRow,
  field,
  iconButton,
  kvList,
  note,
  outputBlock,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { buildUrl, decodeUrl, encodeUrl, parseUrl, type QueryParam } from './url'

const tool: Tool = {
  slug: 'url-editor',
  name: 'URL & Query String Editor',
  description: 'Decode, edit and rebuild URLs with a table of query parameters.',
  category: 'Encoding',
  keywords: ['url', 'query string', 'percent encoding', 'uri', 'params', 'decode'],
  render(root) {
    const input = textarea({ rows: 3, placeholder: 'https://example.com/path?a=1&b=2#top', onInput: () => parseInput() })
    let parsed = { base: '', params: [] as QueryParam[], hash: '' }
    let encode = true
    let sort = false
    const paramList = el('div', { class: 'ts-param-list' })
    const error = note('', 'danger')
    error.hidden = true
    const built = outputBlock('', { label: 'Rebuilt URL', copy: () => built.body.textContent ?? '' })
    const codec = kvList()

    function rebuild() {
      built.body.replaceChildren(buildUrl(parsed.base, parsed.params, parsed.hash, { encode, sort }))
      built.setMeta(`${parsed.params.length} param${parsed.params.length === 1 ? '' : 's'}`)
    }

    function paramRow(param: QueryParam, index: number) {
      const key = el('input', { class: 'ts-k-input ts-k-mono', value: param.key, 'aria-label': 'Parameter name' }) as HTMLInputElement
      const value = el('input', { class: 'ts-k-input ts-k-mono', value: param.value, 'aria-label': 'Parameter value' }) as HTMLInputElement
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
        iconButton('close', {
          label: 'Remove parameter',
          size: 'sm',
          variant: 'ghost',
          onClick: () => {
            parsed.params.splice(index, 1)
            renderParams()
            rebuild()
          },
        }),
      )
    }

    function renderParams() {
      paramList.replaceChildren(
        ...parsed.params.map(paramRow),
        button('Add parameter', {
          icon: 'plus',
          size: 'sm',
          onClick: () => {
            parsed.params.push({ key: '', value: '' })
            renderParams()
            rebuild()
          },
        }),
      )
    }

    function renderCodec() {
      codec.replaceChildren(
        copyRow('Encode', encodeUrl(input.value)),
        copyRow('Decode', decodeUrl(input.value)),
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
      renderCodec()
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'URL', icon: 'globe' }, field(input, { label: 'URL or path' }), error),
        panel(
          { title: 'Query parameters', icon: 'sliders' },
          paramList,
          actions(
            checkbox({ label: 'Percent-encode values', checked: true, onChange: (checked) => { encode = checked; rebuild() } }),
            checkbox({ label: 'Sort keys', onChange: (checked) => { sort = checked; rebuild() } }),
          ),
        ),
        built,
        panel({ title: 'Encode / decode whole URL', icon: 'swap' }, codec),
              ),
    )

    parseInput()
  },
}

export default tool
