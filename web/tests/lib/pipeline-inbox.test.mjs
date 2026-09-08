import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePipelineInbox } from '../../src/lib/pipeline-inbox.mjs';

test('parses likely and verify labels without shifting positional columns', () => {
  const jobs = parsePipelineInbox([
    '- [ ] https://example.com/1 | Acme | Applied AI Engineer | Remote · US | $120K | posted: 2026-08-20 | lane: likely | reason: explicitly US-remote',
    '- [ ] https://example.com/2 | Beta | Solutions Engineer | Remote | lane: verify | reason: remote eligibility needs verification',
  ].join('\n'));
  assert.deepEqual(jobs[0], {
    done: false,
    url: 'https://example.com/1',
    company: 'Acme',
    role: 'Applied AI Engineer',
    location: 'Remote · US',
    compensation: '$120K',
    postedAt: '2026-08-20',
    discoveryLane: 'likely',
    discoveryReason: 'explicitly US-remote',
  });
  assert.equal(jobs[1].discoveryLane, 'verify');
});

test('legacy rows remain valid and unknown/excluded lane labels do not enter the inbox contract', () => {
  const [legacy, excluded] = parsePipelineInbox([
    '- [ ] https://example.com/1 | Acme | Engineer | Home City',
    '- [x] https://example.com/2 | Beta | Engineer | Remote | lane: excluded | reason: outside policy',
  ].join('\n'));
  assert.equal(legacy.discoveryLane, undefined);
  assert.equal(excluded.done, true);
  assert.equal(excluded.discoveryLane, undefined);
  assert.equal(excluded.discoveryReason, undefined);
});
