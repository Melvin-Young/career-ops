// In-process registry of persisting runs (evaluate / pdf) keyed by kind+input.
// A phone that backgrounds its tab drops the /api/run stream; the run keeps
// going on the Mac, and the natural next tap is "Try again" — which would start
// a second evaluation of the same job, reserve a second report number and
// write a second report. The registry lets the route answer that second start
// with 409 + the original start time instead. Plain .mjs so the unit test can
// import it directly (same pattern as run-cli-support.mjs).

export function inflightKey(kind, input) {
  return `${String(kind)}\n${String(input).trim()}`;
}

/**
 * Claim a run slot. Returns { ok: true, release } when free, or
 * { ok: false, startedAt } when the same kind+input is already running.
 * `release` is idempotent and only removes the claim it created.
 */
export function claimInflight(registry, kind, input, now = Date.now()) {
  const key = inflightKey(kind, input);
  const existing = registry.get(key);
  if (existing) return { ok: false, startedAt: existing.startedAt };
  const entry = { startedAt: now };
  registry.set(key, entry);
  let released = false;
  return {
    ok: true,
    release() {
      if (released) return;
      released = true;
      if (registry.get(key) === entry) registry.delete(key);
    },
  };
}

/** Human message for the 409 — the phone shows this verbatim. */
export function inflightMessage(startedAt, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - startedAt) / 60000));
  const since = mins === 0 ? "less than a minute ago" : mins === 1 ? "a minute ago" : `${mins} minutes ago`;
  return `This job is already being prepared on your Mac (started ${since}). It keeps running even if this page loses connection — refresh in a few minutes.`;
}
