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
- The single documented exception to "no network" is the YouTube thumbnail
  grabber loading public images from `i.ytimg.com`. See README. Do not add a
  second one without saying so on the home page and in the README.

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
