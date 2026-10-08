# Contributing to toolspace

Thanks for wanting to help. This guide is short on purpose.

## The one rule

**No network calls.** Every tool must run entirely in the browser. If your idea
needs a server, an external API, or a database, it belongs in a different
project.

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
   that makes tools maintainable and is expected in review.
4. Build the UI in `render(root)` using the `el()` helper. Reuse existing CSS
   classes rather than adding bespoke styles where you can.
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
- **Tested.** Behaviour is covered by unit tests. Snapshot-free, real inputs and
  outputs.
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

## About AI

You're free to use AI tools while contributing — this project takes no position
on how code gets written. What matters is that:

- you understand what you're submitting and can explain it if asked;
- it is tested and follows the conventions above;
- commit messages and pull request descriptions are your own words.

Code that looks plausible but isn't understood won't survive review. That
applies to everyone, AI-assisted or not.

## Reporting bugs

Open an issue with the tool name, what you did, what you expected, and what
happened. Screenshots help.
