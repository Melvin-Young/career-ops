// Stable identity for a role before and after it has a tracker row.
//
// A saved job lives in data/pipeline.md keyed only by its URL. Once it is
// evaluated it gains a tracker row number, which is the canonical id the CLI
// uses (set-status.mjs --row N, application-artifacts.mjs reportNum). The web
// needs one route for both, so a role id is either the tracker number or a
// short digest of the normalized posting URL. The digest is derived, never
// stored: the URL in pipeline.md stays the record of truth.
import { createHash } from "node:crypto";
import { normalizeUrl } from "../core/url-key.mjs";

const URL_KEY_RE = /^u-[0-9a-f]{12}$/;

/**
 * @param {string} url
 * @returns {string|null} `u-` + 12 hex chars, or null when the URL has no key.
 */
export function roleKeyForUrl(url) {
  const key = normalizeUrl(url);
  if (!key) return null;
  return `u-${createHash("sha1").update(key).digest("hex").slice(0, 12)}`;
}

/** @param {unknown} id */
export function isTrackerId(id) {
  return typeof id === "string" && /^\d+$/.test(id);
}

/** @param {unknown} id */
export function isUrlKey(id) {
  return typeof id === "string" && URL_KEY_RE.test(id);
}
