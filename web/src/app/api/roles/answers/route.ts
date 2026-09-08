import { NextResponse } from "next/server";
import { saveReviewedAnswers } from "@/lib/roles/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reviewed answers live in the report's canonical `## Application Answers`
// section (application-answers.mjs), the same record the apply mode writes.
export async function POST(req: Request) {
  let body: { n?: unknown; answers?: unknown };
  try {
    body = (await req.json()) as { n?: unknown; answers?: unknown };
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const n = typeof body.n === "string" ? body.n : "";
  const result = await saveReviewedAnswers(n, body.answers);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
