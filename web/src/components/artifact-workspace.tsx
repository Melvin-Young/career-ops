"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, FilePlus2, Save } from "lucide-react";

type Kind = "resume" | "cover-letter";
type Version = {
  version: number;
  state: "draft" | "approved" | "superseded";
  content: string;
  provenance: string[];
  updatedAt: string;
};

export function ArtifactWorkspace({ n, kind }: { n: string; kind: Kind }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [approvedVersion, setApprovedVersion] = useState<number | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (prefer?: number) => {
    const res = await fetch(`/api/artifacts?n=${n}&kind=${kind}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load artifacts");
    const next = data.versions as Version[];
    setVersions(next);
    setApprovedVersion(data.approvedVersion);
    setPdfReady(Boolean(data.pdfReady));
    const target = next.find((item) => item.version === prefer) ?? next[0] ?? null;
    setSelected(target?.version ?? null);
    setContent(target?.content ?? "");
  }, [kind, n]);

  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);

  const current = versions.find((item) => item.version === selected) ?? null;
  const provenance = current?.provenance ?? [];
  const wordCount = useMemo(() => content.trim() ? content.trim().split(/\s+/).length : 0, [content]);
  const dirty = current ? current.content !== content : Boolean(content);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/artifacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n, kind, ...body }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Artifact action failed");
      if (body.action === "export" && data.download) {
        setPdfReady(true);
        window.open(data.download, "_blank", "noopener,noreferrer");
      } else {
        await load(data.version);
      }
      setMessage(body.action === "approve" ? `Version ${data.version} approved.` : body.action === "save" ? `Draft v${data.version} saved.` : body.action === "generate" ? `Draft v${data.version} created.` : "Approved PDF exported.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Artifact action failed");
    } finally {
      setBusy(false);
    }
  }

  function selectVersion(version: number) {
    const item = versions.find((entry) => entry.version === version);
    setSelected(version);
    setContent(item?.content ?? "");
    setMessage("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={busy} onClick={() => act({ action: "generate" })} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"><FilePlus2 className="size-4" /> New draft</button>
          {kind === "cover-letter" && <button disabled={busy} onClick={() => act({ action: "generate", longForm: true })} className="rounded-lg border border-border px-3.5 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50">New long-form draft</button>}
          <button disabled={busy || !content || !dirty} onClick={() => act({ action: "save", content, baseVersion: selected, provenance: current?.provenance ?? [] })} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm text-muted hover:text-foreground disabled:opacity-40"><Save className="size-4" /> Save draft</button>
          <button disabled={busy || !current || dirty || current.state !== "draft"} onClick={() => act({ action: "approve", version: current?.version })} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm text-muted hover:text-foreground disabled:opacity-40"><Check className="size-4" /> Approve</button>
          <button disabled={busy || approvedVersion == null} onClick={() => act({ action: "export" })} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm text-muted hover:text-foreground disabled:opacity-40"><Download className="size-4" /> Export approved PDF</button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <select value={selected ?? ""} onChange={(event) => selectVersion(Number(event.target.value))} className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
            {!versions.length && <option value="">No versions yet</option>}
            {versions.map((item) => <option key={item.version} value={item.version}>v{String(item.version).padStart(3, "0")} · {item.state}</option>)}
          </select>
          <span className="text-xs text-faint">{kind === "cover-letter" ? `${wordCount} words${wordCount && (wordCount < 70 || wordCount > 120) ? " · outside concise target" : ""}` : `${content.length} characters`}</span>
        </div>

        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder={`Generate or write a ${kind === "resume" ? "role-specific resume" : "cover letter"} draft…`} className="mt-3 min-h-[34rem] w-full resize-y rounded-2xl border border-border bg-surface/40 p-4 font-mono text-sm leading-6 outline-none focus:border-brand/50" />
        <p className="mt-2 min-h-5 text-xs text-muted">{message}{pdfReady && approvedVersion ? ` Approved v${approvedVersion} has a PDF export.` : ""}</p>
      </section>

      <aside>
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Preview</h3>
        <div className="mt-3 min-h-[34rem] whitespace-pre-wrap rounded-2xl border border-border bg-white p-7 text-sm leading-6 text-zinc-900 shadow-sm dark:bg-zinc-100">{content || <span className="text-zinc-400">Your preview appears here.</span>}</div>
        {provenance.length > 0 && <details className="mt-3 rounded-xl border border-border p-3 text-xs text-muted"><summary className="cursor-pointer">Career Evidence used ({provenance.length})</summary><ul className="mt-2 space-y-1 font-mono text-[11px]">{provenance.map((id) => <li key={id}>{id}</li>)}</ul></details>}
      </aside>
    </div>
  );
}
