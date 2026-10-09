import {
  actions,
  badge,
  button,
  copyRow,
  note,
  panel,
  stat,
  stats,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  downloadsUrl,
  formatBytes,
  formatCount,
  manifestUrl,
  normalizePackage,
  parseDownloads,
  parseManifest,
  type PackageFacts,
} from './npm'

const SAMPLE = 'react'

const tool: Tool = {
  slug: 'npm-package',
  name: 'npm Package',
  description: 'Look up any npm package: latest version, license, size, dependencies and weekly downloads.',
  category: 'Developer',
  keywords: ['npm', 'package', 'registry', 'node', 'version', 'downloads', 'dependency', 'nodejs', 'module'],
  remote: {
    host: 'registry.npmjs.org',
    note: 'It asks the public npm registry for the package you name, and api.npmjs.org for its download count. Only the package name is sent; no account, no token, no cookies.',
  },
  render(root) {
    const input = textField({ value: SAMPLE, placeholder: 'Package name\u2026', onInput: () => queue() })
    input.spellcheck = false
    input.setAttribute('aria-label', 'npm package name')

    const status = el('div', { class: 'ts-k-actions' })
    const summary = stats()
    summary.hidden = true
    const facts = el('div', { class: 'ts-k-kvlist' })
    const description = el('div', { class: 'ts-k-prose' })

    let seq = 0
    let timer: number | undefined

    function queue() {
      window.clearTimeout(timer)
      timer = window.setTimeout(lookUp, 400)
    }

    function reset() {
      summary.hidden = true
      facts.replaceChildren()
      description.replaceChildren()
    }

    function paint(factsData: PackageFacts, weekly: number | null) {
      summary.hidden = false
      summary.replaceChildren(
        stat({ label: 'latest', value: factsData.version || '\u2014' }),
        stat({ label: 'license', value: factsData.license || '\u2014' }),
        stat({ label: 'size', value: formatBytes(factsData.unpackedSize) }),
        stat({ label: 'downloads', value: weekly === null ? '\u2014' : `${formatCount(weekly)}/wk` }),
      )
      description.replaceChildren(factsData.description ? el('p', {}, factsData.description) : '')
      facts.replaceChildren(
        copyRow('Package', factsData.name),
        copyRow('Version', factsData.version),
        copyRow('License', factsData.license || 'Unknown'),
        copyRow('Dependencies', String(factsData.dependencies)),
        copyRow('Maintainers', String(factsData.maintainers)),
        copyRow('Unpacked size', formatBytes(factsData.unpackedSize)),
        factsData.homepage ? copyRow('Homepage', factsData.homepage) : '',
        factsData.repository ? copyRow('Repository', factsData.repository) : '',
        copyRow('Registry', `https://www.npmjs.com/package/${factsData.name}`),
      )
    }

    async function lookUp() {
      const current = ++seq
      const name = normalizePackage(input.value)
      if (!name) {
        status.replaceChildren(input.value.trim() === '' ? '' : note('That is not a valid npm package name.', 'warn'))
        reset()
        return
      }

      status.replaceChildren(badge(`Looking up ${name}\u2026`, 'neutral'))
      try {
        const response = await fetch(manifestUrl(name), { headers: { accept: 'application/json' } })
        if (current !== seq) return
        if (response.status === 404) {
          status.replaceChildren(badge(`No package called \u201c${name}\u201d.`, 'warn'))
          reset()
          return
        }
        if (!response.ok) {
          status.replaceChildren(badge(`The registry returned HTTP ${response.status}.`, 'danger'))
          reset()
          return
        }
        const data = parseManifest(await response.json())
        if (current !== seq) return
        if (!data) {
          status.replaceChildren(badge('The registry returned something unexpected.', 'danger'))
          reset()
          return
        }
        let weekly: number | null = null
        try {
          const downloads = await fetch(downloadsUrl(name), { headers: { accept: 'application/json' } })
          if (current !== seq) return
          if (downloads.ok) weekly = parseDownloads(await downloads.json())
        } catch {
          // Downloads are a nice-to-have; the facts above already stand.
        }
        status.replaceChildren(badge(`Found ${data.name}@${data.version}`, 'ok'))
        paint(data, weekly)
      } catch {
        if (current !== seq) return
        status.replaceChildren(badge('Could not reach the npm registry. Check your connection.', 'danger'))
        reset()
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Package', icon: 'layers' },
          input,
          actions(
            button('Look up', { icon: 'search', variant: 'primary', onClick: () => void lookUp() }),
            button('Clear', {
              onClick: () => {
                input.value = ''
                input.focus()
                void lookUp()
              },
            }),
          ),
          status,
          note('This tool uses the network. It sends the package name to registry.npmjs.org and api.npmjs.org. That is the whole request \u2014 no token and no account.'),
        ),
        panel({ title: 'At a glance', icon: 'chart' }, summary, description),
        panel({ title: 'Facts', icon: 'info' }, facts),
      ),
    )

    void lookUp()
  },
}

export default tool
