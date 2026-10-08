import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { validateCompose } from './compose'

const SAMPLE = `services:
  web:
    image: nginx
    ports:
      - "8080:80"
    volumes:
      - ./site:/usr/share/nginx/html:ro
    depends_on:
      - api
    restart: unless-stopped
  api:
    build:
      context: ./api
    environment:
      - NODE_ENV=production
    networks:
      - backend
networks:
  backend:`

const tool: Tool = {
  slug: 'docker-compose',
  name: 'docker-compose Checker',
  description: 'Validate a Compose file and catch ports, volumes, keys and references that will not work.',
  category: 'DevOps',
  keywords: ['docker', 'compose', 'yaml', 'containers', 'validate', 'services', 'ports', 'volumes'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 18, spellcheck: false }, SAMPLE) as HTMLTextAreaElement
    const counts = el('p', { class: 'ts-muted' })
    const overview = el('div', { class: 'ts-compose-overview' })
    const list = el('div', { class: 'ts-compose-list' })
    let report = ''

    function run() {
      overview.replaceChildren()
      list.replaceChildren()
      const result = validateCompose(input.value)
      counts.textContent = `${result.errorCount} error${result.errorCount === 1 ? '' : 's'} · ${result.warningCount} warning${result.warningCount === 1 ? '' : 's'}`

      const chips: [string, string[]][] = [
        ['Services', result.services],
        ['Networks', result.networks],
        ['Volumes', result.volumes],
      ]
      for (const [label, values] of chips) {
        overview.append(el('div', { class: 'ts-compose-chip' }, el('strong', {}, `${label} (${values.length})`), el('code', { class: 'ts-compose-names' }, values.join(', ') || '—')))
      }

      if (result.issues.length === 0) {
        list.append(el('p', { class: 'ts-muted' }, 'No problems found in what this checker inspects.'))
        report = 'Compose check: no problems found.\n'
        return
      }
      for (const issue of result.issues) {
        list.append(
          el(
            'div',
            { class: `ts-compose-issue ts-compose-${issue.level}` },
            el('span', { class: `ts-compose-level ts-compose-level-${issue.level}` }, issue.level === 'error' ? 'Error' : 'Warning'),
            el('div', { class: 'ts-compose-body' }, el('code', { class: 'ts-compose-path' }, issue.path || '(file)'), el('span', { class: 'ts-compose-message' }, issue.message)),
          ),
        )
      }
      report = result.issues.map((issue) => `${issue.level === 'error' ? 'ERROR' : 'WARN'} ${issue.path || '(file)'}: ${issue.message}`).join('\n') + '\n'
    }

    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'docker-compose.yml'), input),
        counts,
        overview,
        list,
        el('div', { class: 'ts-row ts-wrap' }, copyChip(() => report, 'Copy report'), el('button', { class: 'ts-button', type: 'button', onclick: () => download('compose-check.txt', report) }, 'Download report')),
        el('p', { class: 'ts-note' }, 'The YAML subset Compose files use is parsed here, so nothing is uploaded. Errors would stop the file working; warnings are things worth a second look.'),
      ),
    )

    run()
  },
}

export default tool
