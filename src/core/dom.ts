type Attrs = Record<string, unknown>
type Child = Node | string | null | undefined | false

/**
 * A tiny hyperscript helper so tools can build DOM without a framework.
 *
 *   el('button', { class: 'btn', onclick: run }, 'Generate')
 *
 * Keys starting with `on` are treated as event listeners. Other keys are
 * set as properties when they exist on the element (value, checked, ...)
 * and as attributes otherwise.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)

  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue

    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
    } else if (key in node) {
      ;(node as unknown as Record<string, unknown>)[key] = value
    } else {
      node.setAttribute(key, String(value))
    }
  }

  for (const child of children) {
    if (child == null || child === false) continue
    node.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }

  return node
}

/** Replace a node's children. */
export function clear(node: HTMLElement): void {
  node.replaceChildren()
}
