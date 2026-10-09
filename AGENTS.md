# AGENTS.md

Repository notes for agents. Keep this file current when you learn something
that is not obvious from the code.

## What this is

toolspace — privacy-first developer tools. Static SPA, no backend. Deployed on
Cloudflare Workers (live: https://toolspace.sirsamyoudev.workers.dev). CI runs
typecheck, test and build (`.github/workflows/ci.yml`); Cloudflare's Git
integration does the deploy, so pushing to `main` is what ships.

## Hard rules

- **Nothing a user pastes is ever uploaded.** No backend to send it to.
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
  (+ `upload.wikimedia.org` / `thumb.wikimedia.org`), `api.frankfurter.dev`, `registry.npmjs.org`,
  `api.npmjs.org`, `public.api.bsky.app` (+ `cdn.bsky.app`),
  `api.open-meteo.com` (+ `geocoding-api.open-meteo.com`). Pair each JSON host
  with its image host; they are separate CSP directives.
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
  `.test.ts` beside it, and `tool.css`. Keep logic out of the DOM layer so it
  stays testable.
- Build UI with the `el(tag, attrs, ...children)` helper from `core/dom`.
- Reuse classes from `src/styles/main.css` (`ts-button`, `ts-field`, `ts-note`,
  …). Per-tool styles go in that tool's `tool.css`.
- `src/core/identity.ts` derives a per-tool sigil and category hue from the
  slug. Add new categories to `CATEGORY_HUES` there or they fall back to blue.

## Commands

```
npm run typecheck
npm test
npm run build
```

## Gotchas

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
- Adding a third-party image host means updating the CSP in `public/_headers`
  **and** the honesty copy in `src/ui/app.ts` and `README.md`.
- **A bare `python3 -m http.server` does not apply `_headers`,** so it cannot
  reproduce a CSP bug. To exercise the real policy, read the
  `Content-Security-Policy` line out of `public/_headers` and send it from a
  small custom handler; that is how the `blob:` gap in `img-src` was found.
  `frame-ancestors 'none'` also blocks iframe test harnesses on purpose - relax
  that one directive in the local server, not in the repo.
- **Image uploads need `blob:` in `img-src`.** Image tools hand the chosen file
  to an `<img>` as an object URL. Without `blob:` the load is refused and the
  file looks corrupt. `createImageBitmap(blob)` is not governed by `img-src`, so
  a canvas path can work while the preview stays blank.
