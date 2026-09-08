// Read what a posting page states about itself. Pure: takes HTML text, returns
// only fields the page actually carries. Anything absent is null, never a
// guess. Structured data (schema.org JobPosting) wins over Open Graph, which
// wins over the <title>.

const BOARD_HOSTS = ["linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com", "wellfound.com", "himalayas.app", "dice.com"];

/**
 * @typedef {Object} PostingMetadata
 * @property {string|null} title
 * @property {string|null} company
 * @property {string|null} location
 * @property {string|null} pay  Human text of the stated pay, e.g. "90000–100000 GBP per year".
 * @property {{min:number|null,max:number|null,currency:string|null}|null} salary Structured pay when the page states numbers.
 * @property {string|null} employerUrl  A link the page itself gives as the canonical or apply URL, when it differs from the source.
 * @property {"jsonld"|"og"|"title"|null} source  Which layer supplied the title.
 */

/**
 * @param {string} html
 * @param {string} url
 * @returns {PostingMetadata}
 */
export function extractPostingMetadata(html, url) {
  const text = String(html ?? "");
  const out = { title: null, company: null, location: null, pay: null, salary: null, employerUrl: null, source: null };
  const posting = findJobPosting(text);
  if (posting) {
    out.title = clean(posting.title) || null;
    out.company = clean(posting.hiringOrganization?.name ?? posting.hiringOrganization) || null;
    out.location = jobLocation(posting);
    const salary = baseSalary(posting.baseSalary);
    out.salary = salary;
    out.pay = salary ? payText(salary) : null;
    out.employerUrl = differentUrl(posting.url, url) ?? differentUrl(posting.applyUrl ?? posting.directApplyUrl, url);
    out.source = out.title ? "jsonld" : null;
  }
  if (!out.title) {
    const og = meta(text, "og:title");
    const parsed = og ? parseHeadline(og, url) : null;
    if (parsed) {
      out.title = out.title ?? parsed.title;
      out.company = out.company ?? parsed.company;
      out.location = out.location ?? parsed.location;
      out.source = "og";
    }
  }
  if (!out.title) {
    const t = titleTag(text);
    const parsed = t ? parseHeadline(t, url) : null;
    if (parsed) {
      out.title = parsed.title;
      out.company = out.company ?? parsed.company;
      out.location = out.location ?? parsed.location;
      out.source = "title";
    }
  }
  if (!out.company) {
    const site = meta(text, "og:site_name");
    if (site && !isBoard(site) && !isBoardHost(url)) out.company = clean(site);
  }
  if (!out.employerUrl) {
    const canonical = linkRel(text, "canonical");
    out.employerUrl = differentUrl(canonical, url);
  }
  return out;
}

/** True when the URL belongs to a discovery board rather than an employer. */
export function isBoardHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BOARD_HOSTS.some((b) => host === b || host.endsWith(`.${b}`));
  } catch {
    return false;
  }
}

function isBoard(name) {
  const n = String(name).toLowerCase();
  return BOARD_HOSTS.some((b) => n.includes(b.split(".")[0]));
}

function clean(value) {
  if (value == null) return "";
  return decodeEntities(String(value)).replace(/\s+/g, " ").trim();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function meta(html, property) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? clean(content) : null;
}

function linkRel(html, rel) {
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/href=["']([^"']*)["']/i)?.[1] ?? null;
}

function titleTag(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? clean(m[1]) : null;
}

function findJobPosting(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    let data;
    try {
      data = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    const found = walk(data);
    if (found) return found;
  }
  return null;
}

function walk(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = walk(item);
      if (hit) return hit;
    }
    return null;
  }
  const type = node["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return node;
  if (node["@graph"]) return walk(node["@graph"]);
  return null;
}

function jobLocation(posting) {
  const parts = [];
  const loc = Array.isArray(posting.jobLocation) ? posting.jobLocation[0] : posting.jobLocation;
  const addr = loc?.address ?? loc;
  if (addr && typeof addr === "object") {
    for (const key of ["addressLocality", "addressRegion", "addressCountry"]) {
      const v = clean(typeof addr[key] === "object" ? addr[key]?.name : addr[key]);
      if (v && !parts.includes(v)) parts.push(v);
    }
  } else if (typeof addr === "string") {
    parts.push(clean(addr));
  }
  const remote = String(posting.jobLocationType ?? "").toUpperCase().includes("TELECOMMUTE");
  if (remote) parts.unshift("Remote");
  return parts.length ? parts.join(", ") : null;
}

function baseSalary(salary) {
  if (!salary || typeof salary !== "object") return null;
  const currency = clean(salary.currency) || null;
  const value = salary.value && typeof salary.value === "object" ? salary.value : salary;
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const min = num(value.minValue) ?? num(value.value);
  const max = num(value.maxValue) ?? (num(value.minValue) ? null : num(value.value));
  if (!min && !max) return null;
  return { min, max, currency, unit: clean(value.unitText) || null };
}

function payText(salary) {
  const fmt = (n) => Number(n).toLocaleString("en-US");
  const range = salary.min && salary.max && salary.min !== salary.max ? `${fmt(salary.min)}–${fmt(salary.max)}` : fmt(salary.min ?? salary.max);
  const unit = salary.unit ? ` per ${salary.unit.toLowerCase()}` : "";
  return `${range}${salary.currency ? ` ${salary.currency}` : ""}${unit}`;
}

function differentUrl(candidate, source) {
  if (typeof candidate !== "string" || !/^https?:\/\//i.test(candidate)) return null;
  try {
    const a = new URL(candidate);
    const b = new URL(source);
    if (a.hostname === b.hostname && a.pathname === b.pathname) return null;
    return a.toString();
  } catch {
    return null;
  }
}

/**
 * Board headlines follow house patterns. Only the patterns we can name are
 * parsed; anything else becomes the title alone, with no company invented.
 * @param {string} headline
 * @param {string} url
 */
export function parseHeadline(headline, url) {
  const h = clean(headline);
  if (!h) return null;
  // LinkedIn: "Acme hiring Senior Engineer in Manchester, England | LinkedIn"
  const li = h.match(/^(.+?) hiring (.+?)(?: in (.+?))? \| LinkedIn$/i);
  if (li) return { company: li[1].trim(), title: li[2].trim(), location: li[3]?.trim() ?? null };
  // Indeed: "Senior Engineer - Manchester - Indeed.com"
  const indeed = h.match(/^(.+?) - (.+?) - Indeed(?:\.com)?$/i);
  if (indeed) return { company: null, title: indeed[1].trim(), location: indeed[2].trim() };
  // Greenhouse/Lever/Ashby style: "Job Application for Senior Engineer at Acme"
  const gh = h.match(/^Job Application for (.+?) at (.+)$/i);
  if (gh) return { company: gh[2].trim(), title: gh[1].trim(), location: null };
  const lever = h.match(/^(.+?) - (.+)$/);
  if (lever && !isBoardHost(url)) return { company: lever[1].trim(), title: lever[2].trim(), location: null };
  return { company: null, title: h.replace(/\s*[|–-]\s*(LinkedIn|Indeed(?:\.com)?|Glassdoor)$/i, "").trim(), location: null };
}
