# CAREER-MOBILE-001 — A personal application workspace worth using from a phone

Type: feature
Status: ready
Blocked by: none for local design and implementation; private remote rollout is separately human-gated
Design and implementation owner: Fable
Final acceptance: Melvin, with independent engineering review
Baseline inspected: `9e2b6c82501acc04f24190d841efb3d0d26b67d4` on `feature/unified-job-workspace`

## Outcome

Replace the current Career-Ops presentation with an original, mobile-first application that makes this loop effortless:

**Save a job → choose what to pursue → review an application packet → download/copy approved materials → apply externally → record submission.**

This is a private working tool, not a recruiting marketplace, marketing landing page, or analytics showcase. The user discovers jobs through Telegram/Hermes, LinkedIn, Indeed, employer sites, and Career-Ops. They often apply from their phone. Their Mac can remain awake and online. Desktop remains useful for longer editing sessions.

The user explicitly rejects the current UI and authorizes replacing its shell, navigation, layout, typography, colors and components. Reuse business behavior and data contracts, not its visual identity. A superficial recolor or reskinned dashboard does not satisfy the brief.

## Authoritative context

Repository root on this Mac: `~/orca/workspaces/career-ops/siren`.

Read before implementation:

- `AGENTS.md`, `DATA_CONTRACT.md`, `CONTEXT.md` and `modes/_custom.md`.
- `docs/adr/0001-career-ops-owns-career-evidence.md` and `docs/adr/0002-application-artifacts-are-versioned-derivatives.md`.
- Existing umbrella [issue #1](https://github.com/Melvin-Young/career-ops/issues/1), with role/artifact work tracked in #3–#7. Those issues remain open; their status is not proof that the code is absent.
- `reports/mobile-audit-2026-09-08/audit.md` and its screenshots, when available locally. These diagnose the old design, not a visual target to preserve.
- `~/.codex/skills/career-mobile/SKILL.md` for the shared conversational workflow; the repository owns factual and lifecycle rules.

Explicit amendment to issue #1: its limitation against redesigning outside the Application Workspace is superseded by this user-approved visual replacement. Its canonical-data and approved-artifact decisions remain controlling. Existing utility capabilities may move into secondary navigation; do not silently remove their underlying functionality.

Current facts: Next.js/React/Tailwind app exists under `web/`; it reads canonical files rather than owning a second database. Pipeline and application tracker were empty when inspected. Use isolated synthetic fixtures for design/testing; never populate the real tracker to make screenshots look convincing. The separate SeatGeek submission has not been reconciled into that tracker by this spec.

## Design authority and required skills

Fable is the single art-direction owner. Choose the visual thesis, palette, type and composition; do not ask the user to repeat the settled use case or select every design detail. Review the design plan against this brief, then build and critique it. Final visual acceptance still belongs to Melvin.

Load these sources directly; slash-command availability is not assumed:

1. `~/.agents/skills/frontend-design/SKILL.md` — primary art-direction process. Before coding, write a compact plan with 4–6 named color tokens, type roles, spacing/shape/motion rules, and mobile/desktop layout sketches. Critique it for generic defaults and revise before implementation.
2. `~/.agents/skills/design-library/SKILL.md` and its `INDEX.md` — router for `~/Development/mengto-skills`. Use selected techniques, not the entire library.
3. MengTo `agent-skills/web-design/tailwindcss/SKILL.md` — responsive composition and implementation guidance. Installed project versions/configuration take precedence over generic examples.
4. MengTo `agent-skills/ui/no-ai-design-slop/SKILL.md` and relevant `ARTICLE.md` sections — quality gate preserving the new visual thesis. Load a further surface/motion skill only if the chosen design needs it; record why. No shader, glass, marquee or cinematic effect is required merely because it exists in the folder.

The product's characteristic object is the **job and its application packet**, not a giant metric or decorative hero. Make that the center of the first useful viewport. Aim for personal, assured, readable and fast; spend visual boldness in one coherent place. Keep copy in plain sentence case with concrete verbs. Avoid simply reproducing the rejected cream/serif/orange treatment or defaulting to unrelated SaaS decoration.

### Mobbin references already inspected

Mobbin read-only search succeeded for this spec. These are reference evidence, not a licensed asset bundle or mandated layout:

- [Glassdoor saved jobs](https://mobbin.com/screens/e510cf9a-ddda-476b-a3e9-7df9dff2cca6): compact rows prioritize title, company, location, pay and age. Borrow scanability and information ordering, not its branding or ratings.
- [Handshake saved items](https://mobbin.com/screens/2e31bea5-8644-478b-9353-c19c0bcede28): saved content is grouped by type, with company and role separated. Learn from the grouping; avoid unnecessary nested containers in this app.
- [Linktree PDF preview](https://mobbin.com/screens/1556454c-72a0-4899-b19f-be47547b3bf5): document preview and a clear View action make the artifact tangible. It does not demonstrate approval or download-version integrity; those are our own requirements.

Use Mobbin for further focused screen/flow research where needed. Inspect actual returned images; cite canonical screen links and explain the principle adopted. Do not send private career files to reference-search tools. If live access is unavailable, these inspected references are sufficient to begin; report the limit instead of inventing reference evidence. Missing local skill files should be requested or resolved from the same skill repository, not silently substituted with a different design system.

## Required behavior

Presentation may combine or separate the following surfaces. Labels and composition are design choices; the behavior is not.

### Save and choose

- A visible Save job entry accepts a LinkedIn, Indeed or employer URL. Preserve the supplied discovery link; retain a verified employer link separately when found. Saving does not implicitly run evaluation or generate a resume.
- Show extracted company/title/location/pay when available and let the user correct them. Missing metadata is unknown, not a guessed value. If the page cannot be read, retain the URL and allow pasted description/manual company and title, clearly unverified. A pasted-only job requires a source URL for this increment; explain that requirement and preserve in-progress input.
- Deduplicate against the current inbox and tracker using existing URL/role identity behavior. A repeat save opens the existing role; same company with a different requisition remains distinct. Repeated taps and refresh must not create duplicate records.
- Show saved Opportunities and actual Applications, searchable by company/title, with useful filtering by current state and available fit information. The default view emphasizes actionable roles, not a wall of zero-count filters. Unevaluated jobs have no fabricated scores. Existing scans remain available as a secondary explicit action.
- Selecting an unevaluated role must open its context and permit preparation; it must not depend on a report already existing. Use an existing stable URL/record identity until a canonical tracker/report ID exists, then preserve the relationship.

### Prepare and review

- Prepare packet processes only the selected role. Use existing evaluation/worker behavior and canonical report/tracker writers, with clear in-progress, failure and retry states. Do not launch bulk processing or charge generation costs merely by opening a role. Preserve low-fit warnings and explicit overrides from repository rules.
- Packet contains the role/source link, verification date/status, fit/risks, tailored resume, optional concise cover letter, actual supplied application questions with copyable answer drafts, and unresolved questions. Do not fabricate application questions as though extracted, candidate facts, posting freshness, or remote eligibility.
- Presentation distinguishes draft, approved version and downloadable version. Let the user read before editing; mobile must not force a long raw-text editor ahead of the useful preview. Preserve edits across recoverable failures and warn before leaving/switching versions with unsaved changes.
- Approve names the artifact and version being approved. Later edits create a new draft rather than modify the approved content. A packet may be partly approved; show what is ready instead of a misleading global Ready badge.
- New answer text must be reviewed before it is presented as ready-to-use. Preserve source provenance and unresolved facts. Use the existing role output boundary for packet/answer data; do not create a parallel store of application state.

### Use from a phone and record

- Approved resume/letter exports expose persistent, clearly named download links identifying role and version. Opening the link works independently of an async popup. Export failure leaves the previous usable approved artifact intact and offers retry without reapproval of unchanged content.
- Answers have individual Copy actions and visible success/failure feedback. Distinguish internal fit notes from text intended for the application.
- Open application opens the source/employer page for the user to apply manually. It never auto-fills, clicks Submit, or changes status. Keep legacy assisted-apply access, if retained, outside this new primary workflow and label it distinctly.
- I applied requires explicit confirmation of the selected role, date and platform, then writes through the canonical status workflow. A user may have applied without preparing a packet: do not gate submission recording on a generated PDF. Repeated confirmation must not duplicate the submission transition. Activity reflects persisted state after reload.
- Telegram and web are two entrances to the same records. This work delivers stable job/packet deep links and reusable server operations for Hermes; it does not install or connect a Telegram bot. Clearly show unavailable integration rather than a fake Connected status.

## Scope and authority

In scope: replace the web presentation throughout the primary journey and shared shell; reorganize secondary tools; implement the small web/service adapters required for the journey above. Keep the existing Next.js app and data model. Do not scaffold a disconnected demo as the deliverable.

Permitted mutations: a dedicated feature branch/worktree based on the inspected branch; `web/` components, routes, styles, assets, tests and necessary package/lockfile updates; narrow adapters to existing canonical core operations where needed; scoped documentation and isolated test fixtures. Inspect current diff first. Preserve unrelated `docs/research/`, audit artifacts and other user work. Do not broadly stage the worktree.

Live personal data is not a test fixture. Test via `CAREER_OPS_ROOT` pointing at an isolated fixture root; include the core scripts required by worker calls. Do not copy protected credentials or change the master resume/profile, targeting, real queue, history or tracker during implementation verification. A new worktree will not automatically contain ignored personal files.

Non-goals: rebuilding scanners, new database/evidence migration, public marketing site, native phone app, offline synchronization, multi-user accounts, automated submissions, bot installation, production hosting, Tailscale configuration or background scheduling. A public deployment is not part of this ticket.

Human-gated: merge/push/publication, remote-access changes, credential/account connection, paid services, real application submissions and canonical Career Profile edits. Run previews only on loopback. Keep the origin guard; hostname allowlisting is not authentication and only `/api` is currently guarded. Do not expose the app to a network to make phone testing easier. A separate private-access deployment task must protect pages and APIs together.

## Acceptance criteria

- [ ] The result is visibly a new coherent design, not a recolor. Its first phone viewport makes saving/selecting a job obvious, and repeated job metadata is scannable without a desktop table scroll.
- [ ] URL save, metadata fallback, duplicate save and distinct requisitions behave as specified and persist correctly after reload against isolated fixtures.
- [ ] An unevaluated saved role can reach a real packet workflow. Preparing one role does not process others; worker failure is recoverable and never represented as completed output.
- [ ] Resume/letter approval, new-version editing and download resolution obey ADR 0002. The primary flow has no direct unapproved PDF-generation bypass. Returned PDF bytes correspond to the displayed approved role/version.
- [ ] Packet questions, answers, open questions and source/verification information are readable; copy results are truthful; missing evidence stays visibly unresolved.
- [ ] External-link opening and downloading never mark Applied. Explicit confirmation works with or without a packet and produces the expected single persisted transition/date/platform.
- [ ] All primary actions work at 360, 390 and 430 CSS-pixel widths and at 1280 desktop width. Long titles, empty/one/many jobs, keyboard-open forms and 200% zoom do not hide critical controls or introduce page-level horizontal scrolling.
- [ ] Primary touch targets are at least 44x44 CSS pixels; focus is visible; inputs have accessible names; errors/status changes are announced; states do not rely on color alone; reduced motion is respected. Verify text contrast, not just appearance.
- [ ] Existing non-primary utilities remain reachable or have documented equivalent routes. Canonical files, CLI compatibility, evidence eligibility, locks, approval gates and source-link provenance remain intact.
- [ ] Local checks and rendered evidence are attached to the exact patch/commit; no fake integration success, fabricated job activity, or live-data test contamination.

## Verification

From the repository root:

```sh
npm --prefix web test
npm --prefix web run typecheck
BUILD_DIST=.next-mobile-review npm --prefix web run build
node tests/application-artifacts.test.mjs
node validate-system-paths-coverage.mjs
git diff --check
```

Pass signal: each applicable command exits zero, tests actually execute, and no new source-path coverage gaps. If core code changes beyond artifact adapters, also run `node test-all.mjs --quick` in a clean isolated checkout with Git metadata and the proposed patch. The prior direct suite hit a dangling user-document link; do not delete user documents or weaken tests to bypass it. Investigate and distinguish baseline failures from regressions.

Browser oracle: create isolated fixtures for an empty inbox, a saved unverified role, duplicate/different requisitions, an evaluated role with gaps, draft/approved/newer-draft artifacts and an Applied role. Run the app with `CAREER_OPS_ROOT` targeting that fixture root, bind to `127.0.0.1`, and use available browser tooling to execute the save-to-submission-confirmation journey. Stub external generation deterministically for failure/retry coverage; label it as a stub. Separately prove the existing real worker interface is correctly invoked for the selected role; a fixture timer alone is not integration evidence.

Capture and inspect screenshots of the populated list, capture fallback, packet review, editing, approved download state, error recovery and recorded application at phone and desktop sizes. Record request/state evidence for duplicate protection, approval-version binding and the Applied gate. Attach a short task walkthrough and explicit failures/limits. Real iOS Safari/Android and Telegram in-app-browser file handling is a final human device check; emulation does not prove it. No employer submission is needed for that check.

Final gate: independent review of the exact patch for data/lifecycle/security preservation, followed by Melvin's visual acceptance and phone download/copy check. Worker reports `human-review`; it does not close its own ticket or assert production readiness.

## Unknowns and stop conditions

Fable may resolve component structure, route organization, font choice, visual tokens and supporting techniques from the repository/reference work without another planning interview. Keep those choices documented and coherent.

If an existing API cannot satisfy the stated behavior, a thin adapter using canonical core functions is in scope. Stop and report evidence if satisfying it requires a new authoritative database, revised approval/evidence rules, an external account, remote deployment, or unapproved paid infrastructure. Do not disguise an unavailable operation as a successful animation. Preserve unrelated work when overlap cannot be safely resolved and request direction.

## Completion handoff

Return the commit SHA or reproducible patch identity, changed behavior, design thesis and selected skills, Mobbin reference links with adopted principles, exact check results, screenshots/walkthrough tied to that identity, fixture/live integration distinction, and residual risks. List private-access/Hermes/device checks that remain separate. Leave merge and final acceptance to Melvin.

## Paste to Fable

Read this entire spec, then the named repository authorities and design skills. You own the new art direction: replace the current UI rather than cosmetically preserving it. Use frontend-design plus selected MengTo techniques and the cited Mobbin references to create a distinctive mobile-first personal application workspace. Implement the working save → select → packet → approve/download → manually applied loop in the existing app. Preserve the canonical backend/data contracts, use isolated fixtures, verify the rendered result and approval boundaries, and return an exact-identity review handoff. Do not deploy, connect accounts, submit applications or merge.
