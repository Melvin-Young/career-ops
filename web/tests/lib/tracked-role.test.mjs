import test from "node:test";
import assert from "node:assert/strict";
import { splitTrackedRoles, trackedRoleKind } from "../../src/lib/tracked-role.ts";

test("pre-submission states remain opportunities", () => {
  for (const status of ["", "Evaluated", "Discarded", "SKIP", "Unknown Future State"]) {
    assert.equal(trackedRoleKind(status), "Opportunity", status || "empty status");
  }
});

test("submission and later lifecycle states are applications", () => {
  for (const status of ["Applied", "Responded", "Interview", "Offer", "Hired", "Rejected", "Aplicado", "Sent", "Başvuruldu"]) {
    assert.equal(trackedRoleKind(status), "Application", status);
  }
});

test("a later discarded state does not erase proof that the role was submitted", () => {
  assert.equal(trackedRoleKind("Discarded", ["Evaluated", "Applied"]), "Application");
});

test("the compatibility view splits one tracker without migrating its rows", () => {
  const opportunity = { id: "1", status: "Evaluated" };
  const application = { id: "2", status: "Applied" };
  const withdrawn = { id: "3", status: "Discarded" };
  const result = splitTrackedRoles(
    [opportunity, application, withdrawn],
    (row) => row.id === "3" ? ["Applied", "Discarded"] : [],
  );

  assert.deepEqual(result.opportunities, [opportunity]);
  assert.deepEqual(result.applications, [application, withdrawn]);
});
