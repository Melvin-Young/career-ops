// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Himalayas provider - board-wide remote jobs API
// (https://himalayas.app/docs/remote-jobs-api). Returns paginated { jobs: [],
// nextCursor? } responses. The full feed is fetched so scan.mjs's
// title_filter / location_filter can do the local gating consistently with
// other zero-token board providers.
//
// Wire in via a `job_boards:` entry with `provider: himalayas`.

const FEED_BASE_URL = 'https://himalayas.app/jobs/api';
const FEED_LIMIT = '20';
const TRUSTED_HOST = 'himalayas.app';

// Himalayas caps pages at 20 jobs and rate-limits the public endpoint. Pace
// cursor requests so a full-board scan does not arrive as an immediate burst,
// and retry only explicit 429s. The retry budget and Retry-After clamp keep a
// degraded source from stalling the whole multi-source scan indefinitely.
const INTER_PAGE_DELAY_MS = 500;
const MAX_429_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 5_000;
const RETRY_AFTER_MAX_MS = 30_000;

/** @param {string | undefined} cursor */
function feedUrl(cursor) {
  const url = new URL(FEED_BASE_URL);
  url.searchParams.set('limit', FEED_LIMIT);
  if (cursor) url.searchParams.set('cursor', cursor);
  return assertHimalayasUrl(url.href);
}

/** @param {string} url */
function assertHimalayasUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`himalayas: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`himalayas: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`himalayas: untrusted hostname "${parsed.hostname}" - must be ${TRUSTED_HOST}`);
  }
  return url;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sleep(ms, ctx) {
  if (typeof ctx?.sleep === 'function') return ctx.sleep(ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

async function fetchPage(ctx, url) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ctx.fetchJson(url, { redirect: 'error' });
    } catch (err) {
      if (err?.status !== 429 || attempt >= MAX_429_RETRIES) throw err;
      const serverDelay = retryAfterMs(err?.retryAfter);
      const fallbackDelay = RETRY_BASE_DELAY_MS * 2 ** attempt;
      await sleep(
        serverDelay === null ? fallbackDelay : Math.min(serverDelay, RETRY_AFTER_MAX_MS),
        ctx,
      );
    }
  }
}

function cleanHimalayasUrl(value) {
  const raw = cleanText(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const trusted = host === TRUSTED_HOST || host.endsWith(`.${TRUSTED_HOST}`);
    return parsed.protocol === 'https:' && trusted ? parsed.href : '';
  } catch {
    return '';
  }
}

function locationText(value) {
  if (!Array.isArray(value)) return '';
  return value
    .map((value) => {
      if (typeof value === 'string') return value.trim();
      if (!value || typeof value !== 'object') return '';
      // Current responses use objects such as { name, alpha2, slug }; retain
      // compatibility with the older string-only shape and prefer the human
      // readable name when it is present.
      return cleanText(value.name) || cleanText(value.slug) || cleanText(value.alpha2);
    })
    .filter(Boolean)
    .join(', ');
}

// Himalayas pubDate is currently epoch seconds. Accept milliseconds and
// parseable date strings too so the parser survives small API shape changes.
function toEpochMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/** @type {Provider} */
export default {
  id: 'himalayas',

  detect(entry) {
    return entry?.provider === 'himalayas' ? { url: feedUrl() } : null;
  },

  /**
   * Fetches and normalizes postings from the Himalayas public feed.
   * @param {{ provider?: string }} entry - The job_boards entry being processed.
   * @param {{ fetchJson: (url: string, opts?: { redirect?: 'error'|'follow'|'manual' }) => Promise<any>, sleep?: (ms: number) => Promise<void> }} ctx - HTTP context.
   * @returns {Promise<Array<{title: string, url: string, company: string, location: string, postedAt?: number}>>}
   */
  async fetch(entry, ctx) {
    // redirect:'error' prevents SSRF via server-side redirects; combined with
    // assertHimalayasUrl above it keeps every request pinned to himalayas.app.
    const jobs = [];
    let cursor;

    do {
      if (cursor) await sleep(INTER_PAGE_DELAY_MS, ctx);
      const json = await fetchPage(ctx, feedUrl(cursor));
      if (!json || !Array.isArray(json.jobs)) {
        throw new Error(`himalayas: unexpected API response - expected { jobs: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`);
      }
      jobs.push(...parseHimalayasResponse(json));
      cursor = cleanText(json.nextCursor) || undefined;
    } while (cursor);

    return jobs;
  },
};

/**
 * Parse Himalayas' public jobs API response. Exported for unit tests.
 *
 * Shape: `{ jobs: [...] }`, where each job currently carries `title`,
 * `companyName`, `locationRestrictions`, `applicationLink`, `guid`,
 * `pubDate`, and `companySlug`. `applicationLink` is preferred over `guid`
 * and used as the dedup key after HTTPS + host validation.
 *
 * @param {unknown} json - raw parsed API response
 * @returns {Array<{title: string, url: string, company: string, location: string, postedAt?: number}>}
 */
export function parseHimalayasResponse(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.jobs)) return [];

  const jobs = [];
  for (const item of json.jobs) {
    if (!item || typeof item !== 'object') continue;

    const title = cleanText(item.title);
    if (!title) continue;

    const url = cleanHimalayasUrl(item.applicationLink) || cleanHimalayasUrl(item.guid);
    if (!url) continue;

    jobs.push({
      title,
      url,
      company: cleanText(item.companyName),
      location: locationText(item.locationRestrictions),
      postedAt: toEpochMs(item.pubDate),
    });
  }

  return jobs;
}
