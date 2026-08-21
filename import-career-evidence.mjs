#!/usr/bin/env node
// import-career-evidence.mjs — one-way Skill_Corpus → Career-Ops import (#2).
//
// Dry-run is the default and the public safety contract. The module parses a
// Skill_Corpus into a deterministic plan; later slices apply that plan to the
// protected user layer and expose it through the local dashboard.
import { createHash } from 'crypto';
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync,
} from 'fs';
import { basename, dirname, join, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const LABELS = new Set(['Demonstrated', 'Transferable', 'Unverified', 'Gap']);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stableId(kind, sourcePath, value) {
  return `${kind}-${sha256(`${sourcePath}\n${value}`).slice(0, 16)}`;
}

function sourceRef(root, file, section) {
  return {
    path: relative(root, file).split(sep).join('/'),
    ...(section ? { section } : {}),
  };
}

function cells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
}

function isSeparatorRow(row) {
  return row.length > 0 && row.every((cell) => /^:?-{3,}:?$/.test(cell));
}

// The legacy profile is a verified source, but some entries deliberately
// describe adjacent familiarity or undocumented depth. Preserve that boundary
// instead of promoting the underlying technology to a demonstrated claim.
function candidateLabel(claim) {
  return /\b(familiar(?:ity)?|not (?:yet )?documented|not established|not currently verified|no production(?: or project)? implementation)\b/i.test(claim)
    ? 'Transferable'
    : 'Demonstrated';
}

function parseCandidateEvidence(sourceRoot, file) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const evidence = [];
  let h2 = '';
  let h3 = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const second = line.match(/^##\s+(.+?)\s*$/);
    const third = line.match(/^###\s+(.+?)\s*$/);
    if (second) {
      h2 = second[1];
      h3 = '';
      continue;
    }
    if (third) {
      h3 = third[1];
      continue;
    }

    if (h2 === 'Verified_Impact' && line.trim().startsWith('|')) {
      const row = cells(line);
      if (row[0] === 'Evidence' || isSeparatorRow(row) || !row[0]) continue;
      const claim = row[0];
      evidence.push({
        id: stableId('evidence', sourceRef(sourceRoot, file).path, claim),
        label: candidateLabel(claim),
        claim,
        ...(row[1] ? { scope: row[1] } : {}),
        ...(row[2] ? { signal: row[2] } : {}),
        source: sourceRef(sourceRoot, file, h2),
      });
      continue;
    }

    const bullet = line.match(/^\s*-\s+(.+?)\s*$/);
    if (!bullet || !h2 || h2 === 'Source_Register') continue;
    const claim = bullet[1];
    const section = h3 ? `${h2} / ${h3}` : h2;
    evidence.push({
      id: stableId('evidence', sourceRef(sourceRoot, file).path, `${section}\n${claim}`),
      label: candidateLabel(claim),
      claim,
      category: section,
      source: sourceRef(sourceRoot, file, section),
    });
  }
  return evidence;
}

function parseMarketSkills(sourceRoot, file) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const skills = [];
  let inSkillDemand = false;
  for (const line of lines) {
    if (/^##\s+Skill_Demand\s*$/.test(line)) {
      inSkillDemand = true;
      continue;
    }
    if (inSkillDemand && /^##\s+/.test(line)) break;
    if (!inSkillDemand || !line.trim().startsWith('|')) continue;
    const row = cells(line);
    if (row[0] === 'Category' || isSeparatorRow(row) || row.length < 5) continue;
    const [category, skill, mentionsRaw, currentEvidence, label] = row;
    if (!skill || !LABELS.has(label)) continue;
    const mentions = Number.parseInt(mentionsRaw, 10);
    skills.push({
      id: stableId('market-skill', sourceRef(sourceRoot, file).path, `${category}\n${skill}`),
      category,
      skill,
      mentions: Number.isFinite(mentions) ? mentions : 0,
      currentEvidence,
      label,
      source: sourceRef(sourceRoot, file, 'Skill_Demand'),
    });
  }
  return skills;
}

function readVoiceReferences(sourceRoot) {
  const dir = join(sourceRoot, 'Cover_Letters');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const file = join(dir, entry.name);
      const content = readFileSync(file, 'utf8');
      const path = sourceRef(sourceRoot, file).path;
      return {
        id: stableId('voice', path, content),
        title: basename(entry.name, '.md'),
        path,
        contentHash: sha256(content),
        content,
      };
    });
}

function markdownRecords(sourceRoot, directory, kind) {
  const dir = join(sourceRoot, directory);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const file = join(dir, entry.name);
      const content = readFileSync(file, 'utf8');
      const rel = sourceRef(sourceRoot, file).path;
      const field = (name) => content.match(new RegExp(`^-\\s+(?:\\*\\*${name}:\\*\\*|${name}:)\\s*(.+)$`, 'im'))?.[1]?.trim() ?? null;
      return {
        id: stableId(`history-${kind}`, rel, content),
        kind,
        title: content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? basename(entry.name, '.md'),
        company: field('Company'),
        role: field('Role'),
        captured: field('Date captured') ?? field('Captured'),
        source: { path: rel, contentHash: sha256(content) },
        content,
      };
    });
}

function historyPath(root) {
  return join(root, 'data', 'career-history.json');
}

function readHistory(root) {
  const file = historyPath(root);
  if (!existsSync(file)) return { schemaVersion: 1, jobs: [], analyses: [] };
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  if (parsed?.schemaVersion !== 1) throw new Error(`unsupported Career History schema at ${file}`);
  return { schemaVersion: 1, jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [], analyses: Array.isArray(parsed.analyses) ? parsed.analyses : [] };
}

function emptyStore() {
  return { schemaVersion: 1, sources: [], evidence: [], marketSkills: [], voiceReferences: [] };
}

function storePath(root) {
  return join(root, 'data', 'career-evidence.json');
}

function readStore(root) {
  const file = storePath(root);
  if (!existsSync(file)) return emptyStore();
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`could not read existing Career Evidence at ${file}: ${error.message}`);
  }
  if (!parsed || parsed.schemaVersion !== 1) throw new Error(`unsupported Career Evidence schema at ${file}`);
  return {
    schemaVersion: 1,
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
    marketSkills: Array.isArray(parsed.marketSkills) ? parsed.marketSkills : [],
    voiceReferences: Array.isArray(parsed.voiceReferences) ? parsed.voiceReferences : [],
  };
}

function additions(existing, incoming) {
  const ids = new Set(existing.map((item) => item.id));
  return incoming.filter((item) => !ids.has(item.id));
}

function conflictSummary(existing, incoming, identity) {
  const conflicts = [];
  const existingById = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    const sameId = existingById.get(item.id);
    const candidates = sameId ? [sameId] : existing.filter((prior) => identity(prior) === identity(item));
    if (!candidates.length) continue;
    const incomingComparable = JSON.stringify(item);
    const unchanged = candidates.some((prior) => {
      const clean = { ...prior };
      delete clean.approval;
      delete clean.outwardEligible;
      delete clean.importedPath;
      return JSON.stringify(clean) === incomingComparable;
    });
    if (!unchanged) conflicts.push({ incomingId: item.id, existingIds: candidates.map((prior) => prior.id), source: identity(item) });
  }
  return conflicts;
}

function mergeImportedRecords(existing, incoming) {
  const incomingPaths = new Set(incoming.map((item) => item.source.path));
  return [...existing.filter((item) => !incomingPaths.has(item.source?.path)), ...incoming];
}

function publicVoiceReference(item) {
  const { content: _content, ...reference } = item;
  return reference;
}

function atomicWriteWithBackup(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file)) {
    const previous = readFileSync(file, 'utf8');
    if (previous === content) return false;
    copyFileSync(file, `${file}.bak`);
  }
  const temp = join(dirname(file), `.${basename(file)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temp, content, { encoding: 'utf8', mode: 0o600 });
  renameSync(temp, file);
  return true;
}

/**
 * Build a deterministic, read-only import plan.
 *
 * This is the module's interface: callers provide the external corpus and the
 * Career-Ops root; parsing details stay local to this implementation.
 */
export function planCareerEvidenceImport({ source, root }) {
  const sourceRoot = resolve(source);
  const targetRoot = resolve(root);
  const candidateFile = join(sourceRoot, 'Candidate_Evidence_Profile.md');
  const marketFile = join(sourceRoot, 'Market_Skill_Index.md');
  if (!existsSync(candidateFile)) throw new Error(`missing ${candidateFile}`);
  if (!existsSync(marketFile)) throw new Error(`missing ${marketFile}`);

  const evidence = parseCandidateEvidence(sourceRoot, candidateFile);
  const marketSkills = parseMarketSkills(sourceRoot, marketFile);
  const voiceReferences = readVoiceReferences(sourceRoot);
  const historyJobs = markdownRecords(sourceRoot, 'Jobs', 'job');
  const historyAnalyses = markdownRecords(sourceRoot, 'Fit_Analyses', 'fit-analysis');
  const existing = readStore(targetRoot);
  const existingHistory = readHistory(targetRoot);
  const addedEvidence = additions(existing.evidence, evidence);
  const addedMarketSkills = additions(existing.marketSkills, marketSkills);
  const addedVoiceReferences = additions(existing.voiceReferences, voiceReferences);
  const addedHistoryJobs = additions(existingHistory.jobs, historyJobs);
  const addedHistoryAnalyses = additions(existingHistory.analyses, historyAnalyses);
  const conflicts = {
    evidence: conflictSummary(existing.evidence, evidence, (item) => `${item.source?.path ?? ''}#${item.source?.section ?? ''}`),
    marketSkills: conflictSummary(existing.marketSkills, marketSkills, (item) => `${item.source?.path ?? ''}#${item.category ?? ''}/${item.skill ?? ''}`),
    voiceReferences: conflictSummary(existing.voiceReferences, voiceReferences.map(publicVoiceReference), (item) => item.path ?? ''),
    historyJobs: conflictSummary(existingHistory.jobs, historyJobs, (item) => item.source?.path ?? ''),
    historyAnalyses: conflictSummary(existingHistory.analyses, historyAnalyses, (item) => item.source?.path ?? ''),
  };
  const conflictCount = Object.values(conflicts).reduce((total, items) => total + items.length, 0);
  const sourceFingerprint = sha256(JSON.stringify({
    evidence: evidence.map((item) => item.id),
    marketSkills: marketSkills.map((item) => item.id),
    voiceReferences: voiceReferences.map((item) => [item.id, item.contentHash]),
    historyJobs: historyJobs.map((item) => item.id),
    historyAnalyses: historyAnalyses.map((item) => item.id),
  }));
  return {
    schemaVersion: 1,
    mode: 'dry-run',
    sourceRoot,
    targetRoot,
    summary: {
      evidence: evidence.length,
      marketSkills: marketSkills.length,
      voiceReferences: voiceReferences.length,
      addedEvidence: addedEvidence.length,
      addedMarketSkills: addedMarketSkills.length,
      addedVoiceReferences: addedVoiceReferences.length,
      historyJobs: historyJobs.length,
      historyAnalyses: historyAnalyses.length,
      addedHistoryJobs: addedHistoryJobs.length,
      addedHistoryAnalyses: addedHistoryAnalyses.length,
      conflicts: conflictCount,
    },
    evidence,
    marketSkills,
    voiceReferences: voiceReferences.map(publicVoiceReference),
    history: { jobs: historyJobs, analyses: historyAnalyses },
    conflicts,
    sourceFingerprint,
    writes: [],
  };
}

/** Apply a previously previewable import using recoverable, atomic writes. */
export function applyCareerEvidenceImport({ source, root }) {
  const plan = planCareerEvidenceImport({ source, root });
  const existing = readStore(plan.targetRoot);
  const rawVoice = readVoiceReferences(plan.sourceRoot);
  const existingHistory = readHistory(plan.targetRoot);
  const newHistoryJobs = additions(existingHistory.jobs, plan.history.jobs);
  const newHistoryAnalyses = additions(existingHistory.analyses, plan.history.analyses);
  const importedEvidence = plan.evidence.map((item) => ({
    ...item,
    approval: 'approved',
    outwardEligible: item.label === 'Demonstrated',
  }));
  const importedMarketSkills = plan.marketSkills.map((item) => ({
    ...item,
    outwardEligible: false,
  }));
  const importedVoice = rawVoice.map((item) => ({
    ...publicVoiceReference(item),
    importedPath: `writing-samples/skill-corpus/${basename(item.path)}`,
  }));
  const newEvidence = additions(existing.evidence, importedEvidence);
  const newMarketSkills = additions(existing.marketSkills, importedMarketSkills);
  const newVoice = additions(existing.voiceReferences, importedVoice);

  const sources = [...existing.sources];
  const sourceIndex = sources.findIndex((item) => item.kind === 'skill-corpus' && item.sourceRoot === plan.sourceRoot);
  if (sourceIndex < 0) {
    sources.push({
      kind: 'skill-corpus',
      sourceRoot: plan.sourceRoot,
      fingerprint: plan.sourceFingerprint,
      importedAt: new Date().toISOString(),
    });
  } else if (sources[sourceIndex].fingerprint !== plan.sourceFingerprint) {
    sources[sourceIndex] = {
      ...sources[sourceIndex],
      fingerprint: plan.sourceFingerprint,
      importedAt: new Date().toISOString(),
    };
  }

  const store = {
    schemaVersion: 1,
    sources,
    evidence: mergeImportedRecords(existing.evidence, importedEvidence),
    marketSkills: mergeImportedRecords(existing.marketSkills, importedMarketSkills),
    voiceReferences: [...existing.voiceReferences.filter((item) => !new Set(importedVoice.map((voice) => voice.path)).has(item.path)), ...importedVoice],
  };
  const writes = [];
  for (const item of rawVoice) {
    const destination = join(plan.targetRoot, 'writing-samples', 'skill-corpus', basename(item.path));
    if (atomicWriteWithBackup(destination, item.content)) writes.push(relative(plan.targetRoot, destination).split(sep).join('/'));
  }
  if (JSON.stringify(existing) !== JSON.stringify(store)) {
    const file = storePath(plan.targetRoot);
    if (atomicWriteWithBackup(file, `${JSON.stringify(store, null, 2)}\n`)) writes.push(relative(plan.targetRoot, file).split(sep).join('/'));
  }
  const mergedHistoryJobs = mergeImportedRecords(existingHistory.jobs, plan.history.jobs);
  const mergedHistoryAnalyses = mergeImportedRecords(existingHistory.analyses, plan.history.analyses);
  if (JSON.stringify(existingHistory.jobs) !== JSON.stringify(mergedHistoryJobs) || JSON.stringify(existingHistory.analyses) !== JSON.stringify(mergedHistoryAnalyses)) {
    const file = historyPath(plan.targetRoot);
    const history = {
      schemaVersion: 1,
      jobs: mergedHistoryJobs,
      analyses: mergedHistoryAnalyses,
    };
    if (atomicWriteWithBackup(file, `${JSON.stringify(history, null, 2)}\n`)) writes.push(relative(plan.targetRoot, file).split(sep).join('/'));
  }
  return {
    ...plan,
    mode: 'apply',
    summary: {
      ...plan.summary,
      addedEvidence: newEvidence.length,
      addedMarketSkills: newMarketSkills.length,
      addedVoiceReferences: newVoice.length,
      addedHistoryJobs: newHistoryJobs.length,
      addedHistoryAnalyses: newHistoryAnalyses.length,
    },
    writes,
  };
}

function usage() {
  return 'Usage: node import-career-evidence.mjs --source <Skill_Corpus> [--root <career-ops>] [--apply] [--json]';
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--')) return null;
  return args[index + 1];
}

function main() {
  const args = process.argv.slice(2);
  const source = valueAfter(args, '--source');
  const root = valueAfter(args, '--root') || process.cwd();
  if (!source) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  try {
    const result = args.includes('--apply')
      ? applyCareerEvidenceImport({ source, root })
      : planCareerEvidenceImport({ source, root });
    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const action = result.mode === 'apply' ? 'Imported' : 'Dry run found';
      console.log(`${action} ${result.summary.evidence} career facts, ${result.summary.marketSkills} market skills, ${result.summary.voiceReferences} voice references, ${result.summary.historyJobs} historical jobs, and ${result.summary.historyAnalyses} fit analyses.`);
      if (result.summary.conflicts) console.log(`Review required: ${result.summary.conflicts} imported source record(s) differ from the current canonical copy.`);
      if (result.mode === 'dry-run') console.log('No files were written. Add --apply after reviewing the JSON plan with --json.');
      else console.log(result.writes.length ? `Wrote: ${result.writes.join(', ')}` : 'No changes; the current import is already up to date.');
    }
  } catch (error) {
    console.error(`import-career-evidence: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
