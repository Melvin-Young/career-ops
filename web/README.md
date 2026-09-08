# career-ops web (alpha)

An **experimental, opt-in web UI** for career-ops. It is a local-first *view* over
the exact same files the CLI reads and writes (`data/pipeline.md`,
`data/applications.md`, `reports/`, `config/`): no parallel engine, no separate
database, no server. If you never run it, nothing about your CLI workflow changes.

> **Status: alpha.** Expect rough edges. Feedback →
> [Discussion #1142](https://github.com/santifer/career-ops/discussions/1142) ·
> roadmap context → [Discussion #156](https://github.com/santifer/career-ops/discussions/156).

## Quick start

Requires Node 22+ (see [Tests](#tests) — `npm test`'s glob discovery needs it).

```bash
cd web
npm ci
npm run dev
```

Open http://localhost:3000. The app reads the career-ops checkout it lives in
(the parent directory) — your existing CV, pipeline and reports appear as-is.

## What works today

- **Pipeline** — your tracker as a sortable, filterable table; status changes
  write back through the core's own scripts.
- **Explore** — the free reverse-ATS scan with an honest partial-dataset
  indicator, plus AI-assisted discovery (bring your own CLI/keys).
- **Apply** — assisted form prefill with a hard rule inherited from the core:
  **it never submits for you** — you always press the button.
- **Today / Analytics / CV / Config** — action queue, funnel, CV editing with
  preview, settings.

## The desk (mobile-first primary journey)

The primary journey is one loop: **save a job → open its packet → prepare
(evaluate) → review and approve a resume/letter → copy answers → apply on the
employer's site → record that you applied.** Design notes: `web/DESIGN.md`.

- `/` — the desk: paste a link, pick a job. `/role/{id}` — the packet, where
  `id` is a tracker row number or a `u-…` key derived from a saved link's URL
  (a saved link that gains a tracker row redirects to the row).
- Server operations live in `src/lib/roles/server.ts` (`listRoles`,
  `resolveRole`, `previewSave`, `commitSave`, `recordApplied`,
  `saveReviewedAnswers`) and are exposed under `/api/roles/*`. They compose the
  core's own writers — `scan.mjs` `appendToPipeline`, `set-status.mjs`,
  `merge-tracker.mjs`, `application-answers.mjs` — and never keep a second
  store. A Telegram/Hermes bridge would call the same functions.
- Approved exports download from `/api/artifacts/pdf?n=…&kind=…&v=N`; the
  link is bound to the approved version and answers 409 when that changes.
- Old `/pipeline` links redirect. Secondary tools live behind **More**.

Browser oracle against an isolated fixture root (never your real data):

```bash
node web/tests/fixtures/build-mobile-root.mjs /tmp/desk-root
cd web && CAREER_OPS_ROOT=/tmp/desk-root CAREER_OPS_STUB_LOG=/tmp/desk-stub.log \
  PATH="$PWD/tests/fixtures/stub-cli:$PATH" npx next dev --hostname 127.0.0.1 --port 3111
# in another shell
CAREER_OPS_STUB_LOG=/tmp/desk-stub.log node web/tests/browser/mobile-journey.mjs \
  --base http://127.0.0.1:3111 --root /tmp/desk-root --out /tmp/desk-shots
```

`tests/fixtures/stub-cli/claude` is a labelled stub that stands in for the
agent CLI: it records the argv/prompt it received and writes a report through
the canonical scripts, so the run proves the worker interface without spending
tokens. It is not an evaluation.

## Safety

- **Local-first:** the local web app runs entirely on your machine — no cloud,
  no account needed. Your CV and data stay in your own files.
- **Never auto-submits:** the apply flow drafts and prefills; submitting is
  always a human action.
- **CV generation never asks the agent to write:** the `pdf` worker tailors your
  CV and emits it inline in a `<<cv-html>>` envelope; the backend parses that
  envelope, writes the HTML, and renders the PDF itself. Job postings and
  evaluation reports are untrusted input that reaches this agent, so the safest
  thing is for it to hold no write tool at all — on Claude Code every write-capable
  tool is disallowed for this mode (`Write`, `Edit`, `MultiEdit`, `NotebookEdit`
  and `Bash`). Other CLIs are invoked with a bare prompt and keep their own default
  tool access, so on those the agent still *holds* write tools — what the pipeline
  guarantees is that the CV which gets rendered is the one the backend parsed out of
  the envelope, never a file an agent wrote behind it.
- **Additive:** the web is isolated from the core's packaging, CI and release
  automation. The CLI works exactly the same without it.

## Development

```bash
npm run dev          # dev server (Turbopack)
npm test             # unit suites (node --test, no framework)
npx tsc --noEmit     # typecheck
npm run build        # production build
```

Set `CAREER_OPS_ROOT=/path/to/checkout` in `web/.env.local` to point the app at
a different career-ops directory (useful for testing against sample data).

### Tests

Suites live in `web/tests/`, mirroring the path of what they test under
`web/src/` — so `src/lib/clean-chips.mjs` is tested by
`tests/lib/clean-chips.test.mjs`. Name the file `{module}.test.mjs`.

`npm test` discovers them with a glob (`tests/**/*.test.mjs`), so a new suite
needs **no registration** — just add the file. **Requires Node ≥ 22**: earlier
versions don't expand CLI globs for `node --test`, so `npm test` prints
`Could not find '…'`, runs nothing and exits 1. Hence `engines.node` in
`web/package.json` — a higher floor than `next` itself asks for.

Three constraints follow from all this:

- **Keep tests out of `src/`.** `src/` is the Next.js app's own tree, scanned by
  `next build`'s file tracing and `tsc --noEmit`; test files there entangle
  fixtures with build and route conventions.
- **Use `.mjs`, not `.ts`.** There is no test framework and no TypeScript loader
  by design — `node --test` cannot run a `.ts` suite, so one would look like
  coverage and never execute. Extract the logic under test into a plain `.mjs`
  module (the pattern `src/lib/pdf-paths.mjs` and `src/lib/pdf-render.mjs`
  already follow) and import it from the test.
- **Web suites use `node:test`; core suites don't.** Here you write
  `import { test } from "node:test"` with `node:assert/strict`. The root
  `tests/` suite deliberately uses neither — it has its own `pass`/`fail`
  helpers, because [#1440](https://github.com/santifer/career-ops/issues/1440)
  requires the core suite to run on a bare clone with "no framework, not even
  `node:test`". Don't carry either style across the boundary.

`tests/web-test-layout.test.mjs` in the **root** suite enforces all of the above
on every PR, including that `npm test` never goes back to listing suites by name
([#2360](https://github.com/santifer/career-ops/issues/2360)).
