import { NextResponse } from "next/server";
import { resolveRole } from "@/lib/roles/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One packet by id (tracker number or `u-` URL key). `redirectTo` tells the
// client the saved link now has a tracker row.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await resolveRole(id);
  if (!role) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ role });
}
