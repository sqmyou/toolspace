import { describe, expect, it } from 'vitest'
import {
  formatJoined,
  languageBreakdown,
  normalizeUsername,
  parseRepos,
  parseUser,
  reposUrl,
  userUrl,
} from './github'

const USER = {
  login: 'torvalds',
  name: 'Linus Torvalds',
  bio: null,
  company: 'Linux Foundation',
  location: 'Portland, OR',
  blog: '',
  avatar_url: 'https://avatars.githubusercontent.com/u/1024025?v=4',
  html_url: 'https://github.com/torvalds',
  public_repos: 12,
  followers: 326923,
  following: 0,
  created_at: '2011-09-03T15:26:22Z',
}

const REPOS = [
  { name: 'linux', description: 'Linux kernel', html_url: 'https://github.com/torvalds/linux', language: 'C', stargazers_count: 190000, forks_count: 54000, updated_at: '2024-01-01T00:00:00Z' },
  { name: 'test-tlb', description: '', html_url: 'https://github.com/torvalds/test-tlb', language: 'C', stargazers_count: 300, forks_count: 20, updated_at: '2020-01-01T00:00:00Z' },
  { name: '.github', description: 'hidden', html_url: 'https://github.com/torvalds/.github', language: null, stargazers_count: 99, forks_count: 1, updated_at: '2020-01-01T00:00:00Z' },
  { name: 'subsurface', description: 'dive log', html_url: 'https://github.com/torvalds/subsurface', language: 'C++', stargazers_count: 1500, forks_count: 400, updated_at: '2023-01-01T00:00:00Z' },
]

describe('normalizeUsername', () => {
  it('accepts a bare login and an @handle', () => {
    expect(normalizeUsername(' torvalds ')).toBe('torvalds')
    expect(normalizeUsername('@torvalds')).toBe('torvalds')
  })

  it('pulls the login out of a pasted profile URL', () => {
    expect(normalizeUsername('https://github.com/torvalds/linux')).toBe('torvalds')
    expect(normalizeUsername('github.com/torvalds')).toBe('torvalds')
  })

  it('rejects empty input', () => {
    expect(() => normalizeUsername('  ')).toThrow(/Enter a GitHub username/)
  })

  it('rejects illegal characters and bad hyphens', () => {
    expect(() => normalizeUsername('bad name')).toThrow(/letters, digits/)
    expect(() => normalizeUsername('-leading')).toThrow(/letters, digits/)
    expect(() => normalizeUsername('trailing-')).toThrow(/letters, digits/)
    expect(() => normalizeUsername('double--hyphen')).toThrow(/letters, digits/)
  })

  it('accepts the longest legal username', () => {
    expect(normalizeUsername('a'.repeat(39))).toBe('a'.repeat(39))
    expect(() => normalizeUsername('a'.repeat(40))).toThrow(/39 characters/)
  })
})

describe('parseUser', () => {
  it('shapes a profile and falls back on missing fields', () => {
    const user = parseUser(USER)
    expect(user.login).toBe('torvalds')
    expect(user.name).toBe('Linus Torvalds')
    expect(user.bio).toBe('')
    expect(user.followers).toBe(326923)
    expect(user.url).toBe('https://github.com/torvalds')
  })

  it('falls back to the login when the name is absent', () => {
    expect(parseUser({ login: 'ghost' }).name).toBe('ghost')
  })

  it('throws on a missing login and on non-objects', () => {
    expect(() => parseUser(null)).toThrow(/unexpected/)
    expect(() => parseUser({ login: '' })).toThrow(/no username/)
  })

  it('coerces nonsense numbers to zero', () => {
    expect(parseUser({ login: 'x', followers: 'many', public_repos: NaN }).publicRepos).toBe(0)
  })
})

describe('parseRepos', () => {
  it('drops dotfiles, sorts by stars and tolerates junk', () => {
    const repos = parseRepos([...REPOS, null, 'nope'])
    expect(repos.map((r) => r.name)).toEqual(['linux', 'subsurface', 'test-tlb'])
    expect(repos[0].stars).toBe(190000)
    expect(repos[1].language).toBe('C++')
    expect(repos.find((r) => r.name === '.github')).toBeUndefined()
  })

  it('returns an empty list for a non-array body', () => {
    expect(parseRepos({ message: 'Not Found' })).toEqual([])
  })
})

describe('languageBreakdown', () => {
  it('computes shares that add up to one and ignores null languages', () => {
    const breakdown = languageBreakdown(parseRepos(REPOS))
    expect(breakdown[0]).toEqual({ language: 'C', count: 2, share: 2 / 3 })
    expect(breakdown.reduce((sum, entry) => sum + entry.share, 0)).toBeCloseTo(1)
    expect(breakdown.map((entry) => entry.language)).toEqual(['C', 'C++'])
  })

  it('handles an empty set', () => {
    expect(languageBreakdown([])).toEqual([])
    expect(languageBreakdown([{ name: 'x', description: '', url: '', language: '', stars: 0, forks: 0, updatedAt: '' }])).toEqual([])
  })
})

describe('urls and dates', () => {
  it('encodes the login in both urls', () => {
    expect(userUrl('torvalds')).toBe('https://api.github.com/users/torvalds')
    expect(reposUrl('a b')).toContain('/users/a%20b/repos')
  })

  it('formats a date and degrades gracefully', () => {
    expect(formatJoined('2011-09-03T15:26:22Z')).toMatch(/2011/)
    expect(formatJoined('')).toBe('unknown')
    expect(formatJoined('not a date')).toBe('unknown')
  })
})
