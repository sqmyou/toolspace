import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { jsonToXml, parseXml, XmlError, xmlToJson } from './xml'

const tool: Tool = {
  slug: 'json-xml',
  name: 'JSON ↔ XML Converter',
  description: 'Convert between JSON and XML in both directions, with attributes kept intact.',
  category: 'Data',
  keywords: ['json', 'xml', 'convert', 'transform', 'attributes', 'serialize'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 12, spellcheck: false, placeholder: 'Paste JSON or XML…' }) as HTMLTextAreaElement
    const output = el('pre', { class: 'ts-json-block' })
    const error = el('p', { class: 'ts-error', hidden: true })

    let mode: 'json' | 'xml' = 'json'

    function convert() {
      const text = input.value
      if (!text.trim()) {
        output.textContent = ''
        error.hidden = true
        return
      }
      try {
        output.textContent = mode === 'xml' ? jsonToXml(JSON.parse(text)) : JSON.stringify(xmlToJson(parseXml(text)), null, 2)
        error.hidden = true
      } catch (err) {
        output.textContent = ''
        error.textContent = err instanceof XmlError || err instanceof SyntaxError ? err.message : 'Could not convert that input.'
        error.hidden = false
      }
    }

    function detect(text: string) {
      const trimmed = text.trim()
      if (!trimmed) return
      const looksXml = trimmed.startsWith('<')
      if (looksXml && mode !== 'xml') {
        mode = 'xml'
        modeSelect.value = 'xml'
      } else if (!looksXml && mode !== 'json') {
        mode = 'json'
        modeSelect.value = 'json'
      }
      convert()
    }

    const modeSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    modeSelect.append(el('option', { value: 'json' }, 'JSON → XML'), el('option', { value: 'xml' }, 'XML → JSON'))
    modeSelect.addEventListener('change', () => {
      mode = modeSelect.value as 'json' | 'xml'
      convert()
    })

    input.addEventListener('input', () => detect(input.value))

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-inline-field' }, el('label', {}, 'Direction'), modeSelect),
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        error,
        el(
          'div',
          { class: 'ts-row ts-between' },
          el('h3', { class: 'ts-subhead' }, 'Output'),
          el(
            'div',
            { class: 'ts-tool-actions' },
            copyChip(() => output.textContent ?? '', 'Copy'),
            el('button', { class: 'ts-button', type: 'button', onclick: () => download(mode === 'xml' ? 'converted.json' : 'converted.xml', output.textContent ?? '', mode === 'xml' ? 'application/json' : 'application/xml') }, 'Download'),
          ),
        ),
        output,
        el('p', { class: 'ts-note' }, 'Attributes map to keys beginning with @. Conversion happens in your browser.'),
      ),
    )

    convert()
  },
}

export default tool
