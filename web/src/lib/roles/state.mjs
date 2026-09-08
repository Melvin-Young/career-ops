// Pure derivations for the desk list and the packet header: which state a
// role is in, which segment it belongs to, and how the state is written out.
// No filesystem here so node --test can exercise every branch.
import { canonStatus } from "../status-alias.mjs";

/** @typedef {"saved"|"evaluated"|"packet"|"applied"|"responded"|"interview"|"offer"|"hired"|"rejected"|"discarded"|"skip"} RoleState */

const TRACKER_STATES = {
  APPLIED: "applied",
  RESPONDED: "responded",
  INTERVIEW: "interview",
  OFFER: "offer",
  HIRED: "hired",
  REJECTED: "rejected",
  DISCARDED: "discarded",
  SKIP: "skip",
};

const SUBMITTED = new Set(["applied", "responded", "interview", "offer", "hired", "rejected"]);
const CLOSED = new Set(["discarded", "skip"]);

/**
 * @param {{ trackerStatus?: string|null, hasReport?: boolean, approvedResume?: boolean, lifecycle?: string[] }} input
 * @returns {RoleState}
 */
export function deriveRoleState({ trackerStatus = null, hasReport = false, approvedResume = false, lifecycle = [] } = {}) {
  if (trackerStatus) {
    const canon = canonStatus(trackerStatus);
    for (const [token, state] of Object.entries(TRACKER_STATES)) {
      if (canon.includes(token)) {
        // A role discarded after submission still proves a submission happened.
        if (CLOSED.has(state) && lifecycle.some((s) => SUBMITTED.has(deriveRoleState({ trackerStatus: s })))) return state;
        return state;
      }
    }
    // Evaluated, or a state this app has never seen: still a tracked opportunity.
    if (approvedResume) return "packet";
    return "evaluated";
  }
  if (hasReport) return approvedResume ? "packet" : "evaluated";
  return "saved";
}

/** @param {RoleState} state */
export function isSubmitted(state) {
  return SUBMITTED.has(state);
}

/** @param {RoleState} state */
export function isClosed(state) {
  return CLOSED.has(state);
}

/** @typedef {"todo"|"applied"|"all"} Segment */

/**
 * The default view emphasises roles that need the user: saved, evaluated and
 * packet-ready. Submitted roles have their own segment; closed ones only
 * appear under All.
 * @param {RoleState} state
 * @returns {Segment[]}
 */
export function segmentsFor(state) {
  if (isSubmitted(state)) return ["applied", "all"];
  if (isClosed(state)) return ["all"];
  return ["todo", "all"];
}

const ORDER = ["packet", "evaluated", "saved", "offer", "interview", "responded", "applied", "hired", "rejected", "discarded", "skip"];

/**
 * Actionable first: a packet that is ready outranks a role still to evaluate,
 * which outranks a bare link. Ties fall back to the newest date.
 * @param {{ state: RoleState, date?: string|null }} a
 * @param {{ state: RoleState, date?: string|null }} b
 */
export function compareRoles(a, b) {
  const ra = ORDER.indexOf(a.state);
  const rb = ORDER.indexOf(b.state);
  if (ra !== rb) return ra - rb;
  return String(b.date ?? "").localeCompare(String(a.date ?? ""));
}

/**
 * The state as a sentence fragment, never a color alone.
 * @param {RoleState} state
 * @param {{ score?: string|null, unverified?: boolean, date?: string|null, platform?: string|null }} detail
 */
export function stateLabel(state, { score = null, unverified = false, date = null, platform = null } = {}) {
  const when = date ? ` ${shortDate(date)}` : "";
  switch (state) {
    case "saved":
      return unverified ? "Saved, page not read" : "Saved";
    case "evaluated":
      return score ? `Evaluated, ${score.replace(/\/5$/, " of 5")}` : "Evaluated";
    case "packet":
      return "Packet ready";
    case "applied":
      return `Applied${when}${platform ? ` on ${platform}` : ""}`;
    case "responded":
      return `Company replied${when}`;
    case "interview":
      return "Interviewing";
    case "offer":
      return "Offer received";
    case "hired":
      return "Hired";
    case "rejected":
      return "Rejected";
    case "discarded":
      return "Closed";
    case "skip":
      return "Skipped";
    default:
      return state;
  }
}

/** `2026-09-08` → `Sep 8`. Anything else passes through unchanged. */
export function shortDate(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso ?? "");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}`;
}

/**
 * Search matches company or title, case-insensitively, on whole substrings.
 * @param {{ company: string, title: string }} role
 * @param {string} query
 */
export function matchesQuery(role, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return true;
  return `${role.company} ${role.title}`.toLowerCase().includes(q);
}
