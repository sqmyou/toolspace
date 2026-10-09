import {
  actions,
  badge,
  button,
  copyRow,
  imageBlock,
  meter,
  note,
  panel,
  stat,
  stats,
  table,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  formatJoined,
  languageBreakdown,
  normalizeUsername,
  parseRepos,
  parseUser,
  reposUrl,
  userUrl,
  type GitHubUser,
  type RepoSummary,
} from './github'

const tool: Tool = {
  slug: 'github-profile',
  name: 'GitHub Profile Lookup',
  description: 'Look up any public GitHub profile — repos, stars, languages and join date — straight from the public API.',
  category: 'Network',
  keywords: ['github', 'profile', 'user', 'repos', 'repositories', 'stars', 'developer', 'api', 'avatar'],
  remote: {
    host: 'api.github.com',
    note: 'It asks api.github.com for the public profile and repositories of the username you type, and loads that avatar image from avatars.githubusercontent.com. Both are public, unauthenticated endpoints; no token, cookie or personal data is sent.',
  },
  render(root) {
    const input = textField({ value: 'torvalds', placeholder: 'GitHub username or profile URL', onInput: () => queue() })
    input.spellcheck = false
    input.setAttribute('aria-label', 'GitHub username')

    const status = el('div', { class: 'ts-k-actions' })
    const summary = stats()
    summary.hidden = true
    const profile = el('div', { class: 'ts-k-kvlist' })
    const langs = el('div', { class: 'ts-k-kvlist' })
    const langsPanel = panel({ title: 'Languages', icon: 'code' }, langs)
    langsPanel.hidden = true
    const reposOut = el('div', {})

    let seq = 0
    let timer: number | undefined

    const avatar = imageBlock({ title: 'Avatar', alt: 'GitHub avatar', maxHeight: 200 })

    function queue() {
      window.clearTimeout(timer)
      timer = window.setTimeout(lookUp, 450)
    }

    async function lookUp() {
      const current = ++seq
      let login: string
      try {
        login = normalizeUsername(input.value)
      } catch (err) {
        status.replaceChildren(badge(err instanceof Error ? err.message : 'Enter a username.', 'warn'))
        summary.hidden = true
        profile.replaceChildren()
        reposOut.replaceChildren()
        langsPanel.hidden = true
        return
      }

      status.replaceChildren(badge(`Looking up ${login}…`, 'neutral'))
      try {
        const [userRes, repoRes] = await Promise.all([
          fetch(userUrl(login), { headers: { accept: 'application/vnd.github+json' } }),
          fetch(reposUrl(login), { headers: { accept: 'application/vnd.github+json' } }),
        ])
        if (current !== seq) return
        if (userRes.status === 404) {
          status.replaceChildren(badge(`No GitHub user called “${login}”.`, 'danger'))
          summary.hidden = true
          profile.replaceChildren()
          reposOut.replaceChildren()
          langsPanel.hidden = true
          return
        }
        if (userRes.status === 403) {
          status.replaceChildren(badge('GitHub is rate-limiting anonymous requests. Try again in a minute.', 'warn'))
          return
        }
        if (!userRes.ok) {
          status.replaceChildren(badge(`GitHub returned HTTP ${userRes.status}.`, 'danger'))
          return
        }
        const user = parseUser(await userRes.json())
        const repos = repoRes.ok ? parseRepos(await repoRes.json()) : []
        if (current !== seq) return
        paint(user, repos)
      } catch {
        if (current !== seq) return
        status.replaceChildren(badge('Could not reach GitHub. Check your connection and try again.', 'danger'))
        summary.hidden = true
        profile.replaceChildren()
        reposOut.replaceChildren()
        langsPanel.hidden = true
      }
    }

    function paint(user: GitHubUser, repos: RepoSummary[]) {
      status.replaceChildren(badge(`@${user.login}`, 'ok'))

      const totalStars = repos.reduce((sum, repo) => sum + repo.stars, 0)
      summary.replaceChildren(
        stat({ label: 'repos', value: String(user.publicRepos) }),
        stat({ label: 'followers', value: user.followers.toLocaleString() }),
        stat({ label: 'following', value: user.following.toLocaleString() }),
        stat({ label: 'stars (top repos)', value: totalStars.toLocaleString() }),
      )
      summary.hidden = false

      avatar.image.src = user.avatar
      avatar.image.alt = `Avatar for ${user.name}`
      avatar.caption.textContent = user.name === user.login ? '' : user.name

      const rows = [copyRow('Profile', user.url)]
      if (user.bio) rows.unshift(copyRow('Bio', user.bio, { copy: false }))
      if (user.company) rows.push(copyRow('Company', user.company, { copy: false }))
      if (user.location) rows.push(copyRow('Location', user.location, { copy: false }))
      if (user.blog) rows.push(copyRow('Website', user.blog))
      rows.push(copyRow('Joined', formatJoined(user.createdAt), { copy: false }))
      profile.replaceChildren(...rows)

      const breakdown = languageBreakdown(repos)
      if (breakdown.length === 0) {
        langsPanel.hidden = true
      } else {
        langsPanel.hidden = false
        langs.replaceChildren(
          ...breakdown.slice(0, 6).map((entry) => {
            const bar = meter()
            bar.set(entry.share > 0.5 ? 4 : entry.share > 0.2 ? 3 : 2, entry.share)
            return el(
              'div',
              { class: 'ts-k-kv' },
              el('span', { class: 'ts-k-kv__label' }, entry.language),
              bar.root,
              el('span', { class: 'ts-k-kv__value ts-k-mono' }, `${Math.round(entry.share * 100)}%`),
            )
          }),
        )
      }

      if (repos.length === 0) {
        reposOut.replaceChildren(note('No public repositories were returned.', 'neutral'))
      } else {
        reposOut.replaceChildren(
          table(
            [
              { key: 'name', label: 'Repository', mono: true },
              { key: 'language', label: 'Language' },
              { key: 'stars', label: 'Stars', mono: true },
              { key: 'description', label: 'Description' },
            ],
            repos.slice(0, 30).map((repo) => ({
              name: repo.name,
              language: repo.language || '—',
              stars: repo.stars.toLocaleString(),
              description: repo.description || '—',
            })),
          ),
        )
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Lookup', icon: 'globe' },
          input,
          status,
          summary,
          actions(button('Look up', { icon: 'search', variant: 'primary', onClick: lookUp })),
          note('This tool uses the network. It reads the public GitHub profile for the username you type — no token, no sign-in, no personal data leaves this page.'),
        ),
        el('div', { class: 'ts-k-split' }, panel({ title: 'Profile', icon: 'file' }, profile), avatar.root),
        langsPanel,
        panel({ title: 'Top repositories', icon: 'star' }, reposOut),
      ),
    )

    void lookUp()
  },
}

export default tool
