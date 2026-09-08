import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendDiscoveryAudit, formatDiscoveryAuditRow, formatPipelineOffer } from '../scan.mjs';

const offer = {
  url: 'https://jobs.example.com/42',
  company: 'Acme',
  title: 'Applied AI Engineer',
  location: 'Remote · United States',
  source: 'fixture-api',
  postedAt: Date.parse('2026-08-20T00:00:00Z'),
  discoveryLane: 'likely',
  discoveryReason: 'specific target title · explicitly US-remote',
};
const decision = {
  lane: 'likely',
  reasons: ['specific-title', 'us-remote'],
  summary: 'specific target title · explicitly US-remote',
};

test('pipeline rows carry forward-compatible lane and reason labels', () => {
  assert.equal(
    formatPipelineOffer(offer),
    '- [ ] https://jobs.example.com/42 | Acme | Applied AI Engineer | Remote · United States | posted: 2026-08-20 | lane: likely | reason: specific target title · explicitly US-remote',
  );
});
test('discovery audit rows preserve classification evidence', () => {
  const cols = formatDiscoveryAuditRow({ offer, decision }, '2026-08-21T12:00:00.000Z').split('\t');
  assert.equal(cols.length, 10);
  assert.deepEqual(cols.slice(0, 8), [
    '2026-08-21T12:00:00.000Z',
    'https://jobs.example.com/42',
    'Acme',
    'Applied AI Engineer',
    'Remote · United States',
    'likely',
    'specific-title,us-remote',
    'specific target title · explicitly US-remote',
  ]);
});

test('audit writer creates one header and appends records without touching the pipeline', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-discovery-audit-'));
  const auditPath = path.join(dir, 'data', 'discovery-audit.tsv');
  try {
    await appendDiscoveryAudit([{ offer, decision }], '2026-08-21T12:00:00.000Z', auditPath);
    await appendDiscoveryAudit([{ offer: { ...offer, url: 'https://jobs.example.com/43' }, decision }], '2026-08-21T13:00:00.000Z', auditPath);
    const lines = fs.readFileSync(auditPath, 'utf8').trim().split('\n');
    assert.equal(lines.length, 3);
    assert.match(lines[0], /^run_at\turl\tcompany\ttitle\tlocation\tlane\treasons\tsummary\tsource\tposted_at$/);
    assert.match(lines[1], /\tlikely\tspecific-title,us-remote\t/);
    assert.match(lines[2], /jobs\.example\.com\/43/);
    assert.equal(fs.existsSync(path.join(dir, 'data', 'pipeline.md')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
