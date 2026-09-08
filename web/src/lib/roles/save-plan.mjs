// Decide what saving a URL means before anything is written: reuse the record
// that already exists, or add a new one. Pure, so the duplicate rules can be
// tested without a filesystem. Identity is the normalized URL, the same key
// scan.mjs and merge-tracker.mjs dedupe on; a different requisition at the same
// company is a different URL and stays distinct.
import { normalizeUrl } from "../core/url-key.mjs";
import { roleKeyForUrl } from "./identity.mjs";

/**
 * @typedef {Object} SavePlan
 * @property {string} key Normalized URL, '' when the input cannot be keyed.
 * @property {string|null} id Role id the desk will open: an existing tracker number, an existing inbox key, or the key a new save would get.
 * @property {"tracker"|"inbox"|null} existing Where the same posting already lives.
 * @property {{ company: string, title: string }|null} record The existing record's labels, for the "already saved" message.
 */

/**
 * @param {{ url: string, inbox: Array<{url:string, company:string, role:string}>, tracker: Array<{n:string, url:string, company:string, role:string}> }} input
 * @returns {SavePlan}
 */
export function planSave({ url, inbox = [], tracker = [] }) {
  const key = normalizeUrl(url);
  if (!key) return { key: "", id: null, existing: null, record: null };
  const row = tracker.find((r) => r.url && normalizeUrl(r.url) === key);
  if (row) return { key, id: row.n, existing: "tracker", record: { company: row.company, title: row.role } };
  const job = inbox.find((j) => normalizeUrl(j.url) === key);
  if (job) return { key, id: roleKeyForUrl(job.url), existing: "inbox", record: { company: job.company, title: job.role } };
  return { key, id: roleKeyForUrl(url), existing: null, record: null };
}

/** A URL the desk will accept: absolute http(s), nothing else. */
export function isSaveableUrl(value) {
  return typeof value === "string" && /^https?:\/\/[^\s]+$/i.test(value.trim()) && normalizeUrl(value.trim()) !== "";
}
