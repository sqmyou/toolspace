# toolspace

**Small, fast tools that run in your browser.**

No account. No tracking. No build step to use them. Open a tool, use it, close
the tab. Most of them never touch the network at all.

---

## Why

You need to decode a JWT at 2am and the top result wants you to accept cookies,
sit through an ad, or paste a production token into a stranger's server. The
alternative is a desktop app you install for one job and open twice a year.

toolspace is the opposite: one static page, a hundred small tools, and no
backend to speak of. It loads fast, works offline, and costs nothing to host
because there is nothing to host.

## What's here

- **Your input stays put.** Each tool is a pure function over what you give it.
  There is no backend and no analytics.
- **Offline by default.** Install it as a PWA and it keeps working on a plane.
- **Fast.** No framework at runtime, no third-party scripts. The whole app is a
  few kilobytes.
- **Easy to extend.** Drop a folder in `src/tools/` and it shows up in the
  catalogue. No central list to edit, so contributors never collide.

A handful of tools do use the network — a public lookup you asked for, sent
straight from your browser to the service that has the data. They are marked
everywhere they appear, and you can switch them off entirely. The specifics are
under [Network tools](#network-tools) below.

## Quickstart

```bash
git clone https://github.com/sqmyou/toolspace.git
cd toolspace
npm install
npm run dev       # http://localhost:5173
```

Other scripts:

```bash
npm test          # unit tests (vitest)
npm run typecheck # tsc --noEmit
npm run build     # typecheck + production build into dist/
npm run preview   # serve the built output
```

Deploying is `npm run build` and pointing any static host at `dist/`. It is a
plain folder of files.

## Project structure

```
src/
  core/
    types.ts      # the Tool interface everything implements
    registry.ts   # auto-discovers tools via import.meta.glob
    dom.ts        # tiny `el()` helper, so tools need no framework
    components.ts # the shared UI kit
  ui/
    app.ts        # shell, search, theme, hash routing
  tools/
    password-generator/
      index.ts    # UI: render(root)
      password.ts # pure logic
      password.test.ts
  styles/main.css
templates/tool/   # copy this folder to start a new tool
```

## Adding a tool

A tool is one folder with a default export. Roughly ten minutes:

1. Copy `templates/tool/` to `src/tools/<your-slug>/`.
2. Fill in the metadata in `index.ts` — `slug`, `name`, `description`,
   `category`, optional `keywords`.
3. Put the actual work in a separate module and test it. Keep it out of the DOM
   layer so it stays testable.
4. Write `render(root)` to build the UI with `el()`, using the kit in
   `core/components.ts` and the classes in `src/styles/main.css`.
5. Run `npm test` and `npm run typecheck`, then open a pull request.

The `slug` must match the folder name. The folder is picked up automatically.

The default rule: **a tool runs entirely in the browser.** There is no backend
to send anything to.

## Network tools

A few tools need data that lives somewhere else. Each one is a direct
browser-to-service request for a public lookup the person explicitly asked for:
no proxy, no token, no cookies, and every one is marked with a `network` tag
wherever it is listed. The origins the CSP allows are:

| Host | Tool | What leaves the tab |
| --- | --- | --- |
| `i.ytimg.com` | YouTube Thumbnail | the public thumbnail for the video id in the link |
| `dns.google` | DNS Lookup | the domain name you type |
| `api.github.com`, `avatars.githubusercontent.com` | GitHub Profile | the username you type |
| `cdn.cloudflare.steamstatic.com` | Steam Artwork | the app id you type |
| `en.wikipedia.org`, `upload.wikimedia.org`, `thumb.wikimedia.org` | Wikipedia Summary | the article title you type |
| `api.frankfurter.dev` | Currency Converter | the currency pair you pick |
| `registry.npmjs.org`, `api.npmjs.org` | npm Package | the package name you type |
| `public.api.bsky.app`, `cdn.bsky.app` | Bluesky Profile | the handle you type |
| `api.open-meteo.com`, `geocoding-api.open-meteo.com` | Weather | the place name you type |

Those are the only third-party origins the policy permits, and none of them
need more than this. They are also optional: the home page has a **Network
tools** switch, and turning it off hides every network-backed tool from the
index, the search and the command palette and blocks deep links to them. The
app becomes strictly offline.

*A tool that needs more than this does not belong here.* Roblox is the worked
example: its JSON APIs allow only Roblox's own origin, and per-user images sit
behind the same wall, so a Roblox tool is impossible rather than merely absent.

A tool declares its network use in code (`Tool.remote`), and the shell derives
the tag, the notice on the tool page and the offline counts from that
declaration. You cannot add a network tool by omission — the origin has to go
in `public/_headers`, in this README, and in the home-page copy in the same
change.

## Contributing

Contributions are welcome, from a typo fix to a new tool. See
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Use it, fork it, ship it.
