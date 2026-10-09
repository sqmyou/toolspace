import {
  actions,
  badge,
  button,
  copyRow,
  imageBlock,
  note,
  panel,
  stat,
  stats,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { formatCount, normalizeHandle, parseProfile, profileUrl, webUrl, type BskyProfile } from './bluesky'

const SAMPLE = 'bsky.app'

const tool: Tool = {
  slug: 'bluesky-profile',
  name: 'Bluesky Profile',
  description: 'Look up a public Bluesky profile: display name, bio, banner, avatar and follower counts.',
  category: 'Network',
  keywords: ['bluesky', 'bsky', 'atproto', 'social', 'profile', 'handle', 'followers', 'did', 'decentralized'],
  remote: {
    host: 'public.api.bsky.app',
    note: 'It reads the public Bluesky profile (and its public avatar/banner images from cdn.bsky.app) for the handle you type. Only the handle is sent; no sign-in, no token, no cookies.',
  },
  render(root) {
    const input = textField({ value: SAMPLE, placeholder: 'Handle or bsky.app link\u2026', onInput: () => queue() })
    input.spellcheck = false
    input.setAttribute('aria-label', 'Bluesky handle or profile link')

    const status = el('div', { class: 'ts-k-actions' })
    const summary = stats()
    summary.hidden = true
    const facts = el('div', { class: 'ts-k-kvlist' })
    const bio = el('div', { class: 'ts-k-prose' })
    const avatar = imageBlock({ title: 'Avatar', alt: 'Profile avatar', maxHeight: 200 })
    avatar.root.hidden = true

    let seq = 0
    let timer: number | undefined

    function queue() {
      window.clearTimeout(timer)
      timer = window.setTimeout(lookUp, 450)
    }

    function reset() {
      summary.hidden = true
      facts.replaceChildren()
      bio.replaceChildren()
      avatar.image.removeAttribute('src')
      avatar.root.hidden = true
    }

    function paint(profile: BskyProfile) {
      summary.hidden = false
      summary.replaceChildren(
        stat({ label: 'followers', value: formatCount(profile.followers) }),
        stat({ label: 'following', value: formatCount(profile.follows) }),
        stat({ label: 'posts', value: formatCount(profile.posts) }),
      )
      bio.replaceChildren(
        el('h3', { class: 'ts-k-prose__title' }, profile.displayName || `@${profile.handle}`),
        profile.description ? el('p', {}, profile.description) : el('p', {}, 'No bio.'),
      )
      facts.replaceChildren(
        copyRow('Handle', `@${profile.handle}`),
        copyRow('DID', profile.did),
        profile.displayName ? copyRow('Display name', profile.displayName) : '',
        copyRow('Profile', webUrl(profile.handle)),
      )
      if (profile.avatar) {
        avatar.image.referrerPolicy = 'no-referrer'
        avatar.image.alt = `${profile.displayName || profile.handle} avatar`
        avatar.image.src = profile.avatar
        avatar.caption.textContent = ''
      } else {
        avatar.image.removeAttribute('src')
        avatar.root.hidden = true
      }
    }

    async function lookUp() {
      const current = ++seq
      const handle = normalizeHandle(input.value)
      if (!handle) {
        status.replaceChildren(input.value.trim() === '' ? '' : note('Enter a Bluesky handle like @name.bsky.social, or a profile link.', 'warn'))
        reset()
        return
      }

      status.replaceChildren(badge(`Looking up @${handle}\u2026`, 'neutral'))
      try {
        const response = await fetch(profileUrl(handle), { headers: { accept: 'application/json' } })
        if (current !== seq) return
        if (response.status === 400 || response.status === 404) {
          status.replaceChildren(badge(`No Bluesky profile for @${handle}.`, 'warn'))
          reset()
          return
        }
        if (!response.ok) {
          status.replaceChildren(badge(`Bluesky returned HTTP ${response.status}.`, 'danger'))
          reset()
          return
        }
        const profile = parseProfile(await response.json())
        if (current !== seq) return
        if (!profile) {
          status.replaceChildren(badge('Bluesky returned something unexpected.', 'danger'))
          reset()
          return
        }
        status.replaceChildren(badge(`Found @${profile.handle}`, 'ok'))
        paint(profile)
      } catch {
        if (current !== seq) return
        status.replaceChildren(badge('Could not reach Bluesky. Check your connection and try again.', 'danger'))
        reset()
      }
    }

    avatar.image.addEventListener('load', () => {
      avatar.root.hidden = false
    })
    avatar.image.addEventListener('error', () => {
      avatar.root.hidden = true
    })

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Handle', icon: 'globe' },
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
          note('This tool uses the network. Only the handle you type is sent, to Bluesky\u2019s public API. Nothing else leaves this page.'),
        ),
        avatar.root,
        panel({ title: 'Profile', icon: 'text' }, bio),
        panel({ title: 'Counts', icon: 'chart' }, summary),
        panel({ title: 'Details', icon: 'info' }, facts),
      ),
    )

    void lookUp()
  },
}

export default tool
