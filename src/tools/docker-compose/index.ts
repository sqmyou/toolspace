import {
  actions,
  button,
  copyButton,
  field,
  findingRow,
  findings,
  note,
  panel,
  stat,
  stats,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { download } from '../../core/ui'
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
    const input = textarea({ rows: 18, value: SAMPLE, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const readout = stats()
    const issueList = findings()
    const groups = el('div', { class: 'ts-k-cards' })
    let report = ''

    function run() {
      error.hidden = true
      groups.replaceChildren()
      issueList.replaceChildren()
      const result = validateCompose(input.value)
      readout.replaceChildren(
        stat({ label: 'Services', value: String(result.services.length) }),
        stat({ label: 'Networks', value: String(result.networks.length) }),
        stat({ label: 'Volumes', value: String(result.volumes.length) }),
        stat({ label: 'Errors', value: String(result.errorCount) }),
        stat({ label: 'Warnings', value: String(result.warningCount) }),
      )

      for (const [label, values] of [['Services', result.services], ['Networks', result.networks], ['Volumes', result.volumes]] as [string, string[]][]) {
        groups.append(
          el(
            'div',
            { class: 'ts-k-card' },
            el('div', { class: 'ts-k-card__head' }, el('strong', { class: 'ts-k-card__title' }, `${label} (${values.length})`)),
            el('code', { class: 'ts-k-card__body' }, values.join(', ') || '—'),
          ),
        )
      }

      if (result.issues.length === 0) {
        issueList.append(note('No problems found in what this checker inspects.', 'ok'))
        report = 'Compose check: no problems found.\n'
        return
      }
      for (const issue of result.issues) {
        issueList.append(
          findingRow({
            status: issue.level === 'error' ? 'Error' : 'Warning',
            tone: issue.level === 'error' ? 'danger' : 'warn',
            name: issue.path || '(file)',
            message: issue.message,
          }),
        )
      }
      report = result.issues.map((issue) => `${issue.level === 'error' ? 'ERROR' : 'WARN'} ${issue.path || '(file)'}: ${issue.message}`).join('\n') + '\n'
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'docker-compose.yml', icon: 'file' }, field(input, { label: 'docker-compose.yml' }), error),
        panel({ title: 'Overview', icon: 'layers' }, readout, groups),
        panel(
          { title: 'Findings', icon: 'alert' },
          actions(copyButton(() => report, { label: 'Copy report', size: 'sm' }), button('Download report', { icon: 'download', onClick: () => download('compose-check.txt', report) })),
          issueList,
        ),
        note('The YAML subset Compose files use is parsed here. Errors would stop the file working; warnings are things worth a second look.'),
      ),
    )

    run()
  },
}

export default tool
