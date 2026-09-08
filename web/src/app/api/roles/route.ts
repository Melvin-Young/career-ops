import { NextResponse } from "next/server";
import { listRoles } from "@/lib/roles/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The desk list: tracker rows and saved links, one record each, with the
// derived state written out. Read-only over the canonical files.
export async function GET() {
  try {
    return NextResponse.json({ roles: await listRoles() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "could not list roles" }, { status: 500 });
  }
}
