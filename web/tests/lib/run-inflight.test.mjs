import test from "node:test";
import assert from "node:assert/strict";
import { claimInflight, inflightKey, inflightMessage } from "../../src/lib/run-inflight.mjs";

test("a second claim for the same kind+input is refused with the first start time", () => {
  const reg = new Map();
  const a = claimInflight(reg, "evaluate", "https://x.test/j/1", 1000);
  assert.equal(a.ok, true);
  const b = claimInflight(reg, "evaluate", "https://x.test/j/1", 5000);
  assert.deepEqual(b, { ok: false, startedAt: 1000 });
});

test("different kinds or inputs do not collide; input is trimmed", () => {
  const reg = new Map();
  assert.equal(claimInflight(reg, "evaluate", "https://x.test/j/1").ok, true);
  assert.equal(claimInflight(reg, "pdf", "https://x.test/j/1").ok, true);
  assert.equal(claimInflight(reg, "evaluate", "https://x.test/j/2").ok, true);
  assert.equal(claimInflight(reg, "evaluate", "  https://x.test/j/1 ").ok, false);
  assert.equal(inflightKey("evaluate", " u "), "evaluate\nu");
});

test("release frees the slot, is idempotent, and never removes a newer claim", () => {
  const reg = new Map();
  const a = claimInflight(reg, "evaluate", "u");
  a.release();
  a.release();
  const b = claimInflight(reg, "evaluate", "u");
  assert.equal(b.ok, true);
  a.release(); // stale release must not evict b
  assert.equal(claimInflight(reg, "evaluate", "u").ok, false);
  b.release();
  assert.equal(claimInflight(reg, "evaluate", "u").ok, true);
});

test("the 409 message states elapsed time in plain words", () => {
  assert.match(inflightMessage(0, 20_000), /less than a minute ago/);
  assert.match(inflightMessage(0, 60_000), /a minute ago/);
  assert.match(inflightMessage(0, 3 * 60_000), /3 minutes ago/);
  assert.match(inflightMessage(0, 0), /keeps running even if this page loses connection/);
});
