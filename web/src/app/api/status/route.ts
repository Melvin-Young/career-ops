import { NextResponse } from "next/server";
import { canonicalizeStatus } from "@/lib/core/states";
import { trackerRowArg } from "@/lib/status-cli.mjs";
import { interpretSetStatus, runSetStatus, setStatusScriptAvailable } from "@/lib/set-status-runner";

export const runtime = "nodejs"; // delegates to the core CLI via child_process

// Writeback: UPDATE the status cell of an EXISTING tracker row only. Never adds
// rows — per the core data contract, new rows go through the TSV + merge flow.
//
// Delegates to set-status.mjs, the path every other writer already uses: it
// holds the shared tracker lock across the whole read-modify-write, validates
// the state against templates/states.yml, and appends the transition ledger
// (#2900). `--source web` keeps rows written from here distinguishable.
//
// What stays here is the HTTP contract: reject a bad request before spawning
// anything. The exit-code mapping lives in set-status-runner.ts, shared with
// the desk's "I applied" route.

export async function POST(req: Request) {
  let body: { n?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { n, status } = body;
  if (!n || typeof status !== "string" || !status.trim()) {
    return NextResponse.json({ error: "n and status required" }, { status: 400 });
  }
  if (/[|\r\n*]/.test(status)) {
    return NextResponse.json({ error: "invalid status (table-breaking characters)" }, { status: 400 });
  }
  const canon = canonicalizeStatus(status);
  if (!canon) {
    return NextResponse.json({ error: `not a canonical status: ${status}` }, { status: 400 });
  }
  const row = trackerRowArg(n);
  if (!row) {
    return NextResponse.json({ error: "n must be a tracker row number" }, { status: 400 });
  }
  if (!setStatusScriptAvailable()) {
    return NextResponse.json(
      { error: "status updates need the career-ops scripts; this root has data only", code: "core-script-missing" },
      { status: 503 },
    );
  }

  const outcome = interpretSetStatus(await runSetStatus(["--row", row, canon, "--source", "web", "--json"]), "/api/status: set-status.mjs");
  if (!outcome.ok) return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.headers });
  return NextResponse.json({ ok: true, status: canon, changed: outcome.body.changed, statusLogged: outcome.body.statusLogged });
}
