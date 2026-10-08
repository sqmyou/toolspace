import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { doubleQuote, escape, isSafe, quote, quoteAll, quoteMinimal, splitWords, summarise } from './shell'

const tool: Tool = {
  slug: 'shell-quote',
  name: 'Shell Quoting Helper',
  description: 'Quote arguments for a POSIX shell, or split a command line into words.',
  category: 'Text',
  keywords: ['shell', 'bash', 'quote', 'escape', 'argv', 'command', 'sh', 'zsh'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 4, spellcheck: false }, 'git commit -m "fix: don\'t break"') as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const output = el('textarea', { class: 'ts-textarea ts-mono', rows: 3, spellcheck: false, readonly: true }) as HTMLTextAreaElement
    const table = el('div', { class: 'ts-copy-list' })
    const summary = el('p', { class: 'ts-muted' })

    function run() {
      error.hidden = true
      table.replaceChildren()
      const words = splitWords(input.value, { strict: true })
      const info = summarise(words)
      output.value = info.quoted
      summary.textContent = `${words.length} word${words.length === 1 ? '' : 's'} · ${info.unsafe.length} need quoting · longest is ${info.longest} characters`

      for (const [index, word] of words.entries()) {
        const row = el(
          'div',
          { class: 'ts-copy-row' },
          el('span', { class: 'ts-muted ts-shell-index' }, String(index + 1)),
          el('code', { class: 'ts-shell-word' }, word === '' ? '(empty)' : word),
          el('code', { class: 'ts-shell-kind' }, isSafe(word) && word !== '' ? 'plain' : 'quoted'),
          el('code', { class: 'ts-shell-value' }, quote(word)),
        )
        row.append(copyChip(quote(word), 'Copy'))
        table.append(row)
      }
    }

    function guard(mode: 'single' | 'double' | 'escape') {
      try {
        const value = mode === 'single' ? quote(input.value) : mode === 'double' ? doubleQuote(input.value) : escape(input.value)
        output.value = value
        error.hidden = true
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not quote that text.'
        error.hidden = false
      }
    }

    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Command line'), input),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('button', { class: 'ts-button', type: 'button', onclick: run }, 'Quote each word'),
          el('button', { class: 'ts-button', type: 'button', onclick: () => guard('single') }, 'Single-quote the whole text'),
          el('button', { class: 'ts-button', type: 'button', onclick: () => guard('double') }, 'Double-quote the whole text'),
          el('button', { class: 'ts-button', type: 'button', onclick: () => guard('escape') }, 'Backslash-escape'),
        ),
        error,
        el('div', { class: 'ts-field' }, el('label', {}, 'Result'), output),
        el('div', { class: 'ts-row ts-wrap' }, copyChip(() => output.value, 'Copy result'), copyChip(() => quoteAll(splitWords(input.value)), 'Copy all quoted'), copyChip(() => quoteMinimal(splitWords(input.value)), 'Copy minimal')),
        summary,
        table,
        el('p', { class: 'ts-note' }, 'Words are split the way a shell splits them, then each one is quoted so it survives a round trip. Safe words are left bare.'),
      ),
    )

    run()
  },
}

export default tool
