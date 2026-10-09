# Contributing to toolspace

Thanks for wanting to help. This guide is short on purpose.

## The one rule

**A tool runs in the browser.** If your idea needs a server of your own, a
database, or a credentialed API, it belongs in a different project.

There is one narrow exception: a tool may make a direct request to a public,
key-less, CORS-open service for a lookup the user asked for. Those tools must
declare it (`Tool.remote`), get the origin added to `public/_headers`, and be
listed in the README. See the README's *Network tools* section before you
start one — most ideas do not qualify.

## Setup

```bash
git clone https://github.com/sqmyou/toolspace.git
cd toolspace
npm install
npm run dev
```

## Adding a tool

1. Copy the starter folder:

   ```bash
   cp -r templates/tool src/tools/my-tool
   ```

2. Rename `slug` in `index.ts` to match the folder name (`my-tool`).
3. Write the logic in a plain module and cover it with tests. Keep DOM code out
   of the logic so it can be tested without a browser — this is the single thing
   that makes tools maintainable.
4. Build the UI in `render(root)` using the `el()` helper and the kit in
   `core/components.ts`. Reuse existing classes rather than adding bespoke
   styles where you can.
5. Verify:

   ```bash
   npm test
   npm run typecheck
   npm run build
   ```

6. Open a pull request.

A tool folder looks like this:

```
src/tools/my-tool/
  index.ts        # metadata + render()
  my-tool.ts      # pure logic
  my-tool.test.ts # tests for the logic
```

## Expectations

- **Small and focused.** One tool does one job.
- **Tested.** Behaviour is covered by unit tests. Real inputs and outputs.
- **Readable.** Match the style of the surrounding code. Comments explain *why*,
  not *what*.
- **No new dependencies** without a good reason. The project's speed and
  small size are features.

## Commit and PR conventions

- Small, focused commits with plain messages in the imperative mood
  ("Add cron parser", not "added stuff").
- One tool or fix per pull request.
- The pull request description should say what the tool does and how you tested
  it.

## Reporting bugs

Open an issue with the tool name, what you did, what you expected, and what
happened. Screenshots help.
