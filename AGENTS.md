# AGENTS.md

Notes for anyone working in this repo. Keep this file current when you learn
something that is not obvious from the code.

## What this is

toolspace — a static SPA of small browser tools. No backend. Deployed on
Cloudflare Workers (live: https://toolspace.sirsamyoudev.workers.dev). CI runs
typecheck, test and build (`.github/workflows/ci.yml`); Cloudflare's Git
integration does the deploy, so pushing to `main` is what ships.

## Hard rules

- **A tool runs in the browser.** There is no backend to send anything to.
- **No new runtime dependencies** beyond the two already allowed
  (`qrcode-generator`, `sql-formatter`). A tool must be implementable with the
  platform and what is already here.
- Network tools are allowed but must be *opt-out* and disclosed. A tool that
  talks to a third party declares it in `Tool.remote: { host, note }`; the shell
  derives the tag, the tool-page notice, the offline counts and the
  `networkEnabled()` switch from that. The home-page **Network tools** switch
  hides every network-backed tool (index, search, palette, deep links) when off,
  so the app can be strictly offline. Adding an origin means updating
  `public/_headers` (CSP), the README and the home-page copy together — see
  README "Network tools". Currently allowed: `i.ytimg.com`, `dns.google`,
  `api.github.com` (+ `avatars.githubusercontent.com` for images),
  `cdn.cloudflare.steamstatic.com` (images only), `en.wikipedia.org`
  (+ `upload.wikimedia.org` / `thumb.wikimedia.org`), `api.frankfurter.dev`,
  `registry.npmjs.org`, `api.npmjs.org`, `public.api.bsky.app`
  (+ `cdn.bsky.app`), `api.open-meteo.com` (+ `geocoding-api.open-meteo.com`).
  Pair each JSON host with its image host; they are separate CSP directives.
- **CORS is the real limit, not CSP.** A static SPA can only call an API that
  sends `access-control-allow-origin`. Roblox is a closed case: every JSON API
  (`users.roblox.com`, `badges.roblox.com`, ...) reflects ACAO *only* for
  Roblox's own origin, and the only per-user image URL lives behind
  `thumbnails.roblox.com`, which sends none — so Roblox cannot be built here at
  all, for data or images. Steam is half-open: `api.steampowered.com` and
  `store.steampowered.com/api` send no ACAO, but the image CDN
  (`cdn.cloudflare.steamstatic.com/steam/apps/<id>/<file>`) sends
  `access-control-allow-origin: *`, so an *image* tool is buildable even though
  a JSON tool is not. Verify with `curl -D - -H "Origin: https://x" <url>`
  before promising a network tool — and probe the image host and the API host
  separately, they can differ.

## Layout

- Tools live in `src/tools/<slug>/` and are auto-discovered by
  `import.meta.glob('../tools/*/index.ts')`. There is no central registry —
  creating the folder is the registration.
- A tool is `index.ts` (UI, exports `render(root)`), a pure-logic module, a
  `.test.ts` beside it, and optional `tool.css`. Keep logic out of the DOM layer
  so it stays testable.
- Build UI with the `el(tag, attrs, ...children)` helper from `core/dom` and the
  shared kit in `core/components.ts` (`panel`, `split`, `grid`, `card`, `stats`,
  `field`, `actions`, `note`, …). Per-tool styles go in that tool's `tool.css`.
- `src/core/identity.ts` derives a per-tool sigil and category hue from the
  slug. Categories are a fixed list — add new ones to `CATEGORY_HUES` there or
  they fall back to blue.

## Theming

There is one accent over a near-greyscale ramp, so a theme is `--accent` plus,
for a custom background, `--bg`. `src/core/theme.ts` owns the presets, the
storage (`toolspace:accent`, and the legacy `toolspace:theme` dark/light flag)
and the colour maths: `--accent-strong`, `--accent-soft`, `--accent-line` and
the chip ink are derived from the accent, so a new preset is one line. The
picker in `src/ui/app.ts` is only paint; it never touches storage directly.
`public/theme-init.js` mirrors the accent maths so the colour lands before the
bundle paints — if you change the storage shape, change both.

## Commands

```
npm run typecheck
npm test
npm run build
```

## Copy rules

The privacy story should be stated **once per page at most**, and only where it
is actionable:

- Local tools carry **no** privacy note. Silence is the default.
- Network tools carry one `ts-tool-remote` badge in the header (host + one
  sentence), driven by `Tool.remote`. Do not repeat it in the body.
- Do not open tool descriptions or sample text with the privacy pitch.

## Gotchas

- **A tool renders before it is in the document.** `toolPage()` calls
  `tool.render(body)` and only appends the section to `main` afterwards, so at
  render time the tool is detached. Any measurement that reads the layout
  (`getComputedStyle(...).lineHeight`, `offsetWidth`, `getBoundingClientRect`)
  returns zero or an empty string. The typing-speed-test bug came from exactly
  this: it measured a detached track, cached `lineHeight` as NaN and locked the
  clip to `height: 0`, so the whole test was invisible. Measure lazily and
  re-measure once attached (a `ResizeObserver` on the element is the clean fix),
  and never assume the first layout pass is real.

- **`tool-styles.ts` must keep `eager: true`.** Per-tool `tool.css` is discovered
  with `import.meta.glob(..., { eager: true, query: '?inline' })`. Drop `eager`
  and Vite stops inlining those files, so every tool's custom CSS silently
  vanishes from the bundle — typecheck, tests and build all still pass.

- **Smoke-testing locally:** `vite preview` rejects the runtime proxy hosts with
  `403 Blocked request. This host is not allowed`. Serve the build directly
  instead: `cd dist && python3 -m http.server 12000 --bind 0.0.0.0`, then open
  `https://work-1-<id>.prod-runtime.all-hands.dev/`.
- **The browser caches the bundle hard.** After a rebuild, a page that still
  shows old behaviour may just be a stale bundle. Confirm against `dist/`
  (`grep` the built JS) and reload with a changing `?cb=<n>` query.
- **CSP lives in `public/_headers`.** The app is a hash-router SPA
  (`not_found_handling: single-page-application`), so path-scoped `_headers`
  rules can never match — an exception has to be global, in the `/*` rule.
- **YouTube thumbnails:** a size that does not exist returns HTTP 404 *and* a
  real 120×90 placeholder JPEG, so `img.onerror` never fires. Detect it by
  checking `naturalWidth` after load. The 120×90 `default` size is therefore
  omitted from the tool — it is indistinguishable from the placeholder.
  `i.ytimg.com` sends `access-control-allow-origin: *` and no cookies, so a
  canvas read (and thus a real download) works.
- Adding a third-party image host means updating the CSP in `public/_headers`,
  the README host table, and the home-page copy.
- **A bare `python3 -m http.server` does not apply `_headers`,** so it cannot
  reproduce a CSP bug. To exercise the real policy, read the
  `Content-Security-Policy` line out of `public/_headers` and send it from a
  small custom handler; that is how the `blob:` gap in `img-src` was found.
  `frame-ancestors 'none'` also blocks iframe test harnesses on purpose — relax
  that one directive in the local server, not in the repo.
- **Image uploads need `blob:` in `img-src`.** Image tools hand the chosen file
  to an `<img>` as an object URL. Without `blob:` the load is refused and the
  file looks corrupt. `createImageBitmap(blob)` is not governed by `img-src`, so
  a canvas path can work while the preview stays blank.
- **The privacy page's host table is generated**, not written by hand: it reads
  `Tool.remote` off the registry in `src/ui/privacy.ts`, so it cannot go stale
  when a tool is added. `public/_headers` is still the manual list — those two
  are the only places a network origin is declared.
- **Per-route metadata lives in `src/core/meta.ts`.** A hash-router SPA has one
  static `<head>`, so `applyMeta()` sets `document.title`, the description and a
  `<link rel="canonical">` on every route change. `SITE_ORIGIN` is a hardcoded
  production URL — change it in the same commit as any domain move.
- **Check for an existing tool before adding one.** Overlap has crept in more
  than once, so treat any "missing tool" list compiled from memory as unproven —
  grep the `name`, `description` and `keywords` in `src/tools/*/index.ts` first.
  Known consolidated families (do not re-propose these as new tools):
  - `csv-json` — CSV ↔ JSON ↔ Markdown, delimiter sniffing, column alignment,
    **and** nested-JSON flattening (folded in from `json-to-csv`).
  - `base-encodings` — Base32 (RFC 4648 **and** Crockford), Base58, Base58Check,
    hex and binary (folded in from `base32`).
  - `id-generator` — UUID v4/v7, ULID (+ ULID decode), NanoID, hex, ObjectId
    (folded in from `ulid`).
  - `site-files` — robots.txt *and* sitemap.
  - `cron-explainer` — explains *and* builds cron expressions.
  - `hash-generator` — hashes **and HMAC**.
  When a new tool does overlap, fold its one extra capability into the existing
  tool rather than shipping a second page. That is how column alignment and
  flattening landed in `csv-json`, and `csv-markdown`, `json-to-csv`, `base32`
  and `ulid` were removed.
