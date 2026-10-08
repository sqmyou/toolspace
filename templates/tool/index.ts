import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { yourLogic } from './tool'

/**
 * Starter tool. Copy this folder to `src/tools/<slug>/`, then:
 *   1. rename `slug` below to the folder name
 *   2. fill in the metadata
 *   3. move the real work into `tool.ts` and test it there
 *   4. build the UI in `render(root)`
 */
const tool: Tool = {
  slug: 'tool',
  name: 'My Tool',
  description: 'One sentence about what this tool does.',
  category: 'Misc',
  keywords: ['example', 'starter'],
  render(root) {
    const input = el('input', { class: 'ts-output', placeholder: 'Type something…' }) as HTMLInputElement
    const output = el('p', { class: 'ts-muted' })

    function run() {
      output.textContent = yourLogic(input.value)
    }

    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        el('div', { class: 'ts-field' }, el('label', {}, 'Result'), output),
      ),
    )

    run()
  },
}

export default tool
