/**
 * Per-tool stylesheets.
 *
 * A tool may ship its own `tool.css` next to its `index.ts`. Every such file
 * is discovered automatically and injected once at startup, so a contributor
 * never has to touch a shared stylesheet — which keeps the "no central list"
 * promise of the tool registry for styling too.
 *
 * Tool classes should be prefixed (the existing tools use `ts-`) to avoid
 * collisions with the shared component styles.
 */
const sheets = import.meta.glob<string>('../tools/*/tool.css', {
  eager: true,
  query: '?inline',
  import: 'default',
})

/** Load every discovered tool stylesheet into the document. */
export function loadToolStyles(): void {
  for (const css of Object.values(sheets)) {
    if (typeof css !== 'string' || !css.trim()) continue
    const style = document.createElement('style')
    style.dataset.toolStyle = ''
    style.textContent = css
    document.head.append(style)
  }
}
