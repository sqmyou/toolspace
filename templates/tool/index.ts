import { actions, button, note, outputBlock, panel, textField, toolLayout } from '../../core/components'
import type { Tool } from '../../core/types'
import { yourLogic } from './tool'

/**
 * Starter tool. Copy this folder to `src/tools/<slug>/`, then:
 *   1. rename `slug` below to the folder name
 *   2. fill in the metadata
 *   3. move the real work into `tool.ts` and test it there
 *   4. compose the UI in `render(root)` from `core/components`
 *
 * The components in `core/components.ts` already carry the shared look,
 * spacing and responsive behaviour. Prefer them over hand-built markup: a
 * panel here, a field there, and the page matches every other tool.
 */
const tool: Tool = {
  slug: 'tool',
  name: 'My Tool',
  description: 'One sentence about what this tool does.',
  category: 'Misc',
  keywords: ['example', 'starter'],
  render(root) {
    const input = textField({ placeholder: 'Type something…' })
    const output = outputBlock('')

    function run() {
      output.setValue(yourLogic(input.value))
    }

    input.addEventListener('input', run)

    root.append(
      toolLayout(
        panel(
          { title: 'Input', icon: 'braces' },
          input,
          actions(button('Run', { variant: 'primary', icon: 'play', onClick: run })),
        ),
        panel({ title: 'Result', icon: 'check' }, output),
        note('This tool runs entirely in your browser. Nothing is uploaded.'),
      ),
    )

    run()
  },
}

export default tool
