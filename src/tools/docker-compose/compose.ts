/**
 * A small YAML reader and a Compose file reviewer.
 *
 * Only the subset of YAML that Compose files use is supported: block mappings,
 * block sequences, flow collections, quoted scalars and comments. That is
 * enough to validate a file without pulling in a parser dependency, which the
 * project does not allow. Anything the reader cannot handle is reported as an
 * issue rather than silently accepted.
 */

export interface Issue {
  level: 'error' | 'warning'
  path: string
  message: string
  line?: number
}

export interface ComposeResult {
  issues: Issue[]
  services: string[]
  networks: string[]
  volumes: string[]
  errorCount: number
  warningCount: number
}

interface YamlLine {
  indent: number
  text: string
  line: number
}

export class ComposeError extends Error {
  line?: number
  constructor(message: string, line?: number) {
    super(message)
    this.line = line
  }
}

function tokenize(input: string): YamlLine[] {
  const lines: YamlLine[] = []
  input.split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim() || raw.trim().startsWith('#')) return
    const indentText = raw.match(/^[ \t]*/)?.[0] ?? ''
    if (indentText.includes('\t')) throw new ComposeError('Tabs cannot be used for indentation', index + 1)
    lines.push({ indent: indentText.length, text: raw.slice(indentText.length).trimEnd(), line: index + 1 })
  })
  return lines
}

function stripComment(text: string): string {
  let quote: string | null = null
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (quote === '"' && char === '\\') i += 1
      else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"') quote = char
    else if (char === '#' && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i).trimEnd()
  }
  return text.trimEnd()
}

function splitFlow(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let current = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      current += char
      if (quote === '"' && char === '\\' && i + 1 < text.length) {
        current += text[i + 1]
        i += 1
      } else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      current += char
    } else if (char === '[' || char === '{') {
      depth += 1
      current += char
    } else if (char === ']' || char === '}') {
      depth -= 1
      current += char
    } else if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else current += char
  }
  if (current.trim()) parts.push(current)
  return parts
}

function parseScalar(text: string): unknown {
  const trimmed = text.trim()
  if (trimmed === '') return null
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return splitFlow(trimmed.slice(1, -1)).map((part) => parseScalar(part))
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const map: Record<string, unknown> = {}
    for (const part of splitFlow(trimmed.slice(1, -1))) {
      const colon = part.indexOf(':')
      if (colon === -1) continue
      map[unquote(part.slice(0, colon).trim())] = parseScalar(part.slice(colon + 1))
    }
    return map
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) return trimmed.slice(1, -1).replace(/\\(.)/g, '$1')
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) return trimmed.slice(1, -1).replace(/''/g, "'")
  if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true'
  if (trimmed === 'null' || trimmed === '~') return null
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed)
  if (/^-?\d*\.\d+$/.test(trimmed)) return Number(trimmed)
  return trimmed
}

function unquote(text: string): string {
  const value = parseScalar(text)
  return typeof value === 'string' ? value : String(value ?? '')
}

/**
 * True when a sequence item opens a mapping, meaning it has a colon outside
 * quotes that is followed by a space or the end of the line. A bare value such
 * as "8080:80" has a colon but no space after it, so it stays a scalar.
 */
function isMappingItem(text: string): boolean {
  let quote: string | null = null
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (quote === '"' && char === '\\') i += 1
      else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"') quote = char
    else if (char === ':') {
      const next = text[i + 1]
      if (next === undefined || next === ' ' || next === '\t') return true
    }
  }
  return false
}

function parseBlock(lines: YamlLine[], index: number, indent: number, path: string[], duplicates: string[]): [unknown, number] {
  const first = lines[index]
  if (first.text === '-' || first.text.startsWith('- ')) return parseSequence(lines, index, indent, path, duplicates)
  return parseMapping(lines, index, indent, path, duplicates)
}

function parseMapping(lines: YamlLine[], index: number, indent: number, path: string[], duplicates: string[]): [Record<string, unknown>, number] {
  const map: Record<string, unknown> = {}
  while (index < lines.length) {
    const line = lines[index]
    if (line.indent < indent) break
    if (line.indent > indent) throw new ComposeError(`Unexpected indentation on line ${line.line}`, line.line)
    const text = stripComment(line.text)
    const colon = text.indexOf(':')
    if (colon === -1) throw new ComposeError(`Expected "key: value" on line ${line.line}`, line.line)
    const key = unquote(text.slice(0, colon).trim())
    const rest = text.slice(colon + 1).trim()
    if (!key) throw new ComposeError(`Missing key on line ${line.line}`, line.line)
    if (Object.prototype.hasOwnProperty.call(map, key)) duplicates.push([...path, key].join('.'))
    index += 1
    if (rest === '') {
      if (index < lines.length && lines[index].indent > indent) {
        const [value, next] = parseBlock(lines, index, lines[index].indent, [...path, key], duplicates)
        map[key] = value
        index = next
      } else map[key] = null
    } else map[key] = parseScalar(rest)
  }
  return [map, index]
}

function parseSequence(lines: YamlLine[], index: number, indent: number, path: string[], duplicates: string[]): [unknown[], number] {
  const items: unknown[] = []
  while (index < lines.length) {
    const line = lines[index]
    if (line.indent < indent) break
    if (line.indent > indent) throw new ComposeError(`Unexpected indentation on line ${line.line}`, line.line)
    if (line.text !== '-' && !line.text.startsWith('- ')) break
    const rest = stripComment(line.text.slice(1).trim())
    const lineNumber = line.line
    index += 1
    if (rest === '') {
      if (index < lines.length && lines[index].indent > indent) {
        const [value, next] = parseBlock(lines, index, lines[index].indent, path, duplicates)
        items.push(value)
        index = next
      } else items.push(null)
      continue
    }
    if (isMappingItem(rest)) {
      // "- key: value" starts a mapping; re-read this line as if the dash were
      // indentation so the mapping parser can take over.
      const inner = indent + 2
      lines[index - 1] = { indent: inner, text: rest, line: lineNumber }
      const [value, next] = parseBlock(lines, index - 1, inner, path, duplicates)
      items.push(value)
      index = next
      continue
    }
    items.push(parseScalar(rest))
  }
  return [items, index]
}

export interface ParseOutcome {
  value: unknown
  duplicates: string[]
}

export function parseYaml(input: string): ParseOutcome {
  const lines = tokenize(input)
  if (lines.length === 0) return { value: {}, duplicates: [] }
  const duplicates: string[] = []
  const [value, index] = parseBlock(lines, 0, lines[0].indent, [], duplicates)
  if (index < lines.length) throw new ComposeError(`Could not read line ${lines[index].line}`, lines[index].line)
  return { value, duplicates }
}

const TOP_LEVEL = ['version', 'services', 'networks', 'volumes', 'configs', 'secrets', 'name', 'include']

const SERVICE_KEYS = new Set([
  'build', 'image', 'container_name', 'command', 'entrypoint', 'environment', 'env_file', 'expose', 'ports', 'volumes', 'volumes_from',
  'depends_on', 'networks', 'restart', 'healthcheck', 'labels', 'deploy', 'cap_add', 'cap_drop', 'devices', 'dns', 'dns_search', 'extra_hosts',
  'hostname', 'init', 'ipc', 'logging', 'network_mode', 'pid', 'platform', 'privileged', 'profiles', 'pull_policy', 'read_only', 'secrets',
  'security_opt', 'shm_size', 'stdin_open', 'stop_grace_period', 'stop_signal', 'sysctls', 'tmpfs', 'tty', 'ulimits', 'user', 'userns_mode',
  'working_dir', 'configs', 'links', 'external_links', 'group_add', 'mem_limit', 'mem_reservation', 'cpus', 'cpu_shares', 'cgroup_parent',
  'runtime', 'isolation', 'mac_address', 'oom_kill_disable', 'oom_score_adj', 'pids_limit', 'scale', 'storage_opt', 'volume_driver', 'gpus',
  'credential_spec', 'annotations', 'attach', 'domainname', 'extends', 'develop', 'blkio_config', 'cpu_count', 'cpu_percent', 'cpu_period',
  'cpu_quota', 'cpu_rt_period', 'cpu_rt_runtime', 'cpuset', 'mem_swappiness', 'memswap_limit', 'cpuset',
])

const RESTART_POLICIES = /^(no|always|unless-stopped|on-failure(:\d+)?)$/
const VOLUME_MODES = new Set(['ro', 'rw', 'z', 'Z', 'cached', 'delegated', 'consistent', 'nocopy', 'shared', 'slave', 'private', 'rshared', 'rslave', 'rprivate'])
const VOLUME_TYPES = new Set(['bind', 'volume', 'tmpfs', 'npipe', 'cluster', 'image'])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPort(part: string): boolean {
  if (/^\$\{[^}]+\}$/.test(part)) return true
  if (/^\d+$/.test(part)) return Number(part) >= 1 && Number(part) <= 65535
  const range = /^(\d+)-(\d+)$/.exec(part)
  return range ? Number(range[1]) >= 1 && Number(range[2]) <= 65535 && Number(range[1]) <= Number(range[2]) : false
}

/** Returns a complaint about a port entry, or null when it looks valid. */
export function checkPort(entry: unknown): string | null {
  if (typeof entry === 'number') return isPort(String(entry)) ? null : `${entry} is not a valid port number`
  if (isObject(entry)) {
    if (entry.target === undefined) return 'A long-form port needs a target'
    if (typeof entry.target === 'number' && !isPort(String(entry.target))) return `${entry.target} is not a valid target port`
    if (entry.protocol !== undefined && entry.protocol !== 'tcp' && entry.protocol !== 'udp') return `Protocol must be tcp or udp, not ${String(entry.protocol)}`
    return null
  }
  if (typeof entry !== 'string') return 'A port must be a string or a number'
  const withoutProtocol = entry.replace(/\/(tcp|udp)$/i, '')
  const parts = withoutProtocol.split(':')
  if (parts.length > 3) return `${entry} has too many parts`
  if (parts.some((part) => part === '')) return `${entry} has an empty part`
  // With three parts the first one is a host address, which is not a port.
  if (parts.length === 3 && /\s/.test(parts[0])) return `${parts[0]} is not a valid host`
  for (const part of parts.slice(-2)) {
    if (!isPort(part)) return `${part} is not a valid port, range or variable`
  }
  return null
}

/** Returns a complaint about a volume entry, or null when it looks valid. */
export function checkVolume(entry: unknown): string | null {
  if (isObject(entry)) {
    const type = typeof entry.type === 'string' ? entry.type : 'volume'
    if (!VOLUME_TYPES.has(type)) return `Unknown volume type ${type}`
    if (entry.target === undefined) return 'A long-form volume needs a target'
    if (type === 'bind' && entry.source === undefined) return 'A bind mount needs a source'
    return null
  }
  if (typeof entry !== 'string') return 'A volume must be a string or a long-form mapping'
  if (entry.includes('\t')) return 'A volume cannot contain a tab'
  const parts = entry.split(':')
  if (parts.length > 3) return `${entry} has too many parts`
  if (parts.length === 3) {
    for (const mode of parts[2].split(',')) if (!VOLUME_MODES.has(mode)) return `Unknown volume mode ${mode}`
  }
  if (parts.some((part) => part === '')) return `${entry} has an empty part`
  return null
}

function checkEnvironment(value: unknown): string | null {
  if (isObject(value)) return null
  if (!Array.isArray(value)) return 'Environment must be a mapping or a list'
  for (const entry of value) {
    if (typeof entry !== 'string') return 'Every environment entry must be a string'
    if (!/^[A-Za-z_][A-Za-z0-9_]*=(.*)$/s.test(entry) && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry)) return `${entry} is not NAME=value or NAME`
  }
  return null
}

function checkDependsOn(value: unknown): string | null {
  if (Array.isArray(value)) return value.every((entry) => typeof entry === 'string') ? null : 'Every depends_on entry must be a service name'
  if (isObject(value)) {
    for (const [name, config] of Object.entries(value)) {
      if (config !== null && !isObject(config)) return `depends_on.${name} must be a mapping`
      const condition = isObject(config) ? config.condition : undefined
      if (condition !== undefined && !['service_started', 'service_healthy', 'service_completed_successfully'].includes(String(condition))) {
        return `depends_on.${name} has an unknown condition ${String(condition)}`
      }
    }
    return null
  }
  return 'depends_on must be a list or a mapping'
}

function push(issues: Issue[], level: Issue['level'], path: string, message: string): void {
  issues.push({ level, path, message })
}

/** Validate a Compose file and return everything worth knowing. */
export function validateCompose(input: string): ComposeResult {
  const issues: Issue[] = []
  const empty: ComposeResult = { issues, services: [], networks: [], volumes: [], errorCount: 0, warningCount: 0 }

  let parsed: ParseOutcome
  try {
    parsed = parseYaml(input)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read that YAML'
    push(issues, 'error', '', message)
    return { ...empty, errorCount: 1 }
  }

  for (const duplicate of parsed.duplicates) push(issues, 'error', duplicate, 'This key is set more than once; the last value wins')

  const root = parsed.value
  if (!isObject(root)) {
    push(issues, 'error', '', 'The top level of a Compose file must be a mapping')
    return { ...empty, errorCount: issues.length }
  }

  for (const key of Object.keys(root)) {
    if (!TOP_LEVEL.includes(key) && !key.startsWith('x-')) push(issues, 'warning', key, `Unknown top-level key "${key}"`)
  }

  if (root.version !== undefined) push(issues, 'warning', 'version', 'The version field is obsolete; Compose v2 ignores it')

  const services = root.services
  if (services === undefined) {
    push(issues, 'error', 'services', 'A Compose file needs a services section')
    return { ...empty, errorCount: issues.length }
  }
  if (!isObject(services)) {
    push(issues, 'error', 'services', 'services must be a mapping of service names')
    return { ...empty, errorCount: issues.length }
  }
  if (Object.keys(services).length === 0) push(issues, 'warning', 'services', 'No services are defined')

  for (const [name, service] of Object.entries(services)) {
    const path = `services.${name}`
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) push(issues, 'warning', path, `Service name "${name}" should use letters, digits, dots, dashes or underscores`)
    if (!isObject(service)) {
      push(issues, 'error', path, 'A service must be a mapping')
      continue
    }

    if (service.image === undefined && service.build === undefined) push(issues, 'error', path, 'A service needs an image or a build section')
    if (service.image !== undefined && typeof service.image !== 'string') push(issues, 'error', `${path}.image`, 'image must be a string')
    if (service.image !== undefined && typeof service.image === 'string' && !service.image.includes(':') && !service.image.includes('@') && !service.image.startsWith('${')) {
      push(issues, 'warning', `${path}.image`, `"${service.image}" has no tag, so it resolves to latest`)
    }
    if (service.build !== undefined && typeof service.build !== 'string' && !isObject(service.build)) push(issues, 'error', `${path}.build`, 'build must be a path or a mapping')

    if (service.container_name !== undefined && typeof service.container_name !== 'string') push(issues, 'error', `${path}.container_name`, 'container_name must be a string')

    for (const key of Object.keys(service)) {
      if (!SERVICE_KEYS.has(key) && !key.startsWith('x-')) push(issues, 'warning', `${path}.${key}`, `Unknown service key "${key}"`)
    }

    if (service.ports !== undefined) {
      if (!Array.isArray(service.ports)) push(issues, 'error', `${path}.ports`, 'ports must be a list')
      else for (const [index, entry] of service.ports.entries()) {
        const problem = checkPort(entry)
        if (problem) push(issues, 'error', `${path}.ports[${index}]`, problem)
      }
    }

    if (service.expose !== undefined) {
      if (!Array.isArray(service.expose)) push(issues, 'error', `${path}.expose`, 'expose must be a list')
      else for (const entry of service.expose) {
        const text = typeof entry === 'number' ? String(entry) : typeof entry === 'string' ? entry : ''
        if (!text || (!isPort(text) && !/^\d+-\d+$/.test(text))) push(issues, 'error', `${path}.expose`, `${String(entry)} is not a valid port`)
      }
    }

    if (service.volumes !== undefined) {
      if (!Array.isArray(service.volumes)) push(issues, 'error', `${path}.volumes`, 'volumes must be a list')
      else for (const [index, entry] of service.volumes.entries()) {
        const problem = checkVolume(entry)
        if (problem) push(issues, 'error', `${path}.volumes[${index}]`, problem)
      }
    }

    if (service.environment !== undefined) {
      const problem = checkEnvironment(service.environment)
      if (problem) push(issues, 'error', `${path}.environment`, problem)
    }

    if (service.depends_on !== undefined) {
      const problem = checkDependsOn(service.depends_on)
      if (problem) push(issues, 'error', `${path}.depends_on`, problem)
    }

    if (service.restart !== undefined) {
      const value = service.restart
      if (typeof value !== 'string' || !RESTART_POLICIES.test(value)) push(issues, 'error', `${path}.restart`, `restart must be one of no, always, unless-stopped or on-failure[:n], not ${JSON.stringify(value)}`)
    }

    if (service.networks !== undefined && !Array.isArray(service.networks) && !isObject(service.networks)) push(issues, 'error', `${path}.networks`, 'networks must be a list or a mapping')

    if (service.healthcheck !== undefined) {
      if (!isObject(service.healthcheck)) push(issues, 'error', `${path}.healthcheck`, 'healthcheck must be a mapping')
      else if (service.healthcheck.test === undefined) push(issues, 'warning', `${path}.healthcheck`, 'A healthcheck with no test does nothing')
    }

    if (service.command !== undefined && typeof service.command !== 'string' && !Array.isArray(service.command)) push(issues, 'error', `${path}.command`, 'command must be a string or a list')
    if (service.entrypoint !== undefined && typeof service.entrypoint !== 'string' && !Array.isArray(service.entrypoint)) push(issues, 'error', `${path}.entrypoint`, 'entrypoint must be a string or a list')

    if (service.privileged === true) push(issues, 'warning', `${path}.privileged`, 'A privileged container has full access to the host')

    if (isObject(service.build)) {
      if (service.build.context !== undefined && typeof service.build.context !== 'string') push(issues, 'error', `${path}.build.context`, 'context must be a string')
      if (service.build.dockerfile !== undefined && typeof service.build.dockerfile !== 'string') push(issues, 'error', `${path}.build.dockerfile`, 'dockerfile must be a string')
    }
  }

  const networks = isObject(root.networks) ? Object.keys(root.networks) : []
  const volumes = isObject(root.volumes) ? Object.keys(root.volumes) : []
  if (root.networks !== undefined && !isObject(root.networks)) push(issues, 'error', 'networks', 'networks must be a mapping')
  if (root.volumes !== undefined && !isObject(root.volumes)) push(issues, 'error', 'volumes', 'volumes must be a mapping')

  // Every network and volume a service names should exist at the top level.
  for (const [name, service] of Object.entries(services)) {
    if (!isObject(service)) continue
    if (Array.isArray(service.networks)) {
      for (const network of service.networks) if (typeof network === 'string' && root.networks !== undefined && !networks.includes(network)) {
        push(issues, 'warning', `services.${name}.networks`, `Network "${network}" is not defined at the top level`)
      }
    }
    if (Array.isArray(service.volumes)) {
      for (const entry of service.volumes) {
        const source = typeof entry === 'string' ? entry.split(':')[0] : isObject(entry) && entry.type === 'volume' ? entry.source : undefined
        if (typeof source === 'string' && source && !source.startsWith('.') && !source.startsWith('/') && !source.startsWith('${') && root.volumes !== undefined && !volumes.includes(source)) {
          push(issues, 'warning', `services.${name}.volumes`, `Named volume "${source}" is not defined at the top level`)
        }
      }
    }
  }

  return {
    issues,
    services: Object.keys(services),
    networks,
    volumes,
    errorCount: issues.filter((issue) => issue.level === 'error').length,
    warningCount: issues.filter((issue) => issue.level === 'warning').length,
  }
}
