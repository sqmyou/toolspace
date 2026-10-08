/**
 * package.json review.
 *
 * Nothing here talks to a registry, so it can only judge what the file says.
 * The useful part is therefore the version range classification and the script
 * scan: a caret range and a bare "*" mean very different things, and an install
 * hook that pipes a download into a shell is worth flagging before it runs.
 */

export class PackageError extends Error {}

export type DependencyType = 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies'

export type RangeKind = 'exact' | 'caret' | 'tilde' | 'range' | 'wildcard' | 'latest' | 'tag' | 'url' | 'git' | 'file' | 'workspace' | 'alias' | 'complex'

export interface Dependency {
  name: string
  range: string
  type: DependencyType
  kind: RangeKind
  risky: boolean
  note: string
}

export interface ScriptInfo {
  name: string
  command: string
  /** True for lifecycle hooks that run without being asked. */
  lifecycle: boolean
  risks: string[]
}

export interface PackageReport {
  name: string | null
  version: string | null
  private: boolean
  license: string | null
  type: string | null
  moduleType: 'module' | 'commonjs' | null
  dependencies: Dependency[]
  counts: Record<DependencyType, number>
  scripts: ScriptInfo[]
  lifecycleHooks: string[]
  risks: string[]
  duplicates: string[]
  metadata: Record<string, boolean>
  engines: Record<string, string>
  workspaces: string[]
  packageManager: string | null
}

const DEPENDENCY_TYPES: DependencyType[] = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

const LIFECYCLE = new Set(['preinstall', 'install', 'postinstall', 'prepublish', 'prepare', 'prepack', 'postpack', 'prepublishOnly'])

const RISKY_COMMANDS: [RegExp, string][] = [
  [/\b(curl|wget)\b[^|;&]*\|[^|;&]*\b(sh|bash|zsh|node|python)\b/i, 'Downloads a script and pipes it straight into a shell'],
  [/\b(curl|wget)\b/i, 'Fetches something from the network during install'],
  [/\brm\s+-rf\s+[/~]/i, 'Removes files outside the project directory'],
  [/\beval\b/i, 'Evaluates a string as code'],
  [/\bbase64\b[^|;&]*(-d|--decode)/i, 'Decodes a hidden payload'],
  [/\bchmod\s+777\b/, 'Makes a file world-writable'],
  [/\bnpm\s+(install|i)\s+-g\b/, 'Installs a package globally as a side effect'],
  [/\bpowershell\b/i, 'Runs PowerShell, which behaves differently across platforms'],
  [/\bgit\s+push\b/, 'Pushes to a remote from an install hook'],
]

/** Classify a version range into the kind of constraint it is. */
export function classifyRange(range: string): RangeKind {
  const text = range.trim()
  if (!text) return 'complex'
  if (text === '*' || text === 'x' || text === 'X') return 'wildcard'
  if (/^(latest|next|beta|alpha|canary|dev)$/i.test(text)) return 'latest'
  if (text.startsWith('workspace:')) return 'workspace'
  if (/^npm:/i.test(text)) return 'alias'
  if (/^https?:/i.test(text)) return 'url'
  if (/^(file:|link:|portal:)/i.test(text)) return 'file'
  if (/^(git\+|github:|gitlab:|bitbucket:|git@)/i.test(text) || /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(#.*)?$/.test(text)) return 'git'
  if (/^\d+(\.\d+){0,2}$/.test(text)) return 'exact'
  if (text.startsWith('^')) return 'caret'
  if (text.startsWith('~')) return 'tilde'
  if (/^[<>=|]/.test(text) || /\|\||\s/.test(text)) return 'range'
  return 'tag'
}

const KIND_NOTES: Record<RangeKind, string> = {
  exact: 'Pinned to one version, so updates are deliberate.',
  caret: 'Allows any minor and patch release within the same major version.',
  tilde: 'Allows patch releases within the same minor version.',
  range: 'An explicit range or set of ranges.',
  wildcard: 'Accepts any version at all, including a future breaking release.',
  latest: 'Follows a moving tag, so installs are not reproducible.',
  tag: 'A dist-tag rather than a version.',
  url: 'Points at a URL rather than a registry version.',
  git: 'Pulls straight from a git repository, so the contents can change without a version bump.',
  file: 'Refers to a path on this machine.',
  workspace: 'A workspace reference, resolved inside the repository.',
  alias: 'Installs another package under this name.',
  complex: 'Could not be classified.',
}

/** A dependency entry plus its range judgement. */
export function describeDependency(name: string, range: unknown, type: DependencyType): Dependency {
  if (typeof range !== 'string') throw new PackageError(`${name} has a version that is not a string`)
  const kind = classifyRange(range)
  const risky = ['wildcard', 'latest', 'url', 'git', 'file', 'tag', 'complex'].includes(kind)
  return { name, range, type, kind, risky, note: KIND_NOTES[kind] }
}

function scanScript(name: string, command: string): ScriptInfo {
  const risks: string[] = []
  for (const [pattern, message] of RISKY_COMMANDS) if (pattern.test(command)) risks.push(message)
  if (name === 'postinstall' || name === 'preinstall' || name === 'install') risks.push('Runs automatically on every install of this package')
  return { name, command, lifecycle: LIFECYCLE.has(name), risks }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function analysePackage(text: string): PackageReport {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    throw new PackageError(err instanceof Error ? err.message : 'That is not valid JSON')
  }
  if (!isObject(parsed)) throw new PackageError('A package.json must be a JSON object')

  const dependencies: Dependency[] = []
  const counts: Record<DependencyType, number> = { dependencies: 0, devDependencies: 0, peerDependencies: 0, optionalDependencies: 0 }
  const seen = new Map<string, DependencyType>()
  const duplicates: string[] = []

  for (const type of DEPENDENCY_TYPES) {
    const block = parsed[type]
    if (block === undefined) continue
    if (!isObject(block)) throw new PackageError(`${type} must be an object`)
    for (const [name, range] of Object.entries(block)) {
      const dependency = describeDependency(name, range, type)
      dependencies.push(dependency)
      counts[type] += 1
      const previous = seen.get(name)
      if (previous && previous !== type) duplicates.push(`${name} appears in both ${previous} and ${type}`)
      else seen.set(name, type)
    }
  }

  const scripts: ScriptInfo[] = []
  if (parsed.scripts !== undefined) {
    if (!isObject(parsed.scripts)) throw new PackageError('scripts must be an object')
    for (const [name, command] of Object.entries(parsed.scripts)) {
      if (typeof command !== 'string') throw new PackageError(`scripts.${name} must be a string`)
      scripts.push(scanScript(name, command))
    }
  }

  const risks: string[] = []
  for (const dependency of dependencies) {
    if (dependency.kind === 'wildcard') risks.push(`${dependency.name} accepts any version ("${dependency.range}")`)
    else if (dependency.kind === 'latest') risks.push(`${dependency.name} follows the moving tag "${dependency.range}"`)
    else if (dependency.kind === 'git') risks.push(`${dependency.name} is fetched from git (${dependency.range})`)
    else if (dependency.kind === 'url') risks.push(`${dependency.name} is fetched from a URL (${dependency.range})`)
    else if (dependency.kind === 'file') risks.push(`${dependency.name} points at a local path (${dependency.range})`)
  }
  for (const script of scripts) for (const risk of script.risks) risks.push(`scripts.${script.name}: ${risk}`)

  const engines: Record<string, string> = {}
  if (isObject(parsed.engines)) for (const [key, value] of Object.entries(parsed.engines)) engines[key] = String(value)

  const workspaces = Array.isArray(parsed.workspaces) ? parsed.workspaces.map(String) : isObject(parsed.workspaces) && Array.isArray(parsed.workspaces.packages) ? parsed.workspaces.packages.map(String) : []

  return {
    name: typeof parsed.name === 'string' ? parsed.name : null,
    version: typeof parsed.version === 'string' ? parsed.version : null,
    private: parsed.private === true,
    license: typeof parsed.license === 'string' ? parsed.license : null,
    type: typeof parsed.type === 'string' ? parsed.type : null,
    moduleType: parsed.type === 'module' ? 'module' : parsed.type === 'commonjs' ? 'commonjs' : null,
    dependencies,
    counts,
    scripts,
    lifecycleHooks: scripts.filter((script) => script.lifecycle).map((script) => script.name),
    risks,
    duplicates,
    metadata: {
      description: typeof parsed.description === 'string',
      main: parsed.main !== undefined,
      exports: parsed.exports !== undefined,
      types: parsed.types !== undefined || parsed.typings !== undefined,
      files: parsed.files !== undefined,
      repository: parsed.repository !== undefined,
      engines: Object.keys(engines).length > 0,
      sideEffects: parsed.sideEffects !== undefined,
      bin: parsed.bin !== undefined,
    },
    engines,
    workspaces,
    packageManager: typeof parsed.packageManager === 'string' ? parsed.packageManager : null,
  }
}

export interface Suggestion {
  level: 'warning' | 'info'
  message: string
}

/** Things worth adding or checking, based on what is already there. */
export function suggestions(report: PackageReport): Suggestion[] {
  const out: Suggestion[] = []
  if (!report.private && !report.license) out.push({ level: 'warning', message: 'No license field. Add one so users know the terms.' })
  if (!report.private && !report.metadata.repository) out.push({ level: 'info', message: 'No repository field, which npm uses for links and issue tracking.' })
  if (!report.metadata.engines) out.push({ level: 'info', message: 'No engines field. State the Node version you support.' })
  if (!report.packageManager) out.push({ level: 'info', message: 'No packageManager field. Adding one pins the package manager and version.' })
  if (report.counts.dependencies > 0 && !report.metadata.files) out.push({ level: 'info', message: 'No files field, so publishing would include everything not ignored.' })
  if (report.scripts.length > 0 && !report.scripts.some((script) => script.name === 'test')) out.push({ level: 'info', message: 'No test script.' })
  if (report.duplicates.length > 0) out.push({ level: 'warning', message: `${report.duplicates.length} package${report.duplicates.length === 1 ? '' : 's'} listed under more than one dependency type.` })
  if (report.counts.dependencies + report.counts.devDependencies > 50) out.push({ level: 'info', message: `A large dependency tree (${report.counts.dependencies} runtime, ${report.counts.devDependencies} dev) means more to keep patched.` })
  return out
}

export interface RangeGroup {
  kind: RangeKind
  count: number
  names: string[]
}

/** Group dependencies by how their version is expressed. */
export function groupByKind(dependencies: readonly Dependency[]): RangeGroup[] {
  const groups = new Map<RangeKind, string[]>()
  for (const dependency of dependencies) {
    const names = groups.get(dependency.kind) ?? []
    names.push(dependency.name)
    groups.set(dependency.kind, names)
  }
  return [...groups.entries()].map(([kind, names]) => ({ kind, count: names.length, names: names.sort() })).sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
}
