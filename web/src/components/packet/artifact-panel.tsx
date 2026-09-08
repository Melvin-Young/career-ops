"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Kind = "resume" | "cover-letter";
type Version = { version: number; state: "draft" | "approved" | "superseded"; content: string; provenance: string[]; updatedAt: string };
type Listing = { versions: Version[]; approvedVersion: number | null; pdfReady: boolean; download: string | null };

const primary = "inline-flex min-h-[44px] items-center justify-center rounded-md bg-pen px-4 text-[15px] font-medium text-pen-ink hover:bg-pen-hover disabled:opacity-50";
const secondary = "inline-flex min-h-[44px] items-center justify-center rounded-md border border-rule bg-sheet px-4 text-[15px] font-medium text-ink hover:bg-sheet-hover disabled:opacity-50";

// Review first, edit on demand. Every version is named; approval names the
// version it approves; the download link is bound to that version and stays
// on the page. Editing an approved version makes a new draft (ADR 0002).
export function ArtifactPanel({ n, kind, label, belowApplyLine }: { n: string; kind: Kind; label: string; belowApplyLine: boolean }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [override, setOverride] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (prefer?: number) => {
    const res = await fetch(`/api/artifacts?n=${n}&kind=${kind}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load versions");
    const next = data as Listing;
    setListing(next);
    const target = next.versions.find((v) => v.version === prefer) ?? next.versions.find((v) => v.version === next.approvedVersion) ?? next.versions[0] ?? null;
    setSelected(target?.version ?? null);
  }, [n, kind]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Could not load versions"));
  }, [load]);

  const current = useMemo(() => listing?.versions.find((v) => v.version === selected) ?? null, [listing, selected]);
  const dirty = editing && current != null && buffer !== current.content;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function pick(version: number) {
    if (dirty && !window.confirm("You have unsaved edits. Switch versions and lose them?")) return;
    setEditing(false);
    setConfirmApprove(false);
    setSelected(version);
    setStatus("");
  }

  async function act(body: Record<string, unknown>, done: (data: Record<string, unknown>) => Promise<void> | void) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/artifacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n, kind, ...body }) });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "The action failed");
      await done(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The action failed");
    } finally {
      setBusy(false);
    }
  }

  const generate = (longForm = false) => act({ action: "generate", longForm }, async (d) => {
    await load(Number(d.version));
    setStatus(`Draft v${d.version} created from your CV and approved evidence. Read it before approving.`);
  });
  const save = () => act({ action: "save", content: buffer, baseVersion: current?.version ?? null, provenance: current?.provenance ?? [] }, async (d) => {
    setEditing(false);
    await load(Number(d.version));
    setStatus(current?.state === "approved" ? `Saved as a new draft, v${d.version}. v${current.version} stays approved.` : `Draft v${d.version} saved.`);
  });
  const approve = () => act({ action: "approve", version: current?.version }, async (d) => {
    setConfirmApprove(false);
    await load(Number(d.version));
    setStatus(`${label} v${d.version} approved. Export it to get a download link.`);
  });
  const exportPdf = () => act({ action: "export" }, async (d) => {
    await load(Number(d.version));
    setStatus(`PDF for v${d.version} is ready below.`);
  });

  const gated = belowApplyLine && !override;
  const versions = listing?.versions ?? [];
  const approved = listing?.approvedVersion ?? null;

  return (
    <div className="rounded-lg bg-sheet p-4 shadow-[0_1px_0_var(--rule)]">
      {error && <p role="alert" className="mb-3 rounded-md bg-caution-soft px-3 py-2 text-[14px] text-caution">{error}</p>}
      <p role="status" aria-live="polite" className={cn("text-[14px] text-graphite", !status && "sr-only")}>{status}</p>

      {listing && versions.length === 0 && (
        <div>
          <p className="text-[15px] text-ink">No {label.toLowerCase()} draft yet.</p>
          {gated ? (
            <div className="mt-2">
              <p className="text-[14px] text-caution">This job is below the apply line. Drafting is held until you choose to go ahead.</p>
              <button type="button" onClick={() => setOverride(true)} className={cn(secondary, "mt-2")}>Draft anyway</button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => generate(false)} className={primary}>Create draft</button>
              {kind === "cover-letter" && <button type="button" disabled={busy} onClick={() => generate(true)} className={secondary}>Create long-form draft</button>}
            </div>
          )}
        </div>
      )}

      {versions.length > 0 && (
        <>
          <div role="group" aria-label={`${label} versions`} className="flex flex-wrap gap-1.5">
            {[...versions].reverse().map((v) => (
              <button
                key={v.version}
                type="button"
                aria-pressed={selected === v.version}
                onClick={() => pick(v.version)}
                className={cn(
                  "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-sm",
                  selected === v.version ? "border-ink bg-ink text-sheet" : "border-rule text-ink hover:bg-sheet-hover",
                )}
              >
                v{v.version}
                <span className={cn(selected === v.version ? "text-sheet" : "text-graphite")}>{v.state}</span>
              </button>
            ))}
          </div>

          {current && !editing && (
            <div className="mt-3">
              <div className={cn("relative whitespace-pre-wrap rounded-md border border-rule bg-white p-4 text-[14px] leading-6 text-[#151a21]", !expanded && "max-h-[22rem] overflow-hidden")}>
                {current.content}
                {!expanded && <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />}
              </div>
              <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 min-h-[44px] text-sm font-medium text-pen">
                {expanded ? "Show less" : "Show all"}
              </button>
              {current.provenance.length > 0 && (
                <p className="text-xs text-graphite">Uses {current.provenance.length} approved evidence item{current.provenance.length === 1 ? "" : "s"}.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => { setBuffer(current.content); setEditing(true); setConfirmApprove(false); window.setTimeout(() => textarea.current?.focus(), 0); }} className={secondary}>
                  {current.state === "approved" ? "Edit as new draft" : "Edit"}
                </button>
                {current.state === "draft" && !confirmApprove && (
                  <button type="button" disabled={busy || gated} onClick={() => setConfirmApprove(true)} className={primary}>Approve v{current.version}</button>
                )}
                {current.state === "approved" && listing?.download && listing.pdfReady && (
                  <a href={listing.download} className={primary} download>
                    Download v{current.version} PDF
                  </a>
                )}
                {current.state === "approved" && (
                  <button type="button" disabled={busy} onClick={exportPdf} className={secondary}>
                    {listing?.pdfReady ? "Export again" : "Export PDF"}
                  </button>
                )}
              </div>
              {gated && current.state === "draft" && (
                <p className="mt-2 text-[14px] text-caution">Below the apply line. <button type="button" onClick={() => setOverride(true)} className="font-medium underline underline-offset-2">Approve anyway</button></p>
              )}
              {confirmApprove && (
                <div className="mt-3 rounded-md bg-pen-soft p-3">
                  <p className="text-[15px] text-ink">Approve {label.toLowerCase()} v{current.version}? It becomes the version you export. Later edits create v{versions[0].version + 1}.</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busy} onClick={approve} className={primary}>Approve v{current.version}</button>
                    <button type="button" disabled={busy} onClick={() => setConfirmApprove(false)} className={secondary}>Not yet</button>
                  </div>
                </div>
              )}
              {current.state === "approved" && !listing?.pdfReady && (
                <p className="mt-2 text-[13px] text-graphite">Approved, not exported yet. The download link appears after export.</p>
              )}
              {current.state !== "approved" && approved != null && listing?.download && (
                <p className="mt-2 text-[13px] text-graphite">
                  Approved version is v{approved}. <a href={listing.download} className="inline-flex min-h-[44px] items-center font-medium text-pen underline underline-offset-2" download>Download v{approved} PDF</a>
                </p>
              )}
            </div>
          )}

          {current && editing && (
            <div className="mt-3">
              <label htmlFor={`${kind}-editor`} className="text-[14px] font-medium text-ink">
                {current.state === "approved" ? `Editing a copy of v${current.version}; saving creates v${versions[0].version + 1}` : `Editing draft v${current.version}`}
              </label>
              <textarea
                id={`${kind}-editor`}
                ref={textarea}
                value={buffer}
                onChange={(e) => setBuffer(e.target.value)}
                rows={18}
                className="mt-1 w-full rounded-md border border-rule bg-sheet p-3 text-[14px] leading-6 text-ink"
              />
              {kind === "cover-letter" && (
                <p className="mt-1 text-xs text-graphite">{wordCount(buffer)} words. Concise target is 70 to 120.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy || !buffer.trim() || !dirty} onClick={save} className={primary}>Save draft</button>
                <button type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard your edits?")) setEditing(false); }} className={secondary}>Cancel</button>
              </div>
            </div>
          )}

          {!editing && (
            <div className="mt-4 border-t border-rule pt-3">
              <button type="button" disabled={busy || gated} onClick={() => generate(false)} className="min-h-[44px] text-sm font-medium text-pen disabled:opacity-50">
                Create another draft from your CV
              </button>
            </div>
          )}
        </>
      )}

      {!listing && !error && <p className="text-[14px] text-graphite">Loading versions.</p>}
    </div>
  );
}

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
