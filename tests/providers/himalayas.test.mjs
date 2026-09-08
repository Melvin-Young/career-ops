// tests/providers/himalayas.test.mjs — moved verbatim from test-all.mjs (#1440).
import { pass, fail, ROOT } from '../helpers.mjs';
import { join } from 'path';
import { pathToFileURL } from 'url';

console.log('\nProvider — himalayas');

try {
  const himalayasModule = await import(pathToFileURL(join(ROOT, 'providers/himalayas.mjs')).href);
  const himalayas = himalayasModule.default;
  const { parseHimalayasResponse } = himalayasModule;

  if (himalayas.id === 'himalayas') pass('himalayas.id is "himalayas"');
  else fail(`himalayas.id is ${JSON.stringify(himalayas.id)}`);

  const hit = himalayas.detect({ name: 'Himalayas', provider: 'himalayas' });
  if (hit && hit.url === 'https://himalayas.app/jobs/api?limit=20') {
    pass('himalayas.detect() claims explicit provider config');
  } else {
    fail(`himalayas.detect() returned ${JSON.stringify(hit)}`);
  }

  if (himalayas.detect({ name: 'Remote Board', provider: 'remotive' }) === null) {
    pass('himalayas.detect() ignores other provider ids');
  } else {
    fail('himalayas.detect() should only claim provider: himalayas');
  }

  const sample = {
    jobs: [
      {
        title: '  Staff AI Engineer  ',
        companyName: ' Acme Labs ',
        companySlug: 'acme-labs',
        locationRestrictions: [
          { name: 'Worldwide', alpha2: '', slug: 'worldwide' },
          { name: 'Europe', alpha2: '', slug: 'europe' },
        ],
        pubDate: 1782538666,
        applicationLink: 'https://himalayas.app/companies/acme-labs/jobs/staff-ai-engineer',
        guid: 'https://himalayas.app/companies/acme-labs/jobs/staff-ai-engineer-guid',
      },
      {
        title: 'Product Manager',
        companyName: 'Fallback Co',
        companySlug: 'fallback-co',
        locationRestrictions: [],
        pubDate: '2026-01-02T09:00:00Z',
        applicationLink: '',
        guid: 'https://himalayas.app/companies/fallback-co/jobs/product-manager',
      },
      {
        title: 'Missing Link Role',
        companyName: 'Dropped Co',
        locationRestrictions: ['United States'],
      },
      {
        title: 'Off Host Role',
        companyName: 'Bad Co',
        locationRestrictions: ['Remote'],
        applicationLink: 'https://example.com/companies/bad/jobs/off-host',
      },
      {
        title: 'HTTP Role',
        companyName: 'Bad Scheme Co',
        locationRestrictions: ['Remote'],
        applicationLink: 'http://himalayas.app/companies/bad/jobs/http-role',
      },
      {
        title: '   ',
        companyName: 'Blank Title Co',
        locationRestrictions: ['Remote'],
        applicationLink: 'https://himalayas.app/companies/blank/jobs/blank-title',
      },
    ],
  };
  const jobs = parseHimalayasResponse(sample);

  if (jobs.length === 2) pass('parseHimalayasResponse keeps 2 jobs (drops missing/off-host/http/blank-title rows)');
  else fail(`parseHimalayasResponse returned ${jobs.length} jobs (expected 2)`);

  if (jobs[0]?.title === 'Staff AI Engineer' && jobs[0]?.company === 'Acme Labs') {
    pass('parseHimalayasResponse trims title and companyName');
  } else {
    fail(`row 0 title/company = ${JSON.stringify({ title: jobs[0]?.title, company: jobs[0]?.company })}`);
  }

  if (jobs[0]?.location === 'Worldwide, Europe') {
    pass('parseHimalayasResponse joins locationRestrictions');
  } else {
    fail(`row 0 location = ${JSON.stringify(jobs[0]?.location)}`);
  }

  if (jobs[0]?.url === 'https://himalayas.app/companies/acme-labs/jobs/staff-ai-engineer') {
    pass('parseHimalayasResponse maps applicationLink to url');
  } else {
    fail(`row 0 url = ${JSON.stringify(jobs[0]?.url)}`);
  }

  if (jobs[0]?.postedAt === 1782538666 * 1000) {
    pass('parseHimalayasResponse converts epoch seconds pubDate -> postedAt ms');
  } else {
    fail(`row 0 postedAt = ${JSON.stringify(jobs[0]?.postedAt)}`);
  }

  if (jobs[1]?.url === 'https://himalayas.app/companies/fallback-co/jobs/product-manager') {
    pass('parseHimalayasResponse falls back to guid when applicationLink is missing');
  } else {
    fail(`row 1 url = ${JSON.stringify(jobs[1]?.url)}`);
  }

  if (jobs[1]?.postedAt === Date.parse('2026-01-02T09:00:00Z')) {
    pass('parseHimalayasResponse parses string pubDate -> postedAt');
  } else {
    fail(`row 1 postedAt = ${JSON.stringify(jobs[1]?.postedAt)}`);
  }

  if (parseHimalayasResponse({}).length === 0 && parseHimalayasResponse(null).length === 0) {
    pass('parseHimalayasResponse empty / non-object payload -> empty result (no crash)');
  } else {
    fail('parseHimalayasResponse invalid payload should yield empty result');
  }

  const pageOne = {
    jobs: [sample.jobs[0]],
    nextCursor: 'opaque/page-2?x=1',
  };
  const pageTwo = {
    jobs: [sample.jobs[1]],
  };
  const captured = [];
  const pageSleepCalls = [];
  const fetched = await himalayas.fetch(
    { name: 'Himalayas', provider: 'himalayas' },
    {
      fetchJson: async (url, opts) => {
        captured.push({ url, opts });
        return captured.length === 1 ? pageOne : pageTwo;
      },
      sleep: async (ms) => { pageSleepCalls.push(ms); },
    },
  );

  if (captured.length === 2 && captured[0].url === 'https://himalayas.app/jobs/api?limit=20') {
    pass('himalayas.fetch() requests the first pinned API page');
  } else {
    fail(`himalayas.fetch() requested pages ${JSON.stringify(captured.map(hit => hit.url))}`);
  }

  if (captured[1]?.url === 'https://himalayas.app/jobs/api?limit=20&cursor=opaque%2Fpage-2%3Fx%3D1') {
    pass('himalayas.fetch() URL-encodes nextCursor and requests the next page');
  } else {
    fail(`himalayas.fetch() requested cursor page ${JSON.stringify(captured[1]?.url)}`);
  }

  if (captured.every(hit => hit.opts?.redirect === 'error')) {
    pass('himalayas.fetch() passes redirect:"error" to every page request');
  } else {
    fail(`himalayas.fetch() should pass redirect:"error" to every request, got: ${JSON.stringify(captured.map(hit => hit.opts))}`);
  }

  if (pageSleepCalls.length === 1 && pageSleepCalls[0] === 500) {
    pass('himalayas.fetch() paces successive cursor pages');
  } else {
    fail(`himalayas.fetch() page pacing = ${JSON.stringify(pageSleepCalls)} (expected [500])`);
  }

  if (fetched[0]?.company === 'Acme Labs' && fetched[0]?.title === 'Staff AI Engineer') {
    pass('provider: himalayas config returns normalized jobs');
  } else {
    fail(`himalayas.fetch() normalized row = ${JSON.stringify(fetched[0])}`);
  }

  let retryAttempts = 0;
  const retrySleepCalls = [];
  const recovered = await himalayas.fetch(
    { name: 'Himalayas', provider: 'himalayas' },
    {
      fetchJson: async () => {
        retryAttempts++;
        if (retryAttempts === 1) {
          const err = new Error('HTTP 429 Too Many Requests');
          err.status = 429;
          err.retryAfter = '3';
          throw err;
        }
        return { jobs: [sample.jobs[1]] };
      },
      sleep: async (ms) => { retrySleepCalls.push(ms); },
    },
  );

  if (retryAttempts === 2 && recovered.length === 1) {
    pass('himalayas.fetch() retries a 429 and recovers');
  } else {
    fail(`himalayas.fetch() 429 recovery attempts/jobs = ${retryAttempts}/${recovered.length}`);
  }

  if (retrySleepCalls.length === 1 && retrySleepCalls[0] === 3000) {
    pass('himalayas.fetch() honors Retry-After for 429 backoff');
  } else {
    fail(`himalayas.fetch() Retry-After delay = ${JSON.stringify(retrySleepCalls)} (expected [3000])`);
  }

  let boundedAttempts = 0;
  const boundedSleepCalls = [];
  let boundedError = null;
  try {
    await himalayas.fetch(
      { name: 'Himalayas', provider: 'himalayas' },
      {
        fetchJson: async () => {
          boundedAttempts++;
          const err = new Error('HTTP 429 Too Many Requests');
          err.status = 429;
          throw err;
        },
        sleep: async (ms) => { boundedSleepCalls.push(ms); },
      },
    );
  } catch (err) {
    boundedError = err;
  }

  if (boundedAttempts === 3 && boundedSleepCalls.length === 2 && boundedError?.status === 429) {
    pass('himalayas.fetch() bounds persistent 429 retries to 3 total attempts');
  } else {
    fail(`himalayas.fetch() bounded retry result = ${JSON.stringify({ boundedAttempts, boundedSleepCalls, status: boundedError?.status })}`);
  }

  let badRequestAttempts = 0;
  try {
    await himalayas.fetch(
      { name: 'Himalayas', provider: 'himalayas' },
      {
        fetchJson: async () => {
          badRequestAttempts++;
          const err = new Error('HTTP 400 Bad Request');
          err.status = 400;
          throw err;
        },
        sleep: async () => {},
      },
    );
  } catch {}

  if (badRequestAttempts === 1) pass('himalayas.fetch() does not retry non-429 failures');
  else fail(`himalayas.fetch() retried HTTP 400 ${badRequestAttempts} times`);
} catch (e) {
  fail(`himalayas provider tests crashed: ${e.message}`);
}
