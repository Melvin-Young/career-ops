import { canonStatus } from "./status-alias.mjs";

export type TrackedRoleKind = "Opportunity" | "Application";

const APPLICATION_STATES = new Set(["APPLIED", "RESPONDED", "INTERVIEW", "OFFER", "HIRED", "REJECTED"]);

/** Compatibility view over the existing tracker: no file-format migration is
 * required. A role remains an Opportunity through evaluation/skip/discard and
 * becomes an Application once its lifecycle proves submission or later. */
export function trackedRoleKind(status: string, lifecycleStatuses: string[] = []): TrackedRoleKind {
  const provesSubmission = [status, ...lifecycleStatuses].some((value) => APPLICATION_STATES.has(canonStatus(value)));
  return provesSubmission ? "Application" : "Opportunity";
}

export function splitTrackedRoles<T extends { status: string }>(
  rows: T[],
  lifecycleStatuses: (row: T) => string[] = () => [],
): { opportunities: T[]; applications: T[] } {
  return {
    opportunities: rows.filter((row) => trackedRoleKind(row.status, lifecycleStatuses(row)) === "Opportunity"),
    applications: rows.filter((row) => trackedRoleKind(row.status, lifecycleStatuses(row)) === "Application"),
  };
}
