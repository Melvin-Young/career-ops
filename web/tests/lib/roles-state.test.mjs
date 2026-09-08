import test from "node:test";
import assert from "node:assert/strict";
import { compareRoles, deriveRoleState, segmentsFor, stateLabel, matchesQuery } from "../../src/lib/roles/state.mjs";

test("a saved link with no tracker row is 'saved'", () => {
  assert.equal(deriveRoleState({}), "saved");
});

test("a report without approval is 'evaluated', with an approved resume it is 'packet'", () => {
  assert.equal(deriveRoleState({ trackerStatus: "Evaluated", hasReport: true }), "evaluated");
  assert.equal(deriveRoleState({ trackerStatus: "Evaluated", hasReport: true, approvedResume: true }), "packet");
});

test("tracker lifecycle states map through the shared alias table", () => {
  assert.equal(deriveRoleState({ trackerStatus: "Applied" }), "applied");
  assert.equal(deriveRoleState({ trackerStatus: "Aplicado" }), "applied");
  assert.equal(deriveRoleState({ trackerStatus: "Interview" }), "interview");
  assert.equal(deriveRoleState({ trackerStatus: "SKIP" }), "skip");
  assert.equal(deriveRoleState({ trackerStatus: "Hired" }), "hired");
});

test("an approved resume never upgrades a submitted role back to 'packet'", () => {
  assert.equal(deriveRoleState({ trackerStatus: "Applied", approvedResume: true }), "applied");
});

test("segments: to-do holds unsent work, applied holds submissions, all holds closed roles too", () => {
  assert.deepEqual(segmentsFor("saved"), ["todo", "all"]);
  assert.deepEqual(segmentsFor("packet"), ["todo", "all"]);
  assert.deepEqual(segmentsFor("applied"), ["applied", "all"]);
  assert.deepEqual(segmentsFor("rejected"), ["applied", "all"]);
  assert.deepEqual(segmentsFor("skip"), ["all"]);
});

test("ordering puts a ready packet before an evaluation before a bare link, newest first within a state", () => {
  const rows = [
    { state: "saved", date: "2026-09-01" },
    { state: "packet", date: "2026-08-01" },
    { state: "evaluated", date: "2026-09-05" },
    { state: "evaluated", date: "2026-09-07" },
  ].sort(compareRoles);
  assert.deepEqual(rows.map((r) => `${r.state}:${r.date}`), [
    "packet:2026-08-01",
    "evaluated:2026-09-07",
    "evaluated:2026-09-05",
    "saved:2026-09-01",
  ]);
});

test("state labels are words, and carry the facts they have", () => {
  assert.equal(stateLabel("saved"), "Saved");
  assert.equal(stateLabel("saved", { unverified: true }), "Saved, page not read");
  assert.equal(stateLabel("evaluated", { score: "4.2/5" }), "Evaluated, 4.2 of 5");
  assert.equal(stateLabel("applied", { date: "2026-09-08", platform: "Indeed" }), "Applied Sep 8 on Indeed");
  assert.equal(stateLabel("applied"), "Applied");
});

test("search matches company or title, case-insensitively", () => {
  const role = { company: "Acme", title: "Senior Platform Engineer" };
  assert.equal(matchesQuery(role, "acme"), true);
  assert.equal(matchesQuery(role, "platform"), true);
  assert.equal(matchesQuery(role, "globex"), false);
  assert.equal(matchesQuery(role, "  "), true);
});
