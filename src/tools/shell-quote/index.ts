import {
  actions,
  badge,
  button,
  copyButton,
  copyRow,
  field,
  kvList,
  note,
  outputBlock,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { doubleQuote, escape, isSafe, quote, quoteAll, quoteMinimal, splitWords, summarise } from './shell'

const tool: Tool = {
  slug: 'shell-quote',
  name: 'Shell Quoting Helper',
  description: 'Quote arguments for a POSIX shell, or split a command line into words.',
  category: 'Text',
  keywords: ['shell', 'bash', 'quote', 'escape', 'argv', 'command', 'sh', 'zsh'],
  render(root) {
    const input = textarea({ rows: 4, mono: true, value: 'git commit -m "fix: don\'t break"', onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    let result = ''
    const output = outputBlock('', { label: 'Result', copy: () => result })
    const table = kvList()
    const summary = badge('—')

    function run() {
      error.hidden = true
      const words = splitWords(input.value, { strict: true })
      const info = summarise(words)
      result = info.quoted
      output.body.replaceChildren(result)
      output.setMeta('')
      summary.textContent = `${words.length} word${words.length === 1 ? '' : 's'} · ${info.unsafe.length} need quoting · longest is ${info.longest} characters`

      table.replaceChildren(
        ...words.map((word, index) =>
          copyRow(`#${index + 1} ${word === '' ? '(empty)' : word}`, quote(word)),
        ),
      )
      void isSafe
    }

    function guard(mode: 'single' | 'double' | 'escape') {
      try {
        result = mode === 'single' ? quote(input.value) : mode === 'double' ? doubleQuote(input.value) : escape(input.value)
        output.body.replaceChildren(result)
        output.setMeta('')
        error.hidden = true
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not quote that text.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Command line', icon: 'code' },
          field(input, { label: 'Command line' }),
          actions(
            button('Quote each word', { variant: 'primary', icon: 'swap', onClick: run }),
            button('Single-quote whole text', { icon: 'text', onClick: () => guard('single') }),
            button('Double-quote whole text', { icon: 'text', onClick: () => guard('double') }),
            button('Backslash-escape', { icon: 'code', onClick: () => guard('escape') }),
          ),
          error,
        ),
        output,
        actions(
          copyButton(() => result, { label: 'Copy result' }),
          copyButton(() => quoteAll(splitWords(input.value)), { label: 'Copy all quoted' }),
          copyButton(() => quoteMinimal(splitWords(input.value)), { label: 'Copy minimal' }),
        ),
        panel({ title: 'Word by word', icon: 'layers' }, summary, table),
        note('Words are split the way a shell splits them, then each one is quoted so it survives a round trip. Safe words are left bare.'),
      ),
    )

    run()
  },
}

export default tool
