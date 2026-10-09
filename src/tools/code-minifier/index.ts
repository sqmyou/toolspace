import {
  actions,
  button,
  copyButton,
  outputBlock,
  panel,
  segmented,
  stat,
  stats,
  textarea,
  toolLayout,
  note,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { download, readFileAsText } from '../../core/ui'
import { type CodeLanguage, beautify, detectLanguage, minify } from './code'

const SAMPLES: Record<CodeLanguage, string> = {
  javascript: `// greet someone, politely
function greet (name) {
  const  greeting = "Hello, " + name ;  // build the string
  return greeting;
}

/* print it */
console.log( greet( "world" ) );`,
  css: `/* card styles */
.card {
  border-radius: 12px;   /* soft corners */
  padding : 16px   24px ;
  background: #101319;
}

.card > .title:hover {
  color: #ccff4d;
}`,
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(2)} KB`
}

const tool: Tool = {
  slug: 'code-minifier',
  name: 'JS & CSS Minifier',
  description: 'Minify or beautify JavaScript and CSS, and see exactly how many bytes were saved.',
  category: 'Code',
  icon: '{}',
  keywords: ['minify', 'minifier', 'beautify', 'format', 'javascript', 'js', 'css', 'compress', 'pretty', 'prettify'],
  render(root) {
    let language: CodeLanguage = 'javascript'
    let action: 'minify' | 'beautify' = 'minify'
    let output = ''

    const input = textarea({ rows: 14, mono: true, value: SAMPLES[language], onInput: () => run() })
    const resultBlock = outputBlock('', { label: 'Output', copy: () => output })
    const sizes = stats()

    function run() {
      const source = input.value
      if (action === 'minify') {
        const result = minify(source, language)
        output = result.output
        const percent = result.before === 0 ? 0 : Math.round((result.saved / result.before) * 100)
        resultBlock.setLabel('Minified')
        resultBlock.setValue(output)
        resultBlock.setMeta(`${formatBytes(result.before)} → ${formatBytes(result.after)}`)
        sizes.replaceChildren(
          stat({ label: 'Before', value: formatBytes(result.before) }),
          stat({ label: 'After', value: formatBytes(result.after) }),
          stat({ label: 'Saved', value: `${percent}%`, hint: `${formatBytes(Math.max(result.saved, 0))} smaller` }),
        )
      } else {
        output = beautify(source, language)
        resultBlock.setLabel('Beautified')
        resultBlock.setValue(output)
        resultBlock.setMeta(`${source.length} → ${output.length} characters`)
        sizes.replaceChildren(
          stat({ label: 'Lines', value: String(output ? output.split('\n').length : 0) }),
          stat({ label: 'Characters', value: String(output.length) }),
          stat({ label: 'Language', value: language === 'css' ? 'CSS' : 'JavaScript' }),
        )
      }
    }

    const languageControl = segmented({
      label: 'Language',
      value: language,
      items: [
        { value: 'javascript', label: 'JavaScript' },
        { value: 'css', label: 'CSS' },
      ],
      onChange: (value) => {
        language = value as CodeLanguage
        input.value = SAMPLES[language]
        run()
      },
    })

    const actionControl = segmented({
      label: 'Action',
      value: action,
      items: [
        { value: 'minify', label: 'Minify' },
        { value: 'beautify', label: 'Beautify' },
      ],
      onChange: (value) => {
        action = value as 'minify' | 'beautify'
        run()
      },
    })

    const fileInput = el('input', { type: 'file', class: 'ts-code-file' }) as HTMLInputElement
    fileInput.accept = '.js,.mjs,.cjs,.jsx,.css,.txt,.md'
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      input.value = await readFileAsText(file)
      const guessed = detectLanguage(input.value)
      if (guessed !== language) {
        language = guessed
        languageControl.setValue(guessed)
      }
      run()
    })

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Input', icon: 'code' },
          languageControl,
          input,
          actions(
            el('label', { class: 'ts-k-button ts-code-filelabel' }, 'Load a file', fileInput),
            button('Load sample', { icon: 'refresh', onClick: () => { input.value = SAMPLES[language]; run() } }),
            button('Clear', { icon: 'x', onClick: () => { input.value = ''; run() } }),
          ),
        ),
        panel(
          { title: 'Result', icon: 'braces' },
          actionControl,
          sizes,
          actions(
            copyButton(() => output, { label: 'Copy output' }),
            button('Download', {
              icon: 'download',
              onClick: () => download(language === 'css' ? 'minified.css' : 'minified.js', output),
            }),
          ),
        ),
        resultBlock,
        note(
          'Nothing is sent anywhere and nothing is evaluated. The JavaScript pass is conservative: it removes comments and redundant whitespace but keeps every newline, because a newline is what separates two statements when there are no semicolons — so it cannot change what your code does.',
        ),
      ),
    )

    run()
  },
}

export default tool

