import { NextResponse } from "next/server";
import {
  approveRoleArtifact,
  exportRoleArtifact,
  generateRoleArtifact,
  listRoleArtifacts,
  saveRoleArtifact,
} from "@/lib/artifact-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    return NextResponse.json(await listRoleArtifacts(url.searchParams.get("n") ?? "", url.searchParams.get("kind")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "artifact read failed" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const n = typeof body.n === "string" ? body.n : "";
    if (body.action === "generate") return NextResponse.json(await generateRoleArtifact(n, body.kind, body.longForm === true));
    if (body.action === "save") return NextResponse.json(await saveRoleArtifact(n, body.kind, body.content, body.provenance, body.baseVersion));
    if (body.action === "approve") return NextResponse.json(await approveRoleArtifact(n, body.kind, body.version));
    if (body.action === "export") return NextResponse.json(await exportRoleArtifact(n, body.kind));
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "artifact write failed" }, { status: 400 });
  }
}
