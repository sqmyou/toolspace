import { el } from '../core/dom'
import { iconEl } from '../core/icons'
import { tools } from '../core/registry'

/**
 * The privacy page.
 *
 * The promise — nothing you paste is uploaded — is the product, so it gets a
 * page of its own rather than a sentence in the README. The network table is
 * generated from the tools' own `remote` metadata, so it cannot drift out of
 * date the way a hand-written list would.
 */
export function privacyPage(): HTMLElement {
  const remote = tools
    .filter((tool) => tool.remote)
    .sort((a, b) => a.remote!.host.localeCompare(b.remote!.host))

  const hosts = [...new Set(remote.map((tool) => tool.remote!.host))].sort()

  return el(
    'section',
    { class: 'ts-prose' },
    el(
      'header',
      { class: 'ts-prose__head' },
      el('p', { class: 'ts-eyebrow' }, 'Privacy'),
      el('h1', {}, 'Nothing you paste is ever uploaded.'),
      el(
        'p',
        { class: 'ts-lede' },
        'toolspace is a static page. There is no backend, no database, no analytics, no cookies and no account. Your input is processed in this tab and thrown away when you close it.',
      ),
    ),

    el(
      'div',
      { class: 'ts-prose__card' },
      iconEl('layers', 20),
      el(
        'p',
        {},
        'The entire app is a few files served from one origin. It makes no request you did not ask for, and it cannot phone home — there is no home to phone.',
      ),
    ),

    el(
      'h2',
      {},
      `The ${hosts.length} hosts the site is allowed to reach`,
    ),
    el(
      'p',
      {},
      `${remote.length} of the ${tools.length} tools can contact a third-party service, and only when you press the button. Each is listed below with what leaves the tab. You can switch every one of them off in `,
      el('a', { href: '#/settings' }, 'Settings'),
      '.',
    ),
    el(
      'div',
      { class: 'ts-prose__table' },
      el(
        'div',
        { class: 'ts-prose__row ts-prose__row--head' },
        el('span', {}, 'Host'),
        el('span', {}, 'Tool'),
        el('span', {}, 'What leaves the tab'),
      ),
      ...remote.map((tool) =>
        el(
          'div',
          { class: 'ts-prose__row' },
          el('code', { class: 'ts-k-mono' }, tool.remote!.host),
          el('a', { href: `#/${tool.slug}` }, tool.name),
          el('span', {}, tool.remote!.note),
        ),
      ),
    ),

    el('h2', {}, 'What is stored on your device'),
    el(
      'ul',
      { class: 'ts-prose__list' },
      el('li', {}, 'Your theme, and any custom colours you build.'),
      el('li', {}, 'Your starred tools and a short list of recently opened ones.'),
      el('li', {}, 'Your settings — density, sigils, motion, and the network switch.'),
    ),
    el(
      'p',
      {},
      'All of it lives in localStorage for this origin. It never leaves your browser, and clearing site data removes it permanently. ',
      el('a', { href: '#/settings' }, 'Clear it from Settings'),
      '.',
    ),

    el('h2', {}, 'How this stays true'),
    el(
      'p',
      {},
      'The browser enforces it. A strict Content-Security-Policy allows scripts, styles and fonts only from this origin, and the host list above is the complete allowlist for images and connections. A tool cannot quietly add a new destination without that list changing in the open.',
    ),

    el(
      'p',
      { class: 'ts-prose__foot' },
      el('a', { href: '#/' }, 'Back to the tools'),
    ),
  )
}
