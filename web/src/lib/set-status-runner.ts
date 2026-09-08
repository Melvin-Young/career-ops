import { execFile } from "node:child_process";
import fs from "node:fs";
import { careerOpsRoot, rootScript } from "@/lib/career-ops";
import { parseCliJson, clientErrorMessage } from "@/lib/status-cli.mjs";

// One place that runs set-status.mjs, the canonical tracker status writer, so
// /api/status and the desk's "I applied" route cannot drift in how they map
// its exit codes. The HTTP contract (validate before spawning, map codes to
// statuses) is the caller's; this owns the child process.

const SET_STATUS_TIMEOUT_MS = 30_000;
const LOCK_WAIT_DEFAULT_MS = 10_000;
const LOCK_WAIT_CEILING_MS = SET_STATUS_TIMEOUT_MS - 5_000;

function boundedLockWait(): Record<string, string> {
  const raw = Number(process.env.CAREER_OPS_TRACKER_LOCK_TIMEOUT_MS);
  const requested = Number.isFinite(raw) && raw > 0 ? raw : LOCK_WAIT_DEFAULT_MS;
  return { CAREER_OPS_TRACKER_LOCK_TIMEOUT_MS: String(Math.min(requested, LOCK_WAIT_CEILING_MS)) };
}

// set-status.mjs exit codes (CLI_EXIT in tracker-utils.mjs) → HTTP. 4 means
// another writer holds the tracker lock: transient, retry.
const EXIT_TO_HTTP: Record<number, number> = { 2: 404, 3: 409, 4: 503 };
const CLIENT_ERROR_CODES = new Set(["usage", "invalid-state"]);

export type CliResult = { code: number; stdout: string; stderr: string; spawnFailed: boolean; timedOut: boolean };

export function setStatusScriptAvailable(): boolean {
  return fs.existsSync(rootScript("set-status"));
}

export function runSetStatus(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [rootScript("set-status"), ...args],
      { cwd: careerOpsRoot(), timeout: SET_STATUS_TIMEOUT_MS, env: { ...process.env, ...boundedLockWait() } },
      (err, stdout, stderr) => {
        const e = err as (NodeJS.ErrnoException & { killed?: boolean }) | null;
        const timedOut = e?.killed === true;
        const code = typeof e?.code === "number" ? e.code : e ? -1 : 0;
        resolve({ code, stdout: stdout || "", stderr: stderr || "", spawnFailed: !timedOut && code === -1, timedOut });
      },
    );
  });
}

export type SetStatusOutcome =
  | { ok: true; status: number; body: { ok: true; changed: boolean; statusLogged: boolean; raw: Record<string, unknown> } }
  | { ok: false; status: number; body: { error: string; code?: string }; headers?: Record<string, string> };

/** Map a finished child onto an HTTP-shaped outcome. Child stderr is logged, never echoed. */
export function interpretSetStatus(result: CliResult, label = "set-status.mjs"): SetStatusOutcome {
  const { code, stdout, stderr, spawnFailed, timedOut } = result;
  const parsed = parseCliJson(stdout);
  if (spawnFailed) {
    console.error(`${label}: failed to run: ${stderr.trim()}`);
    return { ok: false, status: 500, body: { error: "status update failed to run" } };
  }
  if (timedOut) {
    return {
      ok: false,
      status: 504,
      body: { error: "status update timed out; the change may or may not have been applied" },
      headers: { "Retry-After": "5" },
    };
  }
  if (code !== 0) {
    const cliCode = typeof parsed?.code === "string" ? parsed.code : undefined;
    const httpStatus = code === 1 ? (cliCode && CLIENT_ERROR_CODES.has(cliCode) ? 400 : 500) : (EXIT_TO_HTTP[code] ?? 500);
    if (!parsed && stderr.trim()) console.error(`${label}: exited ${code} without JSON: ${stderr.trim()}`);
    return {
      ok: false,
      status: httpStatus,
      body: { error: clientErrorMessage(parsed, stderr), ...(cliCode ? { code: cliCode } : {}) },
      ...(httpStatus === 503 ? { headers: { "Retry-After": "5" } } : {}),
    };
  }
  if (!parsed) return { ok: false, status: 500, body: { error: "status update returned no result" } };
  return { ok: true, status: 200, body: { ok: true, changed: parsed.changed === true, statusLogged: parsed.statusLogged === true, raw: parsed } };
}
