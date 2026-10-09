/**
 * GitHub profile lookup via the public REST API.
 *
 * A *network* tool: the username you type is sent to api.github.com, so the
 * tool declares itself with `remote`. All shaping of the response is pure and
 * takes the parsed JSON, so it is testable without the network.
 */

const API = 'https://api.github.com'

export interface GitHubUser {
  login: string
  name: string
  bio: string
  company: string
  location: string
  blog: string
  avatar: string
  url: string
  publicRepos: number
  followers: number
  following: number
  createdAt: string
}

export interface RepoSummary {
  name: string
  description: string
  url: string
  language: string
  stars: number
  forks: number
  updatedAt: string
}

export interface LanguageShare {
  language: string
  count: number
  share: number
}

/** Keep only what GitHub usernames are allowed to contain. */
export function normalizeUsername(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Enter a GitHub username.')
  // A pasted profile URL is common, so accept it and pull the login out.
  const fromUrl = trimmed.match(/github\.com\/([^/?#]+)/i)
  const login = (fromUrl ? fromUrl[1] : trimmed).replace(/^@/, '')
  if (login.length > 39) throw new Error('A GitHub username is at most 39 characters.')
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d]))*$/i.test(login)) {
    throw new Error('A GitHub username uses letters, digits and single hyphens, and cannot start or end with a hyphen.')
  }
  return login
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Shape the /users/:login response. Pure. */
export function parseUser(payload: unknown): GitHubUser {
  if (typeof payload !== 'object' || payload === null) throw new Error('GitHub returned something unexpected.')
  const data = payload as Record<string, unknown>
  const login = str(data.login)
  if (!login) throw new Error('That profile has no username.')
  return {
    login,
    name: str(data.name) || login,
    bio: str(data.bio),
    company: str(data.company),
    location: str(data.location),
    blog: str(data.blog),
    avatar: str(data.avatar_url),
    url: str(data.html_url) || `https://github.com/${login}`,
    publicRepos: num(data.public_repos),
    followers: num(data.followers),
    following: num(data.following),
    createdAt: str(data.created_at),
  }
}

/** Shape a /users/:login/repos response, most-starred first. Pure. */
export function parseRepos(payload: unknown): RepoSummary[] {
  if (!Array.isArray(payload)) return []
  return payload
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((repo) => ({
      name: str(repo.name),
      description: str(repo.description),
      url: str(repo.html_url),
      language: str(repo.language),
      stars: num(repo.stargazers_count),
      forks: num(repo.forks_count),
      updatedAt: str(repo.updated_at),
    }))
    .filter((repo) => repo.name && !repo.name.startsWith('.'))
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))
}

/** Share of repositories by primary language, most-used first. Pure. */
export function languageBreakdown(repos: RepoSummary[]): LanguageShare[] {
  const counts = new Map<string, number>()
  for (const repo of repos) {
    if (!repo.language) continue
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0)
  if (total === 0) return []
  return [...counts.entries()]
    .map(([language, count]) => ({ language, count, share: count / total }))
    .sort((a, b) => b.count - a.count || a.language.localeCompare(b.language))
}

export function userUrl(login: string): string {
  return `${API}/users/${encodeURIComponent(login)}`
}

export function reposUrl(login: string): string {
  return `${API}/users/${encodeURIComponent(login)}/repos?per_page=100&sort=updated`
}

/** A stable, readable date from GitHub's ISO timestamps. */
export function formatJoined(iso: string): string {
  if (!iso) return 'unknown'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}
