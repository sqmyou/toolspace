import {
  actions,
  button,
  copyButton,
  download,
  field,
  grid,
  note,
  outputBlock,
  panel,
  segmented,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { applyPatch, buildPatch, DiffError, formatPatch, parsePatch } from './patch'

const BEFORE = `function greet(name) {
  return "Hello, " + name;
}

console.log(greet("world"));
`

const AFTER = `function greet(name, greeting = "Hello") {
  return \`\${greeting}, \${name}!\`;
}

console.log(greet("world"));
console.log(greet("world", "Hi"));
`

const PATCH_SAMPLE = formatPatch(buildPatch(BEFORE, AFTER, 'greet.js', 'greet.js'))

const tool: Tool = {
  slug: 'diff-patch',
  name: 'Diff & Patch',
  description: 'Build a unified diff from two texts, or apply a unified patch to a source.',
  category: 'Text',
  keywords: ['diff', 'patch', 'unified', 'hunk', 'apply', 'git', 'compare', 'merge'],
  render(root) {
    let mode: 'create' | 'apply' = 'create'

    const left = textarea({ rows: 12, onInput: () => run() })
    const right = textarea({ rows: 12, onInput: () => run() })
    const patchInput = textarea({ rows: 12, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    let result = ''
    const output = outputBlock('', { label: 'Result', copy: () => result })

    const leftField = field(left, { label: 'Original' })
    const rightField = field(right, { label: 'Changed' })
    const patchField = field(patchInput, { label: 'Unified patch' })
    const outputField = field(output, { label: 'Output' })
    const leftLabel = leftField.querySelector('.ts-k-label') as HTMLElement
    const outputLabel = outputField.querySelector('.ts-k-label') as HTMLElement

    const modeControl = segmented({
      label: 'Mode',
      value: mode,
      items: [
        { value: 'create', label: 'Build a diff' },
        { value: 'apply', label: 'Apply a patch' },
      ],
      onChange: (value) => {
        mode = value as 'create' | 'apply'
        sample()
        paint()
        run()
      },
    })

    function sample() {
      if (mode === 'create') {
        left.value = BEFORE
        right.value = AFTER
      } else {
        left.value = BEFORE
        patchInput.value = PATCH_SAMPLE
      }
    }

    function paint() {
      if (mode === 'create') {
        leftLabel.textContent = 'Original'
        rightField.hidden = false
        patchField.hidden = true
        outputLabel.textContent = 'Unified patch'
      } else {
        leftLabel.textContent = 'Source'
        rightField.hidden = true
        patchField.hidden = false
        outputLabel.textContent = 'Patched result'
      }
    }

    function run() {
      try {
        if (mode === 'create') {
          const patch = buildPatch(left.value, right.value, 'a.txt', 'b.txt')
          result = patch.hunks.length === 0 ? '# no differences\n' : formatPatch(patch)
          output.body.replaceChildren(result)
          output.setMeta(result.startsWith('#') ? 'identical' : `${patch.hunks.length} hunk(s)`)
        } else {
          const patch = parsePatch(patchInput.value)
          const applied = applyPatch(left.value, patch)
          result = applied.text
          output.body.replaceChildren(result)
          output.setMeta(`${applied.applied.length} hunk(s) applied`)
        }
        error.hidden = true
      } catch (err) {
        result = ''
        output.body.replaceChildren('')
        output.setMeta('')
        error.textContent = err instanceof DiffError ? err.message : 'Could not process that input.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Diff & patch', icon: 'layers' },
          modeControl,
          actions(button('Load sample', { icon: 'refresh', onClick: () => { sample(); paint(); run() } })),
          grid(320, leftField, rightField, patchField, outputField),
          error,
        ),
        actions(
          copyButton(() => result, { label: 'Copy' }),
          button('Download', {
            icon: 'download',
            onClick: () => download(mode === 'create' ? 'changes.patch' : 'result.txt', result),
          }),
        ),
        note('Patches are located by their context, so a hunk whose line numbers have drifted still applies when its surrounding lines match.'),
      ),
    )

    sample()
    paint()
    run()
  },
}

export default tool
