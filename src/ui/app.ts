import { clear, el } from '../core/dom'
import { categories, findTool, searchTools, tools } from '../core/registry'
import type { Tool } from '../core/types'

function sidebar(onSelect: (slug: string) => void): HTMLElement {
  const list = el('nav', { class: 'ts-nav', 'aria-label': 'Tools' })
  const query = el('input', {
    class: 'ts-search',
    type: 'search',
    placeholder: 'Search tools…',
    'aria-label': 'Search tools',
    oninput: (e: Event) => render( searchTools((e.target as HTMLInputElement).value) ),
  }) as HTMLInputElement

  function render(items: Tool[]) {
    clear(list)
    const grouped = new Map<string, Tool[]>()
    for (const tool of items) {
      const group = grouped.get(tool.category) ?? []
      group.push(tool)
      grouped.set(tool.category, group)
    }
    if (items.length === 0) {
      list.append(el('p', { class: 'ts-empty' }, 'No tools match that search.'))
      return
    }
    for (const category of categories()) {
      const group = grouped.get(category)
      if (!group?.length) continue
      list.append(el('h3', { class: 'ts-nav-heading' }, category))
      for (const tool of group) {
        const link = el('a', {
          class: 'ts-nav-link',
          href: `#/${tool.slug}`,
          onclick: (e: Event) => {
            e.preventDefault()
            onSelect(tool.slug)
          },
        }, tool.name)
        list.append(link)
      }
    }
  }

  render(tools)

  return el(
    'aside',
    { class: 'ts-sidebar' },
    el('a', { class: 'ts-brand', href: '#/' }, el('span', { class: 'ts-brand-mark' }, '⬡'), ' toolspace'),
    query,
    list,
    el('p', { class: 'ts-sidebar-foot' }, `${tools.length} tools · no account · offline-ready`),
  )
}

function home(): HTMLElement {
  return el(
    'section',
    { class: 'ts-home' },
    el('h1', {}, 'A junk drawer of tools that never upload your stuff.'),
    el(
      'p',
      { class: 'ts-lede' },
      'Pick a tool from the left. Everything runs in your browser — no ads, no sign-up, no server. ',
      'Your data never leaves this tab.',
    ),
    el(
      'div',
      { class: 'ts-grid ts-grid-wide' },
      ...tools.map((tool) =>
        el(
          'a',
          { class: 'ts-card', href: `#/${tool.slug}` },
          el('h3', {}, tool.name),
          el('p', {}, tool.description),
        ),
      ),
    ),
  )
}

function notFound(slug: string): HTMLElement {
  return el('section', { class: 'ts-home' }, el('h1', {}, 'Not found'), el('p', {}, `No tool called “${slug}”.`))
}

export function mountApp(app: HTMLElement): void {
  const main = el('main', { class: 'ts-main' })

  function show(slug: string) {
    clear(main)
    for (const link of document.querySelectorAll('.ts-nav-link')) {
      link.classList.toggle('is-active', link.getAttribute('href') === `#/${slug}`)
    }
    if (!slug) {
      main.append(home())
    } else {
      const tool = findTool(slug)
      if (!tool) {
        main.append(notFound(slug))
        return
      }
      main.append(
        el(
          'header',
          { class: 'ts-tool-header' },
          el('h1', {}, tool.name),
          el('p', { class: 'ts-tool-desc' }, tool.description),
        ),
      )
      const body = el('div', { class: 'ts-tool-body' })
      main.append(body)
      try {
        tool.render(body)
      } catch (error) {
        body.append(el('p', { class: 'ts-error' }, `This tool failed to load: ${String(error)}`))
      }
    }
  }

  function fromHash() {
    show(decodeURIComponent(location.hash.replace(/^#\/?/, '')))
  }

  app.append(sidebar((slug) => (location.hash = `#/${slug}`)), main)
  window.addEventListener('hashchange', fromHash)
  fromHash()
}
