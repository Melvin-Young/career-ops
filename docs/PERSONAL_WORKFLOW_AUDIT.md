# Personal Workflow Audit

Run this checklist after changing Career Evidence, pipeline classification, role workspaces, or artifact handling. Use local or synthetic data; never commit `data/`, `output/`, profile files, or writing samples.

## Safety checks

1. Run `node test-all.mjs --only career-evidence-import`.
2. Run `node test-all.mjs --only application-artifacts`.
3. Run `npm test`, `npm run typecheck`, and `BUILD_DIST=.next-audit npm run build` from `web/`.
4. Confirm `git status --short --ignored` shows `data/career-evidence.json`, `data/career-history.json`, `writing-samples/skill-corpus/`, and application artifacts under `output/` as ignored.

## Browser workflow

1. Open **Evidence**. Confirm Career Facts, Market Evidence, Voice References, Historical Intelligence, and Import Provenance render. Historical jobs must not change Pipeline or Analytics counts.
2. Open **Pipeline**. Confirm evaluated/skipped/discarded rows are Opportunities and Applied/responded/interview/offer/hired/rejected rows are Applications.
3. Open a role. Confirm the Fit, Resume, Cover Letter, and Activity tabs share the same role identity.
4. In **Fit**, confirm the score, legitimacy, source posting, evaluation, status control, CV generation, and Apply action remain available.
5. In **Resume**, generate a draft, edit it, save it, approve it, and export the approved PDF. Confirm the canonical `cv.md` bytes did not change.
6. Edit the approved resume. Confirm a new draft version is created and the previous approved version remains available until the new draft is explicitly approved.
7. In **Cover Letter**, generate the default draft and confirm it targets 70–120 words. Generate long form and confirm it is a separate explicit action. Edit, save, approve, and export.
8. Trigger a failed approval with a nonexistent version through the local API or the artifact test. Confirm the last approved content still resolves and exports.
9. After actually submitting outside Career-Ops, set the role to **Applied**. Confirm it moves from Opportunity to Application without losing Fit, artifacts, or Activity history.

## Import replay

1. Run `npm run import:evidence -- --source /path/to/Skill_Corpus --json` and review the plan.
2. Run the same command with `--apply`.
3. Run it again. Confirm it reports no new Career Evidence, market skills, voice references, jobs, or analyses and does not create duplicates.
