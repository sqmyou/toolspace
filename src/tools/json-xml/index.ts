import {
  actions,
  button,
  copyButton,
  download,
  note,
  outputBlock,
  panel,
  segmented,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { jsonToXml, parseXml, XmlError, xmlToJson } from './xml'

const tool: Tool = {
  slug: 'json-xml',
  name: 'JSON ↔ XML Converter',
  description: 'Convert between JSON and XML in both directions, with attributes kept intact.',
  category: 'Data',
  keywords: ['json', 'xml', 'convert', 'transform', 'attributes', 'serialize'],
  render(root) {
    let mode: 'json' | 'xml' = 'json'
    const input = textarea({ rows: 12, placeholder: 'Paste JSON or XML…', onInput: () => detect(input.value) })
    const error = note('', 'danger')
    error.hidden = true
    let result = ''
    const output = outputBlock('', { label: 'Output', copy: () => result })

    const modeControl = segmented({
      label: 'Direction',
      value: mode,
      items: [
        { value: 'json', label: 'JSON → XML' },
        { value: 'xml', label: 'XML → JSON' },
      ],
      onChange: (value) => {
        mode = value as 'json' | 'xml'
        convert()
      },
    })

    function convert() {
      const text = input.value
      if (!text.trim()) {
        result = ''
        output.body.replaceChildren('')
        output.setMeta('')
        error.hidden = true
        return
      }
      try {
        result = mode === 'xml' ? jsonToXml(JSON.parse(text)) : JSON.stringify(xmlToJson(parseXml(text)), null, 2)
        output.body.replaceChildren(result)
        output.setLabel(mode === 'xml' ? 'XML' : 'JSON')
        output.setMeta(`${result.split('\n').length} lines`)
        error.hidden = true
      } catch (err) {
        result = ''
        output.body.replaceChildren('')
        output.setMeta('')
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
        modeControl.setValue('xml')
      } else if (!looksXml && mode !== 'json') {
        mode = 'json'
        modeControl.setValue('json')
      }
      convert()
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Input', icon: 'text' }, modeControl, input, error),
        output,
        actions(
          copyButton(() => result, { label: 'Copy' }),
          button('Download', {
            icon: 'download',
            onClick: () => download(mode === 'xml' ? 'converted.json' : 'converted.xml', result, mode === 'xml' ? 'application/json' : 'application/xml'),
          }),
        ),
        note('Attributes map to keys beginning with @. Conversion happens in your browser.'),
      ),
    )

    convert()
  },
}

export default tool
