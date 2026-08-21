/**
 * Deterministic discovery classification.
 *
 * Interface: buildDiscoveryClassifier(config) returns a pure function mapping a
 * normalized scanner offer to { lane, reasons, summary }. The scanner and tests
 * cross this same seam; no filesystem or network knowledge lives here.
 */

export const DISCOVERY_LANES = Object.freeze({
  LIKELY: 'likely',
  VERIFY: 'verify',
  EXCLUDED: 'excluded',
});

const REASON_LABELS = Object.freeze({
  'specific-title': 'specific target title',
  'broad-title-ai-context': 'broad title with AI context',
  'broad-title-ai-company': 'broad title at an AI-focused company',
  'broad-title-no-signal': 'broad title without an AI signal',
  'local-location': 'within the configured local search area',
  'us-remote': 'explicitly US-remote',
  'multi-region-remote': 'remote with both US and non-US regions',
  'remote-country-unclear': 'remote eligibility needs verification',
  'foreign-only': 'explicitly outside the US',
  'onsite-outside-local': 'on-site or hybrid outside the configured local search area',
  'us-location-remote-unclear': 'US location but remote status is unclear',
  'missing-location': 'location metadata is missing',
  'ambiguous-location': 'location needs verification',
});

const US_STATE_NAMES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
  'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
  'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
  'new hampshire', 'new jersey', 'new mexico', 'new york',
  'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
  'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
  'west virginia', 'wisconsin', 'wyoming', 'district of columbia',
];

const US_STATE_ABBREVIATIONS = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY', 'DC',
]);

function strings(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean);
}

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phraseMatcher(values) {
  const regexes = strings(values).map((value) => {
    const escaped = escapeRe(value);
    const startsWord = /[a-z0-9]/i.test(value[0]);
    const endsWord = /[a-z0-9]/i.test(value[value.length - 1]);
    return new RegExp(`${startsWord ? '(?<![a-z0-9])' : ''}${escaped}${endsWord ? '(?![a-z0-9])' : ''}`, 'i');
  });
  return (text) => regexes.some(re => re.test(String(text ?? '')));
}

function titleMatcher(values) {
  const matchers = strings(values).map((value) => {
    const terms = value.split(/\s+\+\s+/).map(v => v.trim()).filter(Boolean);
    const compiled = terms.map(term => phraseMatcher([term]));
    return (text) => compiled.every(match => match(text));
  });
  return (text) => matchers.some(match => match(text));
}

function hasUsSubdivision(location) {
  const text = String(location ?? '');
  if (US_STATE_NAMES.some(name => phraseMatcher([name])(text))) return true;
  const tokens = text.match(/\b[A-Z]{2}\b/g) || [];
  return tokens.some(token => US_STATE_ABBREVIATIONS.has(token));
}

function mergeLane(a, b) {
  if (a === DISCOVERY_LANES.EXCLUDED || b === DISCOVERY_LANES.EXCLUDED) return DISCOVERY_LANES.EXCLUDED;
  if (a === DISCOVERY_LANES.VERIFY || b === DISCOVERY_LANES.VERIFY) return DISCOVERY_LANES.VERIFY;
  return DISCOVERY_LANES.LIKELY;
}

function summarize(reasons) {
  return reasons.map(reason => REASON_LABELS[reason] || reason).join(' · ');
}

/**
 * Compile one personal discovery policy.
 *
 * Config keys:
 * - broad_title_keywords: broad titles requiring AI context or an allowlisted company
 * - ai_context_keywords: title terms that make a broad title specific enough
 * - ai_focused_companies: companies where a broad title remains worth verifying
 * - local_location_keywords: accepted commuting-area names
 * - eligible_country_keywords: country/region markers (US subdivisions are built in)
 * - foreign_location_keywords: explicit non-eligible countries/regions/cities
 * - onsite_keywords: binding non-remote work-arrangement markers
 */
export function buildDiscoveryClassifier(config = {}) {
  const enabled = config?.enabled === true;
  const broadTitle = titleMatcher(config?.broad_title_keywords);
  const aiContext = titleMatcher(config?.ai_context_keywords);
  const aiCompany = phraseMatcher(config?.ai_focused_companies);
  const localLocation = phraseMatcher(config?.local_location_keywords);
  const eligibleCountry = phraseMatcher(config?.eligible_country_keywords);
  const foreignLocation = phraseMatcher(config?.foreign_location_keywords);
  const onsite = phraseMatcher(config?.onsite_keywords);
  const remote = phraseMatcher(['remote']);

  const classify = (offer = {}) => {
    const title = String(offer.title ?? '');
    const company = String(offer.company ?? '');
    const location = String(offer.location ?? '').trim();

    let titleLane = DISCOVERY_LANES.LIKELY;
    let titleReason = 'specific-title';
    if (broadTitle(title)) {
      if (aiContext(title)) {
        titleReason = 'broad-title-ai-context';
      } else if (aiCompany(company)) {
        titleLane = DISCOVERY_LANES.VERIFY;
        titleReason = 'broad-title-ai-company';
      } else {
        titleLane = DISCOVERY_LANES.EXCLUDED;
        titleReason = 'broad-title-no-signal';
      }
    }

    const local = localLocation(location);
    const remoteMarked = remote(`${title} ${location}`);
    const us = eligibleCountry(`${title} ${location}`) || hasUsSubdivision(location);
    const foreign = foreignLocation(`${title} ${location}`);
    const onsiteMarked = onsite(`${title} ${location}`);

    let locationLane;
    let locationReason;
    if (local) {
      locationLane = DISCOVERY_LANES.LIKELY;
      locationReason = 'local-location';
    } else if (!location) {
      locationLane = DISCOVERY_LANES.VERIFY;
      locationReason = 'missing-location';
    } else if (remoteMarked && us && foreign) {
      locationLane = DISCOVERY_LANES.VERIFY;
      locationReason = 'multi-region-remote';
    } else if (remoteMarked && us) {
      locationLane = DISCOVERY_LANES.LIKELY;
      locationReason = 'us-remote';
    } else if (remoteMarked && foreign) {
      locationLane = DISCOVERY_LANES.EXCLUDED;
      locationReason = 'foreign-only';
    } else if (remoteMarked) {
      locationLane = DISCOVERY_LANES.VERIFY;
      locationReason = 'remote-country-unclear';
    } else if (onsiteMarked && !local) {
      locationLane = DISCOVERY_LANES.EXCLUDED;
      locationReason = 'onsite-outside-local';
    } else if (us && foreign) {
      locationLane = DISCOVERY_LANES.VERIFY;
      locationReason = 'ambiguous-location';
    } else if (us) {
      locationLane = DISCOVERY_LANES.VERIFY;
      locationReason = 'us-location-remote-unclear';
    } else if (foreign) {
      locationLane = DISCOVERY_LANES.EXCLUDED;
      locationReason = 'foreign-only';
    } else {
      locationLane = DISCOVERY_LANES.VERIFY;
      locationReason = 'ambiguous-location';
    }

    const reasons = [titleReason, locationReason];
    return { lane: mergeLane(titleLane, locationLane), reasons, summary: summarize(reasons) };
  };

  return { enabled, classify };
}
