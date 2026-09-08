import test from "node:test";
import assert from "node:assert/strict";
import { composeArtifactDraft } from "../../src/lib/artifact-draft.ts";

const app = {
  n: "7", date: "", company: "Acme", via: "", role: "Platform Engineer",
  score: "", status: "Evaluated", pdf: "", report: "", notes: "",
};

test("concise cover letters stay in the 70-120 word band and use only supplied claims", () => {
  const approvedClaim = "Reduced measured dashboard latency by sixty-four percent.";
  const draft = composeArtifactDraft("cover-letter", {
    app,
    report: "platform latency",
    evidence: [{ id: "approved-1", label: "Demonstrated", claim: approvedClaim, approval: "approved", outwardEligible: true, source: { path: "profile.md" } }],
    cv: "",
    fullName: "Verified Candidate",
  }, false);
  const words = draft.content.trim().split(/\s+/).length;
  assert.ok(words >= 70 && words <= 120, `${words} words`);
  assert.match(draft.content, new RegExp(approvedClaim.replace(".", "\\.")));
  assert.match(draft.content, /Verified Candidate/);
  assert.deepEqual(draft.provenance, ["approved-1"]);
});

test("an empty evidence set creates no fallback accomplishment or personal identity", () => {
  const draft = composeArtifactDraft("cover-letter", { app, report: "", evidence: [], cv: "", fullName: "" }, false);
  assert.doesNotMatch(draft.content, /led ambiguous|technical leadership/i);
  assert.match(draft.content, /\nBest,\s*$/);
  assert.deepEqual(draft.provenance, []);
});
