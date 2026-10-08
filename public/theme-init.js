/*
 * Applied synchronously in <head> so the correct theme is on <html> before the
 * first paint — no flash of the wrong palette. Kept as a separate file rather
 * than inline because the production CSP is script-src 'self'.
 */
;(function () {
  try {
    var stored = localStorage.getItem('toolspace:theme')
    var theme =
      stored === 'dark' || stored === 'light'
        ? stored
        : window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f1ea' : '#0b0e12')
  } catch (e) {
    /* storage blocked; the stylesheet's media query still picks a sane default */
  }
})()
