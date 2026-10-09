/*
 * Applied synchronously in <head> so the correct theme is on <html> before the
 * first paint — no flash of the wrong palette. Kept as a separate file rather
 * than inline because the production CSP is script-src 'self'.
 *
 * Mirrors src/core/theme.ts: presets and custom themes store an accent (and
 * optionally a background) alongside the dark/light choice. Keeping the accent
 * maths here too — rather than importing the module — is what lets the accent
 * land before the bundle runs. If you change the storage shape in one, change
 * it in the other.
 */
;(function () {
  var root = document.documentElement
  try {
    var mode = localStorage.getItem('toolspace:theme')
    var stored = JSON.parse(localStorage.getItem('toolspace:accent') || 'null')
    var dark =
      mode === 'dark' || mode === 'light'
        ? mode === 'dark'
        : !(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
    root.setAttribute('data-theme', dark ? 'dark' : 'light')

    if (stored && typeof stored === 'object') {
      var accent = null
      if (typeof stored.presetId === 'string') {
        accent = { voltage: '#ccff4d', iris: '#a78bfa', glacier: '#38e0d4', ember: '#ff8a4c', neon: '#ff5c9d', paper: '#4f7a12', cobalt: '#2450c8', terminal: '#43ff6b' }[stored.presetId] || null
      } else if (stored.custom && typeof stored.custom.accent === 'string') {
        accent = stored.custom.accent
        dark = !!stored.custom.dark
        root.setAttribute('data-theme', dark ? 'dark' : 'light')
        if (typeof stored.custom.bg === 'string') {
          root.setAttribute('data-bg', 'custom')
          root.style.setProperty('--bg', stored.custom.bg)
        }
      }
      if (accent) {
        root.style.setProperty('--accent', accent)
        root.style.setProperty('--accent-ink', luminance(accent) > 0.4 ? '#0b0d11' : '#ffffff')
        root.style.setProperty('--accent-strong', towards(accent, dark ? 255 : 0, 0.22))
      }
    }

    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta)
      meta.setAttribute(
        'content',
        (stored && stored.custom && stored.custom.bg) || (dark ? '#0b0d11' : '#f6f7f4'),
      )
  } catch (e) {
    /* storage blocked; the stylesheet's media query still picks a sane default */
  }

  function channels(hex) {
    var value = String(hex).trim().replace(/^#/, '')
    if (value.length === 3) value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2]
    if (!/^[0-9a-f]{6}$/i.test(value)) return null
    return [0, 2, 4].map(function (i) {
      return parseInt(value.slice(i, i + 2), 16)
    })
  }

  function luminance(hex) {
    var rgb = channels(hex)
    if (!rgb) return 0
    var parts = rgb.map(function (c) {
      var v = c / 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]
  }

  function towards(hex, target, amount) {
    var rgb = channels(hex)
    if (!rgb) return hex
    return (
      '#' +
      rgb
        .map(function (c) {
          return Math.max(0, Math.min(255, Math.round(c + (target - c) * amount)))
            .toString(16)
            .padStart(2, '0')
        })
        .join('')
    )
  }
})()
