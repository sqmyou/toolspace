import { el } from '../../core/dom'
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
    const input = el('textarea', {
      class: 'ts-output ts-textarea',
      rows: 12,
      spellcheck: false,
      placeholder: 'Paste JSON here…',
      value: SAMPLE,
    }) as HTMLTextAreaElement

    const rootName = el('input', {
      class: 'ts-input ts-mono',
      value: 'Root',
      spellcheck: false,
      'aria-label': 'Root type name',
    }) as HTMLInputElement

    const output = el('textarea', { class: 'ts-output ts-textarea', rows: 14, readonly: true }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })

    function run() {
      try {
        const { code } = inferTypes(input.value, { rootName: rootName.value.trim() || 'Root' })
        output.value = code
        error.hidden = true
      } catch (err) {
        output.value = ''
        error.textContent = err instanceof JsonTypeError ? err.message : 'Could not parse this JSON.'
        error.hidden = false
      }
    }

    async function copy() {
      if (!output.value) return
      try {
        await navigator.clipboard.writeText(output.value)
        copyButton.textContent = 'Copied'
        setTimeout(() => (copyButton.textContent = 'Copy'), 900)
      } catch {
        /* clipboard blocked; the output is still selectable */
      }
    }

    const copyButton = el('button', { class: 'ts-button ts-primary', onclick: copy }, 'Copy')

    const loadExample = el(
      'button',
      {
        class: 'ts-button',
        onclick: () => {
          input.value = SAMPLE
          run()
        },
      },
      'Load example',
    )

    input.addEventListener('input', run)
    rootName.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'JSON'), input),
        el('div', { class: 'ts-row ts-between' }, el('div', { class: 'ts-row' }, el('label', { class: 'ts-inline-field' }, el('span', {}, 'Root name'), rootName)), loadExample),
        error,
        el('h3', { class: 'ts-subhead' }, 'TypeScript'),
        output,
        el('div', { class: 'ts-row' }, copyButton),
        el('p', { class: 'ts-note' }, 'Inference runs locally. Your JSON never leaves the browser.'),
      ),
    )

    run()
  },
}

export default tool
