import { clear, el } from '../core/dom'
import { favourites, isFavourite, onFavouritesChange, toggleFavourite } from '../core/favourites'
import { icon, iconEl } from '../core/icons'
import { categoryHue, sigilTile } from '../core/identity'
import { networkEnabled, onPreferencesChange, setNetworkEnabled } from '../core/preferences'
import { findTool, searchTools, tools } from '../core/registry'
import { PRESETS, activeTheme, applyThemeToDocument, useCustom, usePreset } from '../core/theme'
import type { Tool } from '../core/types'

/**
 * The tools currently on offer. A user who has switched network tools off sees
 * a strictly offline toolspace: the network-backed tools disappear from the
 * index, the search, the counts and the palette, so there is nothing to click
 * that would leave the page.
 */
function visibleTools(): Tool[] {
  return networkEnabled() ? tools : tools.filter((tool) => !tool.remote)
}

/** Categories that still have at least one visible tool. */
function visibleCategories(): string[] {
  return [...new Set(visibleTools().map((tool) => tool.category))].sort()
}

const STAR_OFF = icon('star', 15)
const STAR_ON = STAR_OFF.replace('fill="none"', 'fill="currentColor"')

/**
 * The star toggle shown on cards, rows and tool pages. Stopping propagation
 * matters on the card, which is itself a link to the tool.
 */
function starButton(slug: string, name: string): HTMLButtonElement {
  const button = el('button', {
    type: 'button',
    class: 'ts-star',
    'aria-pressed': isFavourite(slug) ? 'true' : 'false',
  }) as HTMLButtonElement

  function paint() {
    const on = isFavourite(slug)
    button.classList.toggle('is-on', on)
    button.setAttribute('aria-pressed', on ? 'true' : 'false')
    button.innerHTML = on ? STAR_ON : STAR_OFF
    button.title = on ? `Remove ${name} from starred` : `Star ${name}`
    button.setAttribute('aria-label', button.title)
  }

  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    toggleFavourite(slug)
    paint()
  })
  paint()
  return button
}

/**
 * The tool's generated identity badge, tinted by its category. A handful of
 * tools declare an emoji; where they do it rides along beside the sigil.
 */
function tileEl(tool: Tool, size = 34): HTMLElement {
  return sigilTile(tool.slug, tool.category, size)
}

/* --------------------------------------------------------------------------
   Theme. Presets and custom themes live in core/theme.ts; this file only
   paints them and offers the picker. The picker writes a preset id or a
   custom theme, and the module owns every bit of the storage shape.
   -------------------------------------------------------------------------- */

/** Paint the stored theme. Called before first paint by main.ts. */
export function initTheme(): void {
  applyThemeToDocument(activeTheme())
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
          style: `--h:${categoryHue(tool.category)}`,
          role: 'option',
          'aria-selected': String(index === active),
          onclick: () => choose(tool),
          onmousemove: () => {
            if (active === index) return
            active = index
            paint()
          },
        },
        tileEl(tool, 26),
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
    const allowed = new Set(visibleTools().map((tool) => tool.slug))
    matches = searchTools(query, { limit: 40 }).filter((tool) => allowed.has(tool.slug))
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

/** Small "needs the network" tag, shown wherever a tool is listed. */
function remoteTag(): HTMLElement {
  return el(
    'span',
    {
      class: 'ts-tag-network',
      title: 'This tool contacts a third-party site to do its job',
    },
    iconEl('globe', 11),
    el('span', {}, 'network'),
  )
}

function toolCard(tool: Tool, feature = false): HTMLElement {
  return el(
    'a',
    {
      class: `ts-card${feature ? ' ts-card--feature' : ''}`,
      href: `#/${tool.slug}`,
      style: `--h:${categoryHue(tool.category)}`,
    },
    el(
      'span',
      { class: 'ts-card-top' },
      tileEl(tool, feature ? 44 : 34),
      el(
        'span',
        { class: 'ts-card-head' },
        el('h3', {}, tool.name),
        el(
          'span',
          { class: 'ts-card-cat' },
          tool.category,
          ...(tool.remote ? [el('span', { class: 'ts-dot-sep', 'aria-hidden': 'true' }, '·'), remoteTag()] : []),
        ),
      ),
      starButton(tool.slug, tool.name),
    ),
    el('p', {}, tool.description),
  )
}

/** A single row used by the dense index for the long tail of tools. */
function toolRow(tool: Tool): HTMLElement {
  return el(
    'a',
    {
      class: 'ts-row-item',
      href: `#/${tool.slug}`,
      style: `--h:${categoryHue(tool.category)}`,
    },
    tileEl(tool, 26),
    el(
      'span',
      { class: 'ts-row-text' },
      el('span', { class: 'ts-row-name' }, tool.name),
      el('span', { class: 'ts-row-desc' }, tool.description),
    ),
    ...(tool.remote ? [remoteTag()] : []),
    starButton(tool.slug, tool.name),
  )
}

/** The pinned "Starred" strip, shown above everything when it has entries. */
function starredSection(): HTMLElement | null {
  const slugs = favourites()
  const allowed = new Set(visibleTools().map((tool) => tool.slug))
  const starred = slugs
    .map(findTool)
    .filter((tool): tool is Tool => Boolean(tool) && allowed.has(tool!.slug))
  if (starred.length === 0) return null
  return el(
    'div',
    { class: 'ts-section ts-starred' },
    sectionHead('Starred', `${starred.length} pinned`),
    el('div', { class: 'ts-grid' }, ...starred.map((tool) => toolCard(tool))),
  )
}

/** Section heading shared by every group on the home page. */
function sectionHead(title: string, meta: string, tint?: number): HTMLElement {
  return el(
    'div',
    { class: 'ts-section-head', ...(tint == null ? {} : { style: `--h:${tint}` }) },
    el('span', { class: 'ts-section-mark', 'aria-hidden': 'true' }),
    el('h2', {}, title),
    el('span', { class: 'ts-section-meta' }, meta),
  )
}

/** Families at or above this size get the bento treatment; the rest get rows. */
const BIG_FAMILY = 8

function home(): HTMLElement {
  const results = el('section', { class: 'ts-section' })

  const search = el('input', {
    class: 'ts-input ts-masthead-input',
    type: 'search',
    placeholder: `Search ${visibleTools().length} tools… try “jwt”, “colour” or “base 64”`,
    'aria-label': 'Search tools',
    autocomplete: 'off',
  }) as HTMLInputElement

  const catBar = el('div', { class: 'ts-cat-bar', role: 'group', 'aria-label': 'Filter by category' })
  let category = ''

  /** The no-query view: big families as a bento, the long tail as dense rows. */
  function familySections(): HTMLElement[] {
    return visibleCategories().map((name) => {
      const group = visibleTools().filter((tool) => tool.category === name)
      const big = group.length >= BIG_FAMILY
      return el(
        'div',
        { class: `ts-section ts-family ts-reveal${big ? ' is-feature' : ' is-dense'}` },
        sectionHead(name, `${group.length}`, categoryHue(name)),
        big
          ? el('div', { class: 'ts-bento' }, ...group.map((tool, i) => toolCard(tool, i === 0)))
          : el('div', { class: 'ts-row-grid' }, ...group.map(toolRow)),
      )
    })
  }

  function renderGrid() {
    clear(results)
    const allowed = new Set(visibleTools().map((tool) => tool.slug))
    const items = searchTools(search.value, category ? { category } : {}).filter((tool) => allowed.has(tool.slug))
    if (items.length === 0) {
      results.append(el('p', { class: 'ts-empty' }, 'No tools match that search.'))
      return
    }
    if (search.value.trim() || category) {
      const hue = category ? categoryHue(category) : undefined
      results.append(
        sectionHead(category || 'Results', `${items.length} ${items.length === 1 ? 'tool' : 'tools'}`, hue),
      )
      results.append(el('div', { class: 'ts-grid' }, ...items.map((tool) => toolCard(tool))))
      return
    }
    results.append(...familySections())
  }

  function renderChips() {
    clear(catBar)
    catBar.append(
      el(
        'button',
        {
          type: 'button',
          class: `ts-cat-chip ts-cat-chip-all${category === '' ? ' is-active' : ''}`,
          onclick: () => {
            category = ''
            renderChips()
            renderGrid()
          },
        },
        'All',
        el('small', {}, String(visibleTools().length)),
      ),
    )
    for (const name of visibleCategories()) {
      const count = visibleTools().filter((tool) => tool.category === name).length
      catBar.append(
        el(
          'button',
          {
            type: 'button',
            class: `ts-cat-chip${category === name ? ' is-active' : ''}`,
            style: `--h:${categoryHue(name)}`,
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

  const shown = visibleTools()
  const catCount = visibleCategories().length
  const remoteTools = shown.filter((t) => t.remote).length
  const offlineTools = shown.length - remoteTools

  // The pinned strip lives above the search, so it is re-rendered on every
  // change rather than being rebuilt with the rest of the page.
  const pinned = el('div', { class: 'ts-pinned' })
  function renderStarred() {
    const next = starredSection()
    clear(pinned)
    if (next) pinned.append(next)
  }
  renderStarred()
  onFavouritesChange(renderStarred)

  // The headline is split into masked lines so it can rise into view without
  // the layout shifting. The CSS keeps the final state as the default, so the
  // text is fully visible with scripting or motion turned off.
  const headline = el(
    'h1',
    { class: 'ts-headline' },
    el(
      'span',
      { class: 'ts-headline__line' },
      el('span', { class: 'ts-headline__inner' }, el('em', { class: 'ts-accent' }, `${shown.length} small tools`), ', one'),
    ),
    el(
      'span',
      { class: 'ts-headline__line' },
      el('span', { class: 'ts-headline__inner' }, 'fast tab.'),
    ),
  )

  const lede = el(
    'p',
    { class: 'ts-lede' },
    networkEnabled()
      ? `No account, no tracking, nothing to sign up for. ${offlineTools} of ${shown.length} open instantly and never touch the network; the ${remoteTools} that do are marked with the host they talk to.`
      : `No account, no tracking, nothing to sign up for. All ${shown.length} tools run without touching the network.`,
  )

  return el(
    'section',
    { class: 'ts-home' },
    el(
      'div',
      { class: 'ts-masthead' },
      el('p', { class: 'ts-eyebrow' }, 'Fast tools, nothing to install'),
      headline,
      lede,
      el('div', { class: 'ts-masthead-search' }, search),
      el(
        'div',
        { class: 'ts-masthead-stats' },
        el('div', { class: 'ts-mstat' }, el('span', { class: 'ts-mstat-value' }, String(shown.length)), el('span', { class: 'ts-mstat-label' }, 'tools')),
        el('div', { class: 'ts-mstat' }, el('span', { class: 'ts-mstat-value' }, String(catCount)), el('span', { class: 'ts-mstat-label' }, 'categories')),
        el(
          'div',
          { class: 'ts-mstat' },
          el('span', { class: 'ts-mstat-value' }, remoteTools === 0 ? '0' : String(remoteTools)),
          el('span', { class: 'ts-mstat-label' }, 'use the network'),
        ),
      ),
      networkToggle(),
    ),
    pinned,
    el('div', { class: 'ts-browse' }, el('span', { class: 'ts-browse-label' }, 'Browse'), catBar),
    results,
  )
}

/**
 * The network-tools switch. Off means the site behaves as if every network
 * tool did not exist, so a user who wants a strictly offline toolspace can
 * have one without relying on the CSP or their connection.
 */
function networkToggle(): HTMLElement {
  const box = el('input', { type: 'checkbox', class: 'ts-switch-input' }) as HTMLInputElement
  box.checked = networkEnabled()
  box.setAttribute('aria-label', 'Allow tools that use the network')
  const root = el(
    'label',
    { class: 'ts-switch' },
    box,
    el('span', { class: 'ts-switch-track', 'aria-hidden': 'true' }, el('span', { class: 'ts-switch-thumb' })),
    el(
      'span',
      { class: 'ts-switch-text' },
      el('strong', {}, 'Network tools'),
      el('span', { class: 'ts-switch-hint' }, networkEnabled() ? 'available, and marked' : 'hidden'),
    ),
  )
  box.addEventListener('change', () => {
    setNetworkEnabled(box.checked)
  })
  return root
}

function notFound(slug: string, palette: Palette): HTMLElement {
  return el(
    'section',
    { class: 'ts-home' },
    el('h1', {}, 'Not found'),
    el('p', { class: 'ts-lede' }, `No tool called “${slug}”.`),
    el(
      'button',
      { type: 'button', class: 'ts-k-btn ts-k-btn--primary', onclick: () => palette.open() },
      iconEl('search', 16),
      el('span', {}, 'Search tools'),
    ),
  )
}

/** A previous/next card in the tool footer. */
function navCard(direction: 'prev' | 'next', tool: Tool): HTMLElement {
  return el(
    'a',
    { class: `ts-tool-nav__link is-${direction}`, href: `#/${tool.slug}` },
    el('small', {}, direction === 'prev' ? 'Previous' : 'Next'),
    el('span', { class: 'ts-tool-nav__name' }, tool.name),
  )
}

/** One terse marker for a tool that leaves the tab. Local tools get none. */
function toolNetworkBadge(tool: Tool): HTMLElement | null {
  if (!tool.remote) return null
  return el(
    'p',
    { class: 'ts-tool-remote' },
    el(
      'span',
      { class: 'ts-tool-remote__head' },
      iconEl('globe', 13),
      el('span', { class: 'ts-tool-remote__host' }, tool.remote.host),
    ),
    el('span', { class: 'ts-tool-remote__note' }, tool.remote.note),
  )
}

function toolPage(tool: Tool, palette: Palette): HTMLElement {
  const ordered = visibleTools()
  const index = ordered.findIndex((entry) => entry.slug === tool.slug)
  const previous = index > 0 ? ordered[index - 1] : undefined
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined

  const body = el('div', { class: 'ts-tool-body' })
  const nav = el(
    'nav',
    { class: 'ts-tool-nav', 'aria-label': 'Tool navigation' },
    previous ? navCard('prev', previous) : el('span', {}),
    next ? navCard('next', next) : el('span', {}),
    el(
      'a',
      { class: 'ts-tool-nav__back', href: '#/' },
      iconEl('layers', 14),
      el('span', {}, 'All tools'),
    ),
  )

  // The hue travels down from the header so a tool's panels, focus rings and
  // accents all read as the same family as its catalogue card.
  const hue = categoryHue(tool.category)

  const findButton = el(
    'button',
    {
      type: 'button',
      class: 'ts-k-btn ts-k-btn--sm',
      onclick: () => palette.open(),
      title: 'Search every tool (Ctrl K)',
    },
    iconEl('search', 14),
    el('span', {}, 'Find a tool'),
  )

  const badge = toolNetworkBadge(tool)

  const section = el(
    'section',
    { class: 'ts-toolpage', style: `--h:${hue}` },
    el(
      'header',
      { class: 'ts-tool-header' },
      el(
        'div',
        { class: 'ts-breadcrumb' },
        el('a', { href: '#/' }, 'All tools'),
        el('span', { class: 'ts-breadcrumb__sep', 'aria-hidden': 'true' }, '/'),
        el('span', {}, tool.category),
      ),
      el(
        'div',
        { class: 'ts-tool-header__main' },
        el('div', { class: 'ts-tool-header__title' }, tileEl(tool, 44), el('h1', {}, tool.name)),
        el('p', { class: 'ts-tool-desc' }, tool.description),
      ),
      el('div', { class: 'ts-tool-actions' }, findButton, starButton(tool.slug, tool.name)),
      badge,
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


/**
 * The theme picker: eight presets, a colour to build your own, and a save box
 * for named themes. Everything it writes is one accent (and optionally a
 * background), which is the whole theming surface — see core/theme.ts.
 */
function currentBg(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#0b0d11'
}

function themePicker(): HTMLElement {
  const wrap = el('div', { class: 'ts-theme-wrap' })

  const panel = el('div', {
    class: 'ts-theme-panel',
    role: 'dialog',
    'aria-label': 'Appearance',
    hidden: true,
  })

  const trigger = el(
    'button',
    {
      type: 'button',
      class: 'ts-icon-btn',
      'aria-label': 'Appearance',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
      title: 'Colour theme',
    },
    iconEl('palette', 17),
  )

  function close() {
    panel.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
  }

  function open() {
    panel.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
  }

  document.addEventListener('click', (event) => {
    if (!panel.hidden && !wrap.contains(event.target as Node)) close()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      close()
      trigger.focus()
    }
  })

  trigger.addEventListener('click', () => (panel.hidden ? open() : close()))

  function paint() {
    const active = activeTheme()
    clear(panel)

    const presetGrid = el('div', { class: 'ts-theme-presets', role: 'list' })
    for (const preset of PRESETS) {
      const isActive = active.presetId === preset.id
      presetGrid.append(
        el(
          'button',
          {
            type: 'button',
            class: `ts-theme-preset${isActive ? ' is-active' : ''}`,
            role: 'listitem',
            'aria-pressed': String(isActive),
            title: preset.name,
            onclick: () => {
              usePreset(preset.id)
              applyThemeToDocument(activeTheme())
              paint()
            },
          },
          el('span', { class: 'ts-theme-swatch', style: `--sw:${preset.accent}` }),
          el('span', { class: 'ts-theme-preset__name' }, preset.name),
        ),
      )
    }

    panel.append(
      el('p', { class: 'ts-theme-head' }, 'Appearance'),
      el('p', { class: 'ts-theme-label' }, 'Preset'),
      presetGrid,
      el('p', { class: 'ts-theme-label' }, 'Your own'),
    )

    // A small custom builder: an accent, an optional background, and a name.
    const custom = active.custom
    const accent = el('input', {
      type: 'color',
      class: 'ts-theme-color',
      'aria-label': 'Accent colour',
      value: custom?.accent ?? active.accent,
    }) as HTMLInputElement
    const bgOn = el('input', {
      type: 'checkbox',
      class: 'ts-theme-toggle',
      checked: Boolean(custom?.bg),
      'aria-label': 'Set a background colour',
    }) as HTMLInputElement
    const bg = el('input', {
      type: 'color',
      class: 'ts-theme-color',
      'aria-label': 'Background colour',
      value: custom?.bg ?? currentBg(),
    }) as HTMLInputElement
    const name = el('input', {
      type: 'text',
      class: 'ts-theme-name',
      placeholder: 'Untitled theme',
      maxlength: '24',
      'aria-label': 'Theme name',
      value: custom?.name ?? '',
    }) as HTMLInputElement
    const darkOn = el('input', {
      type: 'checkbox',
      class: 'ts-theme-toggle',
      checked: custom?.dark ?? active.dark,
      'aria-label': 'Dark ramp',
    }) as HTMLInputElement

    function preview() {
      applyThemeToDocument({
        presetId: null,
        custom: null,
        dark: darkOn.checked,
        accent: accent.value,
        bg: bgOn.checked ? bg.value : null,
        name: name.value || 'Custom',
      })
    }
    accent.addEventListener('input', preview)
    bg.addEventListener('input', preview)
    bgOn.addEventListener('change', () => {
      bg.disabled = !bgOn.checked
      preview()
    })
    darkOn.addEventListener('change', preview)
    bg.disabled = !bgOn.checked

    panel.append(
      el(
        'div',
        { class: 'ts-theme-builder' },
        el('span', { class: 'ts-theme-label' }, 'Accent'),
        accent,
        el('label', { class: 'ts-theme-check' }, darkOn, el('span', {}, 'Dark background')),
        el('label', { class: 'ts-theme-check' }, bgOn, el('span', {}, 'Custom background')),
        bg,
      ),
      el(
        'div',
        { class: 'ts-theme-save' },
        name,
        el(
          'button',
          {
            type: 'button',
            class: 'ts-k-btn ts-k-btn--sm',
            onclick: () => {
              useCustom({
                name: name.value.trim() || 'Custom',
                dark: darkOn.checked,
                accent: accent.value,
                bg: bgOn.checked ? bg.value : null,
              })
              applyThemeToDocument(activeTheme())
              paint()
            },
          },
          'Save theme',
        ),
      ),
      custom
        ? el(
            'p',
            { class: 'ts-theme-active' },
            `“${custom.name}” saved on this device. `,
            el(
              'button',
              {
                type: 'button',
                class: 'ts-theme-reset',
                onclick: () => {
                  usePreset(PRESETS[0].id)
                  applyThemeToDocument(activeTheme())
                  paint()
                },
              },
              'Reset to Voltage',
            ),
          )
        : el('p', { class: 'ts-theme-active' }, 'Saved on this device only.'),
    )
  }

  paint()
  wrap.append(trigger, panel)
  return wrap
}

const BRAND_MARK =
  '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"><path d="M12 2.6 20.4 7.4v9.2L12 21.4 3.6 16.6V7.4z"/><circle cx="12" cy="12" r="3.1" fill="currentColor" stroke="none"/></svg>'

/**
 * A one-line banner for the offline state. Nothing else in the app changes
 * when the network drops — that is the point of an offline-first toolspace —
 * so a quiet strip is all the signal that is needed.
 */
function offlineBanner(): HTMLElement {
  const node = el(
    'div',
    { class: 'ts-offline', role: 'status', hidden: navigator.onLine },
    iconEl('info', 14),
    el('span', {}, 'Offline — every tool still works, nothing here needs a server.'),
  )
  const sync = () => {
    node.hidden = navigator.onLine
  }
  window.addEventListener('online', sync)
  window.addEventListener('offline', sync)
  return node
}

/**
 * Reveal sections as they scroll in. The arming class is added from script
 * *after* the observer is attached, so CSS keeps the visible resting state:
 * without scripting or IntersectionObserver nothing is ever hidden. Under
 * prefers-reduced-motion the reveal is skipped entirely.
 */
function revealOnScroll(root: HTMLElement): void {
  if (typeof IntersectionObserver === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const targets = [...root.querySelectorAll<HTMLElement>('.ts-reveal')]
  if (targets.length === 0) return
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        observer.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  )
  for (const target of targets) {
    // Anything already on screen shows immediately instead of being armed.
    if (target.getBoundingClientRect().top < window.innerHeight) continue
    target.classList.add('is-armed')
    observer.observe(target)
  }
}

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
    iconEl('search', 15),
    el('span', { class: 'ts-search-trigger-label' }, 'Search tools…'),
    el('kbd', {}, 'Ctrl K'),
  )

  const themeBtn = themePicker()

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
    iconEl('arrowUp', 16),
  )

  function updateToTop() {
    toTop.classList.toggle('is-visible', window.scrollY > 500)
  }

  function show(slug: string) {
    clear(main)
    window.scrollTo({ top: 0 })
    if (!slug) {
      main.append(home())
    } else {
      const tool = findTool(slug)
      // A network tool that is switched off is treated as if it does not
      // exist, so a stale link cannot quietly make a cross-origin request.
      const hidden = tool != null && Boolean(tool.remote) && !networkEnabled()
      main.append(tool && !hidden ? toolPage(tool, palette) : notFound(slug, palette))
    }
    revealOnScroll(main)
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
  // Switching network tools off or on rebuilds the current view, so a hidden
  // tool cannot linger on the page and the counts stay truthful.
  onPreferencesChange(fromHash)

  app.append(offlineBanner(), header, main, toTop)
  fromHash()
}
