// Canonical Career Evidence import (#2).
//
// The public seam is the import-career-evidence.mjs CLI. These checks exercise
// it against isolated Skill_Corpus and Career-Ops directories so parsing,
// provenance, idempotency, and writes can change internally without changing
// the behavior a user or the dashboard depends on.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fail, NODE, pass, rmSync, run } from './helpers.mjs';

console.log('\nimport-career-evidence.mjs — canonical Career Evidence import (#2)');

function makeFixture() {
  const tmp = mkdtempSync(join(tmpdir(), 'career-evidence-import-'));
  const source = join(tmp, 'Skill_Corpus');
  const target = join(tmp, 'career-ops');
  mkdirSync(join(source, 'Cover_Letters'), { recursive: true });
  mkdirSync(join(source, 'Jobs'), { recursive: true });
  mkdirSync(join(source, 'Fit_Analyses'), { recursive: true });
  mkdirSync(target, { recursive: true });

  writeFileSync(join(source, 'Candidate_Evidence_Profile.md'), `# Candidate_Evidence_Profile

## Verified_Impact

| Evidence | Scope | Reusable signal |
|---|---:|---|
| Reduced dashboard latency by 64% | Measured improvement | Performance diagnosis |

## Technology_Evidence

### Languages

- TypeScript
- Python familiarity; no production implementation is currently verified
`);
  writeFileSync(join(source, 'Market_Skill_Index.md'), `# Market_Skill_Index

## Skill_Demand

| Category | Normalized skill | Mentions | Current evidence | Status |
|---|---|---:|---|---|
| Languages | Go | 3 | No current resume evidence | Gap |
`);
  writeFileSync(join(source, 'Cover_Letters', 'Approved.md'), `Hey Acme team,

I build reliable systems and would welcome a conversation.
`);
  writeFileSync(join(source, 'Jobs', '2026-01-02_Acme_Engineer.md'), `# Acme Engineer\n\n- **Company:** Acme\n- **Role:** Engineer\n- Captured: 2026-01-02\n`);
  writeFileSync(join(source, 'Fit_Analyses', 'Acme_Engineer_Fit_Analysis.md'), `# Acme Engineer Fit Analysis\n\n## Overall Positioning\n\nStrong fit.\n`);

  return { tmp, source, target };
}

// Apply is explicit, writes protected state atomically, and is idempotent.
{
  const fixture = makeFixture();
  try {
    const args = [
      'import-career-evidence.mjs',
      '--source', fixture.source,
      '--root', fixture.target,
      '--apply',
      '--json',
    ];
    const first = JSON.parse(run(NODE, args) || 'null');
    const storePath = join(fixture.target, 'data', 'career-evidence.json');
    const voicePath = join(fixture.target, 'writing-samples', 'skill-corpus', 'Approved.md');
    const historyPath = join(fixture.target, 'data', 'career-history.json');
    const firstBytes = existsSync(storePath) ? readFileSync(storePath, 'utf8') : '';
    const store = firstBytes ? JSON.parse(firstBytes) : null;

    const applied = first
      && first.mode === 'apply'
      && first.summary.addedEvidence === 3
      && first.summary.addedMarketSkills === 1
      && first.summary.addedVoiceReferences === 1
      && first.summary.addedHistoryJobs === 1
      && first.summary.addedHistoryAnalyses === 1
      && store
      && store.evidence.length === 3
      && store.evidence.find((item) => item.claim === 'TypeScript')?.label === 'Demonstrated'
      && store.evidence.find((item) => item.claim.startsWith('Python familiarity'))?.label === 'Transferable'
      && store.evidence.find((item) => item.claim.startsWith('Python familiarity'))?.outwardEligible === false
      && store.marketSkills[0].label === 'Gap'
      && store.marketSkills[0].outwardEligible === false
      && existsSync(voicePath)
      && JSON.parse(readFileSync(historyPath, 'utf8')).jobs.length === 1
      && JSON.parse(readFileSync(historyPath, 'utf8')).jobs[0].company === 'Acme'
      && readFileSync(voicePath, 'utf8').includes('Hey Acme team');

    if (applied) pass('apply writes approved Career Evidence and internal-only gaps to protected user storage');
    else fail(`unexpected applied store: result=${JSON.stringify(first)} store=${JSON.stringify(store)}`);

    const second = JSON.parse(run(NODE, args) || 'null');
    const secondBytes = existsSync(storePath) ? readFileSync(storePath, 'utf8') : '';
    const idempotent = second
      && second.summary.addedEvidence === 0
      && second.summary.addedMarketSkills === 0
      && second.summary.addedVoiceReferences === 0
      && second.summary.addedHistoryJobs === 0
      && second.summary.addedHistoryAnalyses === 0
      && firstBytes === secondBytes;
    if (idempotent) pass('re-applying an unchanged corpus adds no duplicates and leaves canonical bytes unchanged');
    else fail(`re-apply was not idempotent: ${JSON.stringify(second)}`);

    writeFileSync(join(fixture.source, 'Candidate_Evidence_Profile.md'), readFileSync(join(fixture.source, 'Candidate_Evidence_Profile.md'), 'utf8').replace('Reduced dashboard latency by 64%', 'Reduced dashboard latency by 65%'));
    writeFileSync(join(fixture.source, 'Market_Skill_Index.md'), readFileSync(join(fixture.source, 'Market_Skill_Index.md'), 'utf8').replace('| Go | 3 |', '| Go | 4 |'));
    writeFileSync(join(fixture.source, 'Cover_Letters', 'Approved.md'), 'Hey Acme team,\n\nUpdated approved voice reference.\n');
    const conflictPlan = JSON.parse(run(NODE, ['import-career-evidence.mjs', '--source', fixture.source, '--root', fixture.target, '--json']) || 'null');
    const reportsConflicts = conflictPlan?.summary?.conflicts >= 3
      && conflictPlan.conflicts.evidence.length >= 1
      && conflictPlan.conflicts.marketSkills.length === 1
      && conflictPlan.conflicts.voiceReferences.length === 1;
    if (reportsConflicts) pass('dry-run separates proposed additions from changed-source conflicts');
    else fail(`changed source conflicts were not reported: ${JSON.stringify(conflictPlan)}`);

    const updated = JSON.parse(run(NODE, args) || 'null');
    const updatedStore = JSON.parse(readFileSync(storePath, 'utf8'));
    const replacesChangedImports = updated.summary.conflicts >= 3
      && updatedStore.evidence.length === 3
      && updatedStore.evidence.some((item) => item.claim.includes('65%'))
      && updatedStore.marketSkills[0].mentions === 4
      && updatedStore.voiceReferences.length === 1
      && readFileSync(voicePath, 'utf8').includes('Updated approved voice reference');
    if (replacesChangedImports) pass('explicit apply replaces changed imported records without leaving stale duplicates');
    else fail(`changed imports were not replaced cleanly: ${JSON.stringify(updatedStore)}`);
  } finally {
    rmSync(fixture.tmp, { recursive: true, force: true });
  }
}

// Dry-run is the safety default: it reports exactly what it found and creates
// no user-layer state.
{
  const fixture = makeFixture();
  try {
    const stdout = run(NODE, [
      'import-career-evidence.mjs',
      '--source', fixture.source,
      '--root', fixture.target,
      '--json',
    ]);
    let result = null;
    try { result = JSON.parse(stdout || 'null'); } catch { /* failure reported below */ }

    const safe = result
      && result.mode === 'dry-run'
      && result.summary.evidence === 3
      && result.summary.marketSkills === 1
      && result.summary.voiceReferences === 1
      && result.summary.historyJobs === 1
      && result.summary.historyAnalyses === 1
      && result.marketSkills[0].label === 'Gap'
      && result.writes.length === 0
      && !existsSync(join(fixture.target, 'data', 'career-evidence.json'));
    const noHistoryWrite = !existsSync(join(fixture.target, 'data', 'career-history.json'));

    if (safe && noHistoryWrite) pass('dry-run plans verified evidence, labeled market skills, voice, and history without writing');
    else fail(`unexpected dry-run plan or write: ${JSON.stringify(result)}`);
  } finally {
    rmSync(fixture.tmp, { recursive: true, force: true });
  }
}
