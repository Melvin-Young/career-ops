#!/usr/bin/env node

/**
 * Resolve and initialize one application-scoped artifact directory.
 *
 * Generated CVs are intentionally kept under output/ because they are user
 * artifacts. The directory key is stable for a report/company/role tuple so
 * the JD, source CV, tailored CV, PDF, and reuse decision stay together.
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { parseArgs } from 'util';
import { fileURLToPath } from 'url';

const DEFAULT_OUTPUT_ROOT = resolve('output');
const DECISIONS = new Set(['reuse', 'reuse-with-edits', 'regenerate']);
const ARTIFACT_KINDS = new Set(['resume', 'cover-letter']);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function atomicWrite(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = join(dirname(file), `.${basename(file)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temp, content, { encoding: 'utf8', mode: 0o600 });
  renameSync(temp, file);
}

function assertKind(kind) {
  if (!ARTIFACT_KINDS.has(kind)) throw new Error(`kind must be one of: ${[...ARTIFACT_KINDS].join(', ')}`);
}

function artifactRoot(paths, kind) {
  assertKind(kind);
  return join(paths.root, 'artifacts', kind);
}

function versionPaths(paths, kind, version) {
  const root = join(artifactRoot(paths, kind), `v${String(version).padStart(3, '0')}`);
  return { root, content: join(root, 'content.md'), metadata: join(root, 'metadata.json'), pdf: join(root, 'artifact.pdf') };
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Convert a user-facing label into a safe, readable path segment. */
export function slugifySegment(value, fallback = 'application') {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

/** Return all stable paths belonging to one application artifact bundle. */
export function applicationArtifactPaths({ reportNum, company, role, version = 1, root = DEFAULT_OUTPUT_ROOT }) {
  if (!/^\d+$/.test(String(reportNum ?? ''))) {
    throw new Error('reportNum must be a numeric report number');
  }
  if (!/^\d+$/.test(String(version ?? '')) || Number(version) < 1) {
    throw new Error('version must be a positive integer');
  }
  const key = `${String(reportNum).padStart(3, '0')}-${slugifySegment(company)}-${slugifySegment(role, 'role')}`;
  const applicationRoot = join(resolve(root), key);
  const tailoredRoot = join(applicationRoot, 'cv', 'tailored', `v${String(version).padStart(3, '0')}`);
  return {
    key,
    root: applicationRoot,
    jd: {
      current: join(applicationRoot, 'jd', 'current.md'),
      previous: join(applicationRoot, 'jd', 'previous.md'),
    },
    cv: {
      source: {
        html: join(applicationRoot, 'cv', 'source', 'original.html'),
        pdf: join(applicationRoot, 'cv', 'source', 'original.pdf'),
      },
      tailored: {
        root: tailoredRoot,
        html: join(tailoredRoot, 'cv.html'),
        pdf: join(tailoredRoot, 'cv.pdf'),
        changes: join(tailoredRoot, 'changes.md'),
      },
    },
    decision: {
      reuse: join(applicationRoot, 'decision', 'reuse.json'),
    },
  };
}

/** Create the JD and CV subdirectories for an application bundle. */
export function ensureApplicationArtifactDirs(paths) {
  for (const directory of [
    join(paths.root, 'jd'),
    join(paths.root, 'cv', 'source'),
    paths.cv.tailored.root,
    join(paths.root, 'decision'),
    join(paths.root, 'artifacts'),
  ]) mkdirSync(directory, { recursive: true });
  return paths;
}

/** Read version metadata newest-first. Corrupt entries fail closed. */
export function listArtifactVersions(paths, kind) {
  const root = artifactRoot(paths, kind);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v\d{3,}$/.test(entry.name))
    .map((entry) => {
      const version = Number(entry.name.slice(1));
      const files = versionPaths(paths, kind, version);
      if (!existsSync(files.metadata) || !existsSync(files.content)) throw new Error(`${kind} v${version} is incomplete`);
      return readJson(files.metadata);
    })
    .sort((a, b) => b.version - a.version);
}

/** Read one complete version without exposing the on-disk directory layout to
 * dashboard routes. Integrity is checked for drafts as well as approvals. */
export function readArtifactVersion(paths, kind, version) {
  const files = versionPaths(paths, kind, Number(version));
  if (!existsSync(files.metadata) || !existsSync(files.content)) throw new Error(`${kind} v${version} is incomplete`);
  const metadata = readJson(files.metadata);
  const content = readFileSync(files.content, 'utf8');
  if (metadata.kind !== kind || metadata.version !== Number(version) || metadata.contentHash !== sha256(content)) {
    throw new Error(`${kind} v${version} failed integrity validation`);
  }
  return { metadata, content, paths: files };
}

/** Save human-readable content. An approved base is immutable, so editing it
 * allocates the next deterministic draft version. A draft base is updated in
 * place, preserving its original creation time. */
export function saveArtifactDraft(paths, {
  kind,
  content,
  opportunityIdentity,
  sourceIdentity,
  provenance = [],
  baseVersion = null,
}) {
  assertKind(kind);
  if (typeof content !== 'string' || !content.trim()) throw new Error('content must be non-empty text');
  if (typeof opportunityIdentity !== 'string' || !opportunityIdentity.trim()) throw new Error('opportunityIdentity is required');
  if (typeof sourceIdentity !== 'string' || !sourceIdentity.trim()) throw new Error('sourceIdentity is required');
  if (!Array.isArray(provenance) || provenance.some((item) => typeof item !== 'string')) throw new Error('provenance must be an array of strings');
  ensureApplicationArtifactDirs(paths);
  const versions = listArtifactVersions(paths, kind);
  const base = baseVersion == null ? null : versions.find((item) => item.version === Number(baseVersion));
  if (baseVersion != null && !base) throw new Error(`${kind} v${baseVersion} does not exist`);
  const version = base?.state === 'draft' ? base.version : (versions[0]?.version ?? 0) + 1;
  const files = versionPaths(paths, kind, version);
  const now = new Date().toISOString();
  const metadata = {
    schemaVersion: 1,
    kind,
    version,
    state: 'draft',
    createdAt: base?.state === 'draft' ? base.createdAt : now,
    updatedAt: now,
    opportunityIdentity: opportunityIdentity.trim(),
    sourceIdentity: sourceIdentity.trim(),
    provenance: [...new Set(provenance)],
    contentHash: sha256(content),
  };
  mkdirSync(files.root, { recursive: true });
  atomicWrite(files.content, content);
  atomicWrite(files.metadata, `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

/** Atomically move the approved pointer only after a complete candidate has
 * been validated. A failed approval therefore leaves the previous pointer and
 * its export resolution usable. */
export function approveArtifactVersion(paths, { kind, version }) {
  assertKind(kind);
  const files = versionPaths(paths, kind, Number(version));
  if (!existsSync(files.metadata) || !existsSync(files.content)) throw new Error(`${kind} v${version} does not exist`);
  const metadata = readJson(files.metadata);
  const content = readFileSync(files.content, 'utf8');
  if (metadata.kind !== kind || metadata.version !== Number(version) || metadata.contentHash !== sha256(content)) {
    throw new Error(`${kind} v${version} failed integrity validation`);
  }
  const pointerPath = join(artifactRoot(paths, kind), 'approved.json');
  const previous = existsSync(pointerPath) ? readJson(pointerPath) : null;
  const approved = { ...metadata, state: 'approved', approvedAt: new Date().toISOString() };
  atomicWrite(files.metadata, `${JSON.stringify(approved, null, 2)}\n`);
  atomicWrite(pointerPath, `${JSON.stringify({ schemaVersion: 1, kind, version: approved.version, contentHash: approved.contentHash, approvedAt: approved.approvedAt }, null, 2)}\n`);
  if (previous && previous.version !== approved.version) {
    const oldFiles = versionPaths(paths, kind, previous.version);
    if (existsSync(oldFiles.metadata)) {
      const old = readJson(oldFiles.metadata);
      atomicWrite(oldFiles.metadata, `${JSON.stringify({ ...old, state: 'superseded', supersededAt: approved.approvedAt }, null, 2)}\n`);
    }
  }
  return approved;
}

/** Resolve the explicitly approved immutable content for preview/export. */
export function resolveApprovedArtifact(paths, kind) {
  const pointerPath = join(artifactRoot(paths, kind), 'approved.json');
  if (!existsSync(pointerPath)) return null;
  const pointer = readJson(pointerPath);
  const files = versionPaths(paths, kind, pointer.version);
  if (!existsSync(files.metadata) || !existsSync(files.content)) throw new Error(`approved ${kind} v${pointer.version} is incomplete`);
  const metadata = readJson(files.metadata);
  const content = readFileSync(files.content, 'utf8');
  if (pointer.contentHash !== sha256(content) || metadata.contentHash !== pointer.contentHash) throw new Error(`approved ${kind} v${pointer.version} failed integrity validation`);
  return { metadata, content, paths: files };
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Render only the explicitly approved version. The PDF is first written to a
 * sibling temp file and renamed on success, so a browser/render failure cannot
 * corrupt the previous usable export. */
export async function exportApprovedArtifactToPdf(paths, kind) {
  const approved = resolveApprovedArtifact(paths, kind);
  if (!approved) throw new Error(`no approved ${kind} version to export`);
  const { chromium } = await import('playwright');
  const temp = join(dirname(approved.paths.pdf), `.${basename(approved.paths.pdf)}.${process.pid}.${Date.now()}.tmp`);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ format: 'Letter' });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:letter;margin:.65in}body{font:11pt/1.45 Arial,sans-serif;color:#161616;white-space:pre-wrap}h1{font-size:20pt}</style></head><body>${escapeHtml(approved.content)}</body></html>`);
    await page.pdf({ path: temp, format: 'Letter', printBackground: true });
    renameSync(temp, approved.paths.pdf);
    return { ...approved, pdf: approved.paths.pdf };
  } finally {
    await browser.close();
    if (existsSync(temp)) unlinkSync(temp);
  }
}

/** Write an auditable CV reuse decision beside the application artifacts. */
export function writeReuseDecision(paths, {
  decision,
  score = null,
  sourceCv = null,
  currentJd = null,
  previousSource = null,
  changedSections = [],
  userOverride = false,
}) {
  if (!DECISIONS.has(decision)) throw new Error(`decision must be one of: ${[...DECISIONS].join(', ')}`);
  if (!Array.isArray(changedSections)) throw new Error('changedSections must be an array');
  ensureApplicationArtifactDirs(paths);
  const record = {
    schema_version: 1,
    decision,
    score,
    source_cv: sourceCv,
    current_jd: currentJd,
    previous_source: previousSource,
    changed_sections: changedSections,
    user_override: Boolean(userOverride),
    recorded_at: new Date().toISOString(),
  };
  writeFileSync(paths.decision.reuse, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

function usage() {
  return 'Usage: node application-artifacts.mjs --report N --company NAME --role ROLE [--version N] [--root output] [--init]';
}

async function main() {
  const { values } = parseArgs({
    options: {
      report: { type: 'string' },
      company: { type: 'string' },
      role: { type: 'string' },
      version: { type: 'string', default: '1' },
      root: { type: 'string' },
      init: { type: 'boolean' },
    },
    strict: true,
  });
  if (!values.report || !values.company || !values.role) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  const paths = applicationArtifactPaths({ reportNum: values.report, company: values.company, role: values.role, version: values.version, root: values.root });
  if (values.init) ensureApplicationArtifactDirs(paths);
  console.log(JSON.stringify(paths, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`application-artifacts: ${error.message}`);
    process.exitCode = 1;
  });
}
