/**
 * Per-tool stylesheets.
 *
 * A tool may ship its own `tool.css` next to its `index.ts`. Every such file is
 * discovered automatically, so a contributor never has to touch a shared
 * stylesheet — which keeps the "no central list" promise of the tool registry
 * for styling too. Tool classes should be prefixed (`ts-` by convention) to
 * avoid collisions with the shared component styles.
 *
 * The files are concatenated at build time into one string and loaded into a
 * *constructed* stylesheet. A `<style>` element would not work: the production
 * CSP is `style-src 'self'`, which blocks inline styles, so a runtime style
 * element is silently dropped and every tool's custom CSS stops applying.
 * Constructable stylesheets are not covered by `style-src`, and the CSS still
 * lives in the bundle rather than an extra request.
 */
const sheets = import.meta.glob<string>('../tools/*/tool.css', {
  eager: true,
  query: '?inline',
  import: 'default',
})

/** Load every discovered tool stylesheet into the document once. */
export function loadToolStyles(): void {
  const css = Object.keys(sheets)
    .sort()
    .map((path) => sheets[path])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
  if (!css) return

  if (typeof CSSStyleSheet !== 'undefined' && 'adoptedStyleSheets' in document) {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
    return
  }

  // Older engines also predate `style-src`, so a style element is safe there.
  const style = document.createElement('style')
  style.dataset.toolStyle = ''
  style.textContent = css
  document.head.append(style)
}
