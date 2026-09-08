import { NextResponse } from "next/server";
import { commitSave, previewSave } from "@/lib/roles/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Two phases behind one route. `confirm: false` (default) reads the page and
// returns what it states, or the record that already exists — nothing is
// written. `confirm: true` writes through the core's pipeline writers; saving
// the same link twice returns the existing record instead of a second row.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (body.confirm !== true) {
    const preview = await previewSave(body.url);
    return NextResponse.json(preview, { status: preview.ok ? 200 : 400 });
  }
  const result = await commitSave({ ...body, url: body.url });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
