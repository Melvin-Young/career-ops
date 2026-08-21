import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { rmSync } from './helpers.mjs';
import {
  applicationArtifactPaths,
  approveArtifactVersion,
  ensureApplicationArtifactDirs,
  listArtifactVersions,
  resolveApprovedArtifact,
  saveArtifactDraft,
  slugifySegment,
  writeReuseDecision,
} from '../application-artifacts.mjs';
import { repoRelativeManifestPath, workspaceRelativeManifestPath } from '../generate-pdf.mjs';

function expectError(label, action, pattern) {
  try {
    action();
  } catch (error) {
    if (pattern.test(error.message)) {
      console.log(`  ✅ ${label}`);
      return;
    }
    throw new Error(`${label}: unexpected error: ${error.message}`);
  }
  throw new Error(`${label}: expected an error`);
}

const root = mkdtempSync(join(tmpdir(), 'career-ops-application-artifacts-'));
try {
  const paths = applicationArtifactPaths({ reportNum: 7, company: 'Acme AI', role: 'Senior AI Engineer', version: 2, root });
  if (paths.key === '007-acme-ai-senior-ai-engineer'
      && paths.cv.source.html === join(paths.root, 'cv', 'source', 'original.html')
      && paths.cv.tailored.pdf === join(paths.root, 'cv', 'tailored', 'v002', 'cv.pdf')) {
    console.log('  ✅ application artifacts use a stable report/company/role bundle');
  } else {
    throw new Error(`unexpected artifact paths: ${JSON.stringify(paths)}`);
  }

  ensureApplicationArtifactDirs(paths);
  if (existsSync(join(paths.root, 'jd'))
      && existsSync(join(paths.root, 'cv', 'source'))
      && existsSync(join(paths.root, 'cv', 'tailored', 'v002'))
      && existsSync(join(paths.root, 'decision'))) {
    console.log('  ✅ application artifact directories initialize together');
  } else {
    throw new Error('application artifact directories were not created');
  }

  writeReuseDecision(paths, {
    decision: 'reuse-with-edits',
    score: 0.81,
    sourceCv: paths.cv.source.html,
    currentJd: paths.jd.current,
    previousSource: paths.jd.previous,
    changedSections: ['Summary', 'Skills'],
  });
  const decision = JSON.parse(readFileSync(paths.decision.reuse, 'utf8'));
  if (decision.decision === 'reuse-with-edits' && decision.changed_sections.length === 2) {
    console.log('  ✅ reuse decisions are recorded beside the artifact bundle');
  } else {
    throw new Error(`unexpected reuse decision: ${JSON.stringify(decision)}`);
  }

  expectError('report numbers must be numeric', () => applicationArtifactPaths({ reportNum: 'x', company: 'Acme', role: 'Engineer', root }), /reportNum must be a numeric report number/);
  expectError('versions must be positive integers', () => applicationArtifactPaths({ reportNum: 7, company: 'Acme', role: 'Engineer', version: 0, root }), /version must be a positive integer/);
  expectError('reuse decisions reject unknown values', () => writeReuseDecision(paths, { decision: 'maybe' }), /decision must be one of/);
  expectError('changed sections must be an array', () => writeReuseDecision(paths, { decision: 'reuse', changedSections: 'Summary' }), /changedSections must be an array/);
  if (slugifySegment('!!!') === 'application') console.log('  ✅ punctuation-only slugs use the application fallback');
  else throw new Error('punctuation-only slug did not use the application fallback');

  const resumeV1 = saveArtifactDraft(paths, {
    kind: 'resume',
    content: '# Resume v1\n',
    opportunityIdentity: 'tracker:7:Acme AI:Senior AI Engineer',
    sourceIdentity: 'career-profile:sha256:abc',
    provenance: ['evidence-1'],
  });
  const approvedV1 = approveArtifactVersion(paths, { kind: 'resume', version: resumeV1.version });
  const resolvedV1 = resolveApprovedArtifact(paths, 'resume');
  if (resumeV1.version === 1
      && approvedV1.state === 'approved'
      && resolvedV1.content === '# Resume v1\n'
      && resolvedV1.metadata.opportunityIdentity === 'tracker:7:Acme AI:Senior AI Engineer'
      && resolvedV1.metadata.provenance[0] === 'evidence-1') {
    console.log('  ✅ artifact drafts record opportunity identity and provenance, and resolve only through explicit approval');
  } else throw new Error('approved artifact did not resolve with its content and provenance');

  const resumeV2 = saveArtifactDraft(paths, {
    kind: 'resume',
    content: '# Resume v2\n',
    opportunityIdentity: 'tracker:7:Acme AI:Senior AI Engineer',
    sourceIdentity: 'career-profile:sha256:abc',
    provenance: ['evidence-1', 'evidence-2'],
    baseVersion: 1,
  });
  if (resumeV2.version === 2
      && resumeV2.state === 'draft'
      && resolveApprovedArtifact(paths, 'resume').content === '# Resume v1\n') {
    console.log('  ✅ editing an approved artifact creates a new draft and preserves the approved version');
  } else throw new Error('approved artifact was overwritten while editing');

  approveArtifactVersion(paths, { kind: 'resume', version: 2 });
  const versions = listArtifactVersions(paths, 'resume');
  if (resolveApprovedArtifact(paths, 'resume').content === '# Resume v2\n'
      && versions.find((item) => item.version === 1)?.state === 'superseded'
      && versions.find((item) => item.version === 2)?.state === 'approved') {
    console.log('  ✅ approval advances the pointer and supersedes the prior version without changing content');
  } else throw new Error('version approval lifecycle is inconsistent');

  expectError('failed approval leaves the previous approved artifact usable', () => approveArtifactVersion(paths, { kind: 'resume', version: 999 }), /does not exist/);
  if (resolveApprovedArtifact(paths, 'resume').content === '# Resume v2\n') console.log('  ✅ failed approval preserves the last approved artifact');
  else throw new Error('failed approval damaged the approved pointer');

  const repoPaths = applicationArtifactPaths({ reportNum: 7, company: 'Acme AI', role: 'Senior AI Engineer', version: 2, root: join(process.cwd(), 'output') });
  if (workspaceRelativeManifestPath(repoPaths.cv.tailored.html) === 'output/007-acme-ai-senior-ai-engineer/cv/tailored/v002/cv.html'
      && workspaceRelativeManifestPath(repoPaths.cv.tailored.pdf) === 'output/007-acme-ai-senior-ai-engineer/cv/tailored/v002/cv.pdf'
      && repoRelativeManifestPath(repoPaths.cv.tailored.pdf) === workspaceRelativeManifestPath(repoPaths.cv.tailored.pdf)) {
    console.log('  ✅ nested application HTML and PDF paths remain manifest-safe');
  } else {
    throw new Error('nested application paths were not preserved as repo-relative manifest entries');
  }

  const cli = spawnSync(process.execPath, [
    fileURLToPath(new URL('../application-artifacts.mjs', import.meta.url)),
    '--report', 'bad', '--company', 'Acme', '--role', 'Engineer', '--init',
  ], { encoding: 'utf8' });
  if (cli.status === 1
      && /application-artifacts: reportNum must be a numeric report number/.test(cli.stderr)
      && !/\n\s+at /.test(cli.stderr)) {
    console.log('  ✅ CLI validation failures exit cleanly without a stack trace');
  } else {
    throw new Error(`CLI failure was not clean: status=${cli.status} stderr=${JSON.stringify(cli.stderr)}`);
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
