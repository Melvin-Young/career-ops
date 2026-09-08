import { readRoleArtifactPdf } from "@/lib/artifact-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves the approved export only. The link names the version it expects
// (`v`): if the approved pointer has moved since the link was made, the bytes
// are not served under the old name — the caller gets a 409 and a fresh link.
// The filename carries the role and version so a phone's Files app shows what
// was downloaded.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const n = url.searchParams.get("n") ?? "";
  const kind = url.searchParams.get("kind");
  const wanted = url.searchParams.get("v");
  try {
    const artifact = await readRoleArtifactPdf(n, kind);
    if (!artifact) return new Response("approved export not found", { status: 404 });
    if (wanted && Number(wanted) !== artifact.version) {
      return Response.json({ error: `approved version is now v${artifact.version}`, approvedVersion: artifact.version }, { status: 409 });
    }
    if (!artifact.bytes) return new Response(`approved v${artifact.version} has not been exported yet`, { status: 404 });
    const name = `${artifact.kind}-${artifact.slug}-v${artifact.version}.pdf`;
    return new Response(new Uint8Array(artifact.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(artifact.bytes.length),
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
        "X-Artifact-Version": String(artifact.version),
      },
    });
  } catch {
    return new Response("approved export not found", { status: 404 });
  }
}
