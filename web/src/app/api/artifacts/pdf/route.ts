import { readRoleArtifactPdf } from "@/lib/artifact-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const artifact = await readRoleArtifactPdf(url.searchParams.get("n") ?? "", url.searchParams.get("kind"));
    if (!artifact) return new Response("approved export not found", { status: 404 });
    return new Response(artifact.bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${artifact.kind}-${url.searchParams.get("n")}-v${artifact.version}.pdf"` } });
  } catch {
    return new Response("approved export not found", { status: 404 });
  }
}
