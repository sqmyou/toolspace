import {
  actions,
  button,

  field,
  grid,
  note,
  outputBlock,
  panel,
  segmented,
  stats,
  stat,
  textField,
  textarea,
  toolLayout,
} from '../../core/components'

import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  allCaesarShifts,
  atbash,
  caesar,
  caesarDecode,
  fromMorse,
  rot13,
  toMorse,
  type CipherName,
} from './cipher'

const SAMPLE = 'Attack at dawn. Bring 3 ropes!'

const tool: Tool = {
  slug: 'classic-ciphers',
  name: 'Classic Ciphers',
  description: 'ROT13, Caesar, Atbash and Morse, with every Caesar shift laid out for guessing the key.',
  category: 'Text',
  keywords: ['rot13', 'caesar', 'cipher', 'atbash', 'morse', 'encode', 'decode', 'cryptogram'],
  render(root) {
    let cipher: CipherName = 'rot13'
    let direction: 'encode' | 'decode' = 'encode'
    const shift = textField({ type: 'number', value: '3', mono: true, onInput: () => run() })
    const input = textarea({ rows: 10, mono: true, value: SAMPLE, onInput: () => run() })
    let result = ''
    const output = outputBlock('', { label: 'Output', copy: () => result })
    const guesses = el('div', { class: 'ts-k-findings' })
    const summary = stats()

    function transform(source: string): string {
      switch (cipher) {
        case 'rot13':
          return rot13(source)
        case 'atbash':
          return atbash(source)
        case 'caesar': {
          const value = Number(shift.value) || 0
          return direction === 'encode' ? caesar(source, value) : caesarDecode(source, value)
        }
        case 'morse':
          return direction === 'encode' ? toMorse(source) : fromMorse(source)
      }
    }

    function run() {
      result = transform(input.value)
      output.body.replaceChildren(input.value.trim() ? result : '')
      const letters = (input.value.match(/[a-z]/gi) ?? []).length
      output.setMeta(input.value.trim() ? `${result.length} characters · ${letters} transformed letters` : '')

      summary.replaceChildren(
        stat({ label: 'Cipher', value: cipher }),
        stat({ label: 'Self-inverse', value: cipher === 'caesar' ? 'No' : 'Yes' }),
        stat({ label: 'Letters', value: String(letters) }),
      )

      // Caesar without a known key: show every possible shift for the input.
      const showGuesses = cipher === 'caesar'
      guesses.hidden = !showGuesses
      if (showGuesses) {
        guesses.replaceChildren(
          ...allCaesarShifts(input.value.slice(0, 80)).map((entry) =>
            el(
              'div',
              { class: 'ts-k-finding' },
              el('span', { class: 'ts-k-finding__status' }, `+${entry.shift}`),
              el('div', { class: 'ts-k-finding__body' }, el('code', { class: 'ts-k-mono' }, entry.text)),
            ),
          ),
        )
      }
    }

    const shiftField = field(shift, { label: 'Shift (Caesar only)' })

    const cipherControl = segmented({
      label: 'Cipher',
      value: cipher,
      items: [
        { value: 'rot13', label: 'ROT13' },
        { value: 'caesar', label: 'Caesar' },
        { value: 'atbash', label: 'Atbash' },
        { value: 'morse', label: 'Morse' },
      ],
      onChange: (value) => {
        cipher = value as CipherName
        shiftField.hidden = cipher !== 'caesar'
        guesses.hidden = cipher !== 'caesar'
        run()
      },
    })

    const directionControl = segmented({
      label: 'Direction',
      value: direction,
      items: [
        { value: 'encode', label: 'Encode' },
        { value: 'decode', label: 'Decode' },
      ],
      onChange: (value) => {
        direction = value as 'encode' | 'decode'
        run()
      },
    })

    shiftField.hidden = true

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Cipher', icon: 'lock' },
          cipherControl,
          directionControl,
          grid(220, shiftField),
          note('ROT13, Atbash and Morse need no key. Caesar takes a shift from 1 to 25.'),
        ),
        panel(
          { title: 'Input & output', icon: 'text' },
          field(input, { label: 'Input' }),
          output,
          actions(
            button('Load sample', { icon: 'refresh', onClick: () => { input.value = SAMPLE; run() } }),
            button('Swap result back in', { icon: 'refresh', onClick: () => { input.value = result; run() } }),
            button('Clear', { icon: 'x', onClick: () => { input.value = ''; run() } }),
          ),
        ),
        panel({ title: 'At a glance', icon: 'chart' }, summary),
        panel({ title: 'All Caesar shifts', icon: 'list' }, guesses),
        note('These are historical ciphers for puzzles and obfuscation only. They are not encryption and offer no security.'),
      ),
    )

    run()
  },
}

export default tool
