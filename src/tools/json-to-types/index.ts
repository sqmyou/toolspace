import {
  actions,
  button,
  field,
  note,
  outputBlock,
  panel,
  textarea,
  textField,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { inferTypes, JsonTypeError } from './infer'

const SAMPLE = `{
  "id": 1,
  "name": "Ada Lovelace",
  "verified": true,
  "roles": ["admin", "author"],
  "profile": { "bio": null, "followers": 128 }
}`

const tool: Tool = {
  slug: 'json-to-types',
  name: 'JSON to TypeScript',
  description: 'Paste JSON and get TypeScript interfaces inferred from the shape.',
  category: 'Data',
  keywords: ['json', 'typescript', 'types', 'interface', 'schema', 'infer', 'convert'],
  render(root) {
    const input = textarea({ rows: 12, value: SAMPLE, placeholder: 'Paste JSON here…', onInput: () => run() })
    const rootName = textField({ value: 'Root', mono: true, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const output = outputBlock('', { label: 'TypeScript', copy: () => output.body.textContent ?? '' })

    function run() {
      try {
        const { code } = inferTypes(input.value, { rootName: rootName.value.trim() || 'Root' })
        output.body.replaceChildren(code)
        output.setMeta('')
        error.hidden = true
      } catch (err) {
        output.body.replaceChildren('')
        output.setMeta('')
        error.textContent = err instanceof JsonTypeError ? err.message : 'Could not parse this JSON.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'JSON', icon: 'code' },
          field(input, { label: 'JSON' }),
          actions(field(rootName, { label: 'Root name' }), button('Load example', { icon: 'refresh', onClick: () => {
            input.value = SAMPLE
            run()
          } })),
          error,
        ),
        output,
              ),
    )

    run()
  },
}

export default tool
