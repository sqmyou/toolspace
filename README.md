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
  is no network request after the page loads.
- **Offline by default.** Install it as a PWA and it keeps working on a plane.
- **Actually fast.** No framework at runtime, no analytics, no third-party
  scripts. The whole app is a few kilobytes.
- **Built to be extended.** Drop a folder in `src/tools/` and it appears in the
  sidebar. No central list to edit, so contributors don't collide.

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
    app.ts        # sidebar, search, hash routing
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

The one hard rule: **no network calls.** If a tool needs a server or a live API,
it doesn't belong here — that's the promise the project is built on.

## Contributing

Contributions are welcome, from a typo fix to a new tool. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the details.

On the use of AI: use whatever tools you like. You are responsible for the code
you submit — make sure you understand it, that it is tested, and that it matches
the conventions here. Write your own commit messages and pull request
descriptions. This project is about good tools, not about how they were typed.

## License

[MIT](LICENSE). Use it, fork it, ship it.
