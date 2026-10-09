/*
 * Applied synchronously in <head> so the correct palette is on <html> before
 * the first paint — no flash of the wrong theme. Kept as a separate file
 * rather than inline because the production CSP is script-src 'self'.
 *
 * The work is deliberately small: src/core/theme.ts resolves the active theme
 * (preset or custom) and caches the resulting custom properties under
 * `toolspace:theme-vars`; here we just replay them. That keeps the preset
 * table in one place instead of mirrored in plain JS.
 */
;(function () {
  var root = document.documentElement
  try {
    var cached = JSON.parse(localStorage.getItem('toolspace:theme-vars') || 'null')
    var vars = cached && typeof cached === 'object' && cached.vars ? cached.vars : null

    if (vars) {
      root.setAttribute('data-theme', cached.dark ? 'dark' : 'light')
      for (var name in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, name)) {
          root.style.setProperty(name, vars[name])
        }
      }
    } else {
      // First visit, or private mode: follow the OS for the default palette.
      var light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      root.setAttribute('data-theme', light ? 'light' : 'dark')
    }

    var dark = vars ? cached.dark : root.getAttribute('data-theme') !== 'light'
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', (vars && vars['--bg']) || (dark ? '#0b0d11' : '#f6f7f4'))
  } catch (e) {
    /* storage blocked; the stylesheet's media query still picks a sane default */
  }
})()
