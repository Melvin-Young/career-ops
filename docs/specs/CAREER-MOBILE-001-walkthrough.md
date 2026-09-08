> Captures referenced below live locally in `reports/mobile-workspace-2026-09-08/` (user layer, not committed). The PR for this ticket carries the key frames.

# Mobile desk — rendered walkthrough (2026-09-08)

Ticket: `docs/specs/CAREER-MOBILE-001-fable-redesign.md`. Branch `feature/mobile-workspace` (commit named in the handoff). Every capture below comes from `web/tests/browser/mobile-journey.mjs` running against an isolated fixture root built by `web/tests/fixtures/build-mobile-root.mjs`; the machine-readable results are in `evidence.json` (54 checks, 0 failed on the final run). No real tracker, inbox, profile or CV was read or written.

## What is real and what is a stub

- Real: the Next.js app, its routes, the core writers it calls (`scan.mjs` appendToPipeline/appendToScanHistory, `set-status.mjs`, `reserve-report-num.mjs`, `merge-tracker.mjs`, `application-artifacts.mjs`, `application-answers.mjs`), Playwright PDF export, the status ledger.
- Stub, labelled: `web/tests/fixtures/stub-cli/claude` stands in for the agent CLI on PATH. It logs the argv and prompt it received and writes a report/TSV/merge through the canonical scripts. Evidence that the worker interface was invoked for the selected job only is in `evidence.json` ("the real worker interface was invoked for the selected job only"). It proves invocation, not evaluation quality.
- Stub: the "employer site" is a loopback HTTP server serving a schema.org JobPosting page, a title-only page and a 403 wall.

## Captures (390 CSS px unless named)

| File | What it shows |
| --- | --- |
| `01-desk-390.png` | Populated desk: save entry, To do / Applied / All, rule-separated rows with a state rail and a state sentence. |
| `02-save-preview-390.png` | Save phase one: fields read from the page (company, title, location, pay), employer link found. |
| `03-saved-role-390.png` | A saved, unevaluated role opened by its URL identity; Prepare packet is the only spend. |
| `04-duplicate-save-390.png` | Repeat save (with tracking params) resolves to the existing record; no new row. |
| `05-save-fallback-390.png` | 403 page: manual company/title, optional pasted description, marked not verified. |
| `06-unverified-role-390.png` | The unverified role's packet with the "page not read" fact. |
| `07-prepare-failed-390.png` | Worker failure shown as failure; nothing recorded; retry offered. |
| `08-packet-fit-390.png` | After retry, the saved link became tracker row 4 and the Fit stop is filled. |
| `09-packet-resume-approved-390.png` | Resume v1 approved with a persistent Download v1 link, v2 draft alongside. |
| `10-packet-resume-v2-approved-390.png` | v2 approved; the v1 link now answers 409. |
| `11-export-failed-390.png` | Export failure (EACCES injected) with the previous export intact. |
| `12-export-retry-ok-390.png` | Retry exports v2 without re-approval. |
| `13-editing-390.png` | Editing an approved version as a new draft; version switch asks before discarding. |
| `14-answers-390.png` | A draft answer reviewed and added; copy feedback. |
| `15-applied-sheet-390.png` | The "I applied" sheet: role, date, platform. |
| `16-applied-recorded-390.png` | Recorded: applied banner, stamp stop, ledger line. |
| `17-applied-without-packet-390.png` | A saved link recorded as applied with no packet: tracker row with N/A score, `-` → Applied ledger line. |
| `18-desk-360.png`, `18-desk-430.png`, `19-packet-360.png`, `19-packet-430.png` | Narrow and wide phones, no horizontal scroll, 44px targets. |
| `20-packet-390-zoom200.png` | 200% zoom. |
| `21-desk-390-keyboard.png` | Short viewport (keyboard open): Save stays reachable. |
| `22-desk-1280.png`, `23-packet-1280.png`, `24-more-menu-1280.png` | Desktop, and the More menu with every secondary tool. |
| `25-packet-390-dark.png`, `26-desk-390-dark.png` | Dark theme with reduced motion; contrast probe passes. |

## Request and state evidence

- Duplicate protection: `evidence.json` checks "a repeated confirm returns the existing id and adds nothing" and "pipeline.md has exactly one row for the URL".
- Approval-version binding: "download link serves PDF bytes for the approved version" (200, `X-Artifact-Version: 1`, attachment filename with role and version), "a link naming an unapproved version is refused" (409), "the old v1 link no longer serves bytes after v2 is approved".
- Applied gate: "opening the posting leaves the tracker untouched", "downloading leaves the tracker untouched", "recording writes Applied through set-status with the date and platform" (ledger line `1\t2026-09-08\tEvaluated\tApplied\tweb`), "repeating the confirmation adds no second transition" (`changed:false`).

## Limits

- Chrome emulation is not iOS Safari or Telegram's in-app browser. File download to Files and upload into an employer form are the human device check.
- The stub CLI does not evaluate; the real `claude` path is exercised only by the argv/prompt it received.
- Contrast probe covers rendered text in `main` with rgb colors; semi-transparent overlays are skipped and listed as `unparsed` in `evidence.json`.
- The real worktree's tracker and inbox are untouched by this work; the personal data here is fictional (Jordan Reyes).
