# toolspace

**A junk drawer of developer tools that never upload your stuff.**

No ads. No sign-up. No server. Open a tool, use it, close the tab. Nothing you
type or paste ever leaves your browser.

---

## Why this exists

Need to decode a JWT at 2am and the top result wants you to accept cookies,
watch an ad, or — worse — paste a production token into a stranger's server.
The alternatives are slow desktop apps you install for one job and use twice.

`toolspace` is the opposite: one static page, dozens of small tools, all
running locally. It loads fast, works offline, and costs nothing to host
because there is no backend to host.

## What makes it different

- **Your data stays put.** Every tool is a pure function over your input. There
  is no network request after the page loads (see the one exception below, which
  you can switch off).
- **Offline by default.** Install it as a PWA and it keeps working on a plane.
- **Actually fast.** No framework at runtime, no analytics, no third-party
  scripts. The whole app is a few kilobytes.
- **Built to be extended.** Drop a folder in `src/tools/` and it appears in the
  catalogue. No central list to edit, so contributors don't collide.

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
3. Put the actual work in a separate file (`logic.ts` or similar) and test it.
   Anything that touches the DOM can't be unit tested, so keep logic out of it.
4. Write `render(root)` to build your UI with `el()`. Reuse the classes in
   `src/styles/main.css` (`ts-button`, `ts-field`, `ts-output`, …) so it looks
   native to the app.
5. Run `npm test` and `npm run typecheck`, then open a pull request.

The `slug` must match the folder name. The folder is picked up automatically.

The hard rule: **nothing you paste is ever uploaded.** A tool runs entirely in
the browser, and there is no backend to send anything to.

There is a small, documented set of network tools. Each one is a *direct
browser-to-service request* for a public lookup the user explicitly asked for;
none of them go through a proxy, carry a token, or send cookies, and all of
them are marked with a `network` tag everywhere they are listed. The origins
are:

- **`i.ytimg.com`** — the YouTube thumbnail grabber loads the public thumbnail
  image, because that is where YouTube stores it. It carries no user data
  beyond the video id already in the URL.
- **`dns.google`** — the DNS lookup asks Google's public resolver for the
  records of the domain you type. The domain name is the only thing sent.
- **`api.github.com`** (and `avatars.githubusercontent.com` for the image) —
  the GitHub profile lookup reads the *public* profile and repository data for
  the username you type. No token, no sign-in, no personal data.

These are the only third-party origins the CSP allows, and any tool that needs
more than this does not belong here. Crucially, they are all optional: the home
page has a **Network tools** switch, and turning it off hides every
network-backed tool from the index, the search and the command palette, and
blocks deep links to them, so the app becomes strictly offline. The switch is
the reason the privacy promise still holds — a user who wants zero requests
gets zero requests.

A tool declares its network use in code (`Tool.remote` in `src/core/types.ts`),
and the shell derives the tag, the tool-page notice, the offline counts and the
switch behaviour from that declaration. Adding a network tool without
disclosing it is not possible by omission — you must add the origin here, in
the CSP (`public/_headers`), and in the home-page copy in the same change.

## Contributing

Contributions are welcome, from a typo fix to a new tool. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the details.

On the use of AI: use whatever tools you like. You are responsible for the code
you submit — make sure you understand it, that it is tested, and that it matches
the conventions here. Write your own commit messages and pull request
descriptions. This project is about good tools, not about how they were typed.

## License

[MIT](LICENSE). Use it, fork it, ship it.
