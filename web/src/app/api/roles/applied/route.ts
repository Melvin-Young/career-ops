import { NextResponse } from "next/server";
import { recordApplied } from "@/lib/roles/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

// The only path that marks a role Applied from the desk. Requires the explicit
// confirmation payload (role id, date, platform); opening a link or downloading
// a PDF never reaches here. Idempotent: a repeat call for a row that is already
// Applied is a no-op in set-status.mjs and adds no second ledger line.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const result = await recordApplied({ id: body.id, date: body.date, platform: body.platform });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
