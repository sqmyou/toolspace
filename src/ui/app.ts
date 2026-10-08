import { clear, el } from '../core/dom'
import { categories, findTool, searchTools, tools } from '../core/registry'
import type { Tool } from '../core/types'

/** Optional glyph for a tool, shown only when the tool declares one. */
function iconEl(tool: Tool, className: string): HTMLElement | null {
  return tool.icon ? el('span', { class: className, 'aria-hidden': 'true' }, tool.icon) : null
}

/* --------------------------------------------------------------------------
   Theme. A stored choice wins; otherwise the OS preference decides. The
   toggle only ever writes an explicit `data-theme`, so "system" is simply
   the absence of a stored value.
   -------------------------------------------------------------------------- */
type Theme = 'dark' | 'light'
const THEME_KEY = 'toolspace:theme'

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}

function effectiveTheme(): Theme {
  return (
    storedTheme() ??
    (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  )
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#f4f1ea' : '#0b0e12')
}

/** Set the theme before first paint so there is no flash of the wrong one. */
export function initTheme(): void {
  applyTheme(effectiveTheme())
}

interface Palette {
  open(): void
}

/**
 * Command palette: fuzzy search over every tool, driven entirely from the
 * keyboard. This replaces the old sidebar — it works the same on a phone and
 * on a desktop, and it never needs a horizontal scroll to find a tool.
 */
function commandPalette(onSelect: (slug: string) => void): Palette {
  const input = el('input', {
    class: 'ts-palette-input',
    type: 'text',
    placeholder: 'Search tools… try “json”, “colour”, “time”',
    'aria-label': 'Search tools',
    autocomplete: 'off',
  }) as HTMLInputElement

  const results = el('div', { class: 'ts-palette-results', role: 'listbox' })
  const dialog = el(
    'div',
    {
      class: 'ts-palette',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Search tools',
    },
    input,
    results,
    el('div', { class: 'ts-palette-foot' }, '↑↓ to move · Enter to open · Esc to close'),
  )
  const backdrop = el(
    'div',
    {
      class: 'ts-palette-backdrop',
      onclick: (e: Event) => {
        if (e.target === backdrop) close()
      },
    },
    dialog,
  )

  let matches: Tool[] = []
  let active = 0

  function paint() {
    clear(results)
    if (matches.length === 0) {
      results.append(el('p', { class: 'ts-empty', style: 'padding:12px' }, 'No tools match that search.'))
      return
    }
    matches.forEach((tool, index) => {
      const button = el(
        'button',
        {
          type: 'button',
          class: `ts-palette-item${index === active ? ' is-active' : ''}`,
          role: 'option',
          'aria-selected': String(index === active),
          onclick: () => choose(tool),
          onmousemove: () => {
            if (active === index) return
            active = index
            paint()
          },
        },
        iconEl(tool, 'ts-palette-icon'),
        el(
          'span',
          { class: 'ts-palette-text' },
          el('span', { class: 'ts-palette-name' }, tool.name),
          el('span', { class: 'ts-palette-desc' }, tool.description),
        ),
        el('span', { class: 'ts-palette-cat' }, tool.category),
      )
      results.append(button)
    })
  }

  function update(query: string) {
    matches = searchTools(query, { limit: 40 })
    active = 0
    paint()
  }

  function choose(tool: Tool) {
    onSelect(tool.slug)
    close()
  }

  function close() {
    if (!backdrop.isConnected) return
    backdrop.remove()
    document.removeEventListener('keydown', onKeydown, true)
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (matches.length) active = (active + 1) % matches.length
      paint()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (matches.length) active = (active - 1 + matches.length) % matches.length
      paint()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const tool = matches[active]
      if (tool) choose(tool)
    }
  }

  input.addEventListener('input', () => update(input.value))

  return {
    open() {
      if (backdrop.isConnected) return
      input.value = ''
      update('')
      document.body.append(backdrop)
      document.addEventListener('keydown', onKeydown, true)
      input.focus()
    },
  }
}

function toolCard(tool: Tool): HTMLElement {
  return el(
    'a',
    { class: 'ts-card', href: `#/${tool.slug}` },
    el('span', { class: 'ts-card-top' }, iconEl(tool, 'ts-card-icon'), el('h3', {}, tool.name)),
    el('p', {}, tool.description),
  )
}

function home(): HTMLElement {
  const section = el('section', { class: 'ts-section' })

  const search = el('input', {
    class: 'ts-input',
    type: 'search',
    placeholder: 'Search tools… try “jasn” or “base 64”',
    'aria-label': 'Search tools',
    autocomplete: 'off',
  }) as HTMLInputElement

  const catBar = el('div', { class: 'ts-cat-bar', role: 'group', 'aria-label': 'Filter by category' })
  let category = ''

  function renderGrid() {
    clear(section)
    const items = searchTools(search.value, category ? { category } : {})
    if (items.length === 0) {
      section.append(el('p', { class: 'ts-empty' }, 'No tools match that search.'))
      return
    }
    if (search.value.trim() || category) {
      section.append(
        el(
          'div',
          { class: 'ts-section-head' },
          el('h2', {}, category || 'Results'),
          el('span', {}, `${items.length} ${items.length === 1 ? 'tool' : 'tools'}`),
        ),
      )
      const list = el('div', { class: 'ts-grid' })
      list.append(...items.map(toolCard))
      section.append(list)
      return
    }
    // No query: group by category so the page reads like a small index.
    for (const name of categories()) {
      const group = items.filter((tool) => tool.category === name)
      section.append(
        el(
          'div',
          { class: 'ts-section' },
          el(
            'div',
            { class: 'ts-section-head' },
            el('h2', {}, name),
            el('span', {}, `${group.length}`),
          ),
          el('div', { class: 'ts-grid' }, ...group.map(toolCard)),
        ),
      )
    }
  }

  function renderChips() {
    clear(catBar)
    const all = el(
      'button',
      {
        type: 'button',
        class: `ts-cat-chip${category === '' ? ' is-active' : ''}`,
        onclick: () => {
          category = ''
          renderChips()
          renderGrid()
        },
      },
      'All',
      el('small', {}, String(tools.length)),
    )
    catBar.append(all)
    for (const name of categories()) {
      const count = tools.filter((tool) => tool.category === name).length
      catBar.append(
        el(
          'button',
          {
            type: 'button',
            class: `ts-cat-chip${category === name ? ' is-active' : ''}`,
            onclick: () => {
              category = category === name ? '' : name
              renderChips()
              renderGrid()
            },
          },
          name,
          el('small', {}, String(count)),
        ),
      )
    }
  }

  search.addEventListener('input', renderGrid)
  renderChips()
  renderGrid()

  return el(
    'section',
    { class: 'ts-home' },
    el(
      'div',
      { class: 'ts-home-hero' },
      el(
        'h1',
        {},
        'The ',
        el('span', { class: 'ts-accent' }, 'junk drawer'),
        ' of developer tools.',
      ),
      el(
        'p',
        { class: 'ts-lede' },
        'Everything runs in your browser — no ads, no sign-up, no server. Your data never leaves this tab.',
      ),
      el(
        'ul',
        { class: 'ts-promise' },
        el('li', {}, `${tools.length} tools`),
        el('li', {}, 'Works offline'),
        el('li', {}, 'Nothing uploaded'),
      ),
    ),
    el('div', { style: 'max-width:560px;margin:0 auto 18px' }, search),
    catBar,
    section,
  )
}

function notFound(slug: string, palette: Palette): HTMLElement {
  return el(
    'section',
    { class: 'ts-home' },
    el('h1', {}, 'Not found'),
    el('p', { class: 'ts-lede' }, `No tool called “${slug}”.`),
    el('button', { type: 'button', class: 'ts-button ts-primary', onclick: () => palette.open() }, 'Search tools'),
  )
}

function toolPage(tool: Tool, palette: Palette): HTMLElement {
  const index = tools.findIndex((entry) => entry.slug === tool.slug)
  const previous = index > 0 ? tools[index - 1] : undefined
  const next = index >= 0 && index < tools.length - 1 ? tools[index + 1] : undefined

  const body = el('div', { class: 'ts-tool-body' })
  const nav = el(
    'nav',
    { class: 'ts-tool-nav', 'aria-label': 'Tool navigation' },
    previous
      ? el('a', { href: `#/${previous.slug}` }, el('small', {}, '← Previous'), el('span', {}, previous.name))
      : el('span', {}),
    next
      ? el('a', { class: 'ts-next', href: `#/${next.slug}` }, el('small', {}, 'Next →'), el('span', {}, next.name))
      : el('span', {}),
  )

  const section = el(
    'section',
    {},
    el(
      'header',
      { class: 'ts-tool-header' },
      el(
        'div',
        { class: 'ts-breadcrumb' },
        el('a', { href: '#/' }, 'All tools'),
        el('span', { 'aria-hidden': 'true' }, '/'),
        el('span', {}, tool.category),
      ),
      el('h1', {}, iconEl(tool, 'ts-title-icon'), tool.name),
      el('p', { class: 'ts-tool-desc' }, tool.description),
      el(
        'div',
        { class: 'ts-tool-actions' },
        el('button', { type: 'button', class: 'ts-button', onclick: () => palette.open() }, 'Find another tool'),
      ),
    ),
    body,
    nav,
  )

  try {
    tool.render(body)
  } catch (error) {
    body.append(el('p', { class: 'ts-error' }, `This tool failed to load: ${String(error)}`))
  }

  return section
}

const SUN =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/></svg>'
const MOON =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>'

const BRAND_MARK =
  '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"><path d="M12 2.6 20.4 7.4v9.2L12 21.4 3.6 16.6V7.4z"/><circle cx="12" cy="12" r="3.1" fill="currentColor" stroke="none"/></svg>'

export function mountApp(app: HTMLElement): void {
  const main = el('main', { class: 'ts-main', id: 'main' })
  const palette = commandPalette((slug) => {
    location.hash = `#/${slug}`
  })

  const searchTrigger = el(
    'button',
    {
      type: 'button',
      class: 'ts-search-trigger',
      'aria-haspopup': 'dialog',
      onclick: () => palette.open(),
    },
    el('span', { 'aria-hidden': 'true' }, '⌕'),
    el('span', { class: 'ts-search-trigger-label' }, 'Search tools…'),
    el('kbd', {}, 'Ctrl K'),
  )

  const themeBtn = el('button', {
    type: 'button',
    class: 'ts-icon-btn',
    'aria-label': 'Toggle colour theme',
    title: 'Toggle colour theme',
  }) as HTMLButtonElement

  function paintThemeButton() {
    const dark = effectiveTheme() === 'dark'
    themeBtn.innerHTML = dark ? SUN : MOON
    themeBtn.title = dark ? 'Switch to light theme' : 'Switch to dark theme'
  }

  themeBtn.addEventListener('click', () => {
    const next: Theme = effectiveTheme() === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* private mode: the theme still applies for this session */
    }
    applyTheme(next)
    paintThemeButton()
  })
  paintThemeButton()

  const brandMark = el('span', { class: 'ts-brand-mark', 'aria-hidden': 'true' })
  brandMark.innerHTML = BRAND_MARK

  const header = el(
    'header',
    { class: 'ts-header' },
    el(
      'a',
      { class: 'ts-brand', href: '#/' },
      brandMark,
      el('span', { class: 'ts-brand-word' }, 'toolspace', el('span', { class: 'ts-brand-tld' }, '.dev')),
    ),
    el('span', { class: 'ts-header-spacer' }),
    searchTrigger,
    themeBtn,
  )

  const toTop = el(
    'button',
    {
      type: 'button',
      class: 'ts-icon-btn ts-to-top',
      'aria-label': 'Back to top',
      onclick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    '↑',
  )

  function updateToTop() {
    toTop.classList.toggle('is-visible', window.scrollY > 500)
  }

  function show(slug: string) {
    clear(main)
    window.scrollTo({ top: 0 })
    if (!slug) {
      main.append(home())
      return
    }
    const tool = findTool(slug)
    main.append(tool ? toolPage(tool, palette) : notFound(slug, palette))
  }

  function fromHash() {
    show(decodeURIComponent(location.hash.replace(/^#\/?/, '')))
  }

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      palette.open()
    }
  })
  window.addEventListener('scroll', updateToTop, { passive: true })
  window.addEventListener('hashchange', fromHash)

  app.append(header, main, toTop)
  fromHash()
}
