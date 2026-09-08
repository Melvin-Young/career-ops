"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SavePreview } from "@/lib/roles/server";
import { cn } from "@/lib/cn";

type Preview = Extract<SavePreview, { ok: true; existing: null }>;
type Existing = Extract<SavePreview, { ok: true; existing: "tracker" | "inbox" }>;

const field = "min-h-[44px] w-full rounded-md border border-rule bg-sheet px-3 text-[15px] text-ink placeholder:text-graphite";
const primary = "inline-flex min-h-[44px] items-center justify-center rounded-md bg-pen px-4 text-[15px] font-medium text-pen-ink hover:bg-pen-hover disabled:opacity-50";
const secondary = "inline-flex min-h-[44px] items-center justify-center rounded-md border border-rule bg-sheet px-4 text-[15px] font-medium text-ink hover:bg-sheet-hover disabled:opacity-50";

// The desk's entry. Phase one reads the page and shows what it states; phase
// two writes the record. Everything typed survives a failed attempt.
export function SaveJob() {
  const router = useRouter();
  const id = useId();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<Existing | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState({ company: "", title: "", location: "", pay: "", description: "" });
  const inflight = useRef(false);

  async function lookUp(e: React.FormEvent) {
    e.preventDefault();
    if (inflight.current) return;
    setError("");
    setExisting(null);
    setPreview(null);
    const value = url.trim();
    if (!/^https?:\/\/\S+$/i.test(value)) {
      setError("Paste a full link that starts with https://");
      return;
    }
    inflight.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/roles/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: value }) });
      const data = (await res.json()) as SavePreview;
      if (!data.ok) {
        setError(data.error);
        return;
      }
      if (data.existing) {
        setExisting(data);
        return;
      }
      setPreview(data);
      setDraft({
        company: data.metadata.company ?? "",
        title: data.metadata.title ?? "",
        location: data.metadata.location ?? "",
        pay: data.metadata.pay ?? "",
        description: "",
      });
    } catch {
      setError("The desk could not reach the server. Your link is still here, try again.");
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || inflight.current) return;
    if (!draft.company.trim() || !draft.title.trim()) {
      setError("Add the company and the job title so the job can be told apart later.");
      return;
    }
    inflight.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/roles/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          url: preview.url,
          company: draft.company.trim(),
          title: draft.title.trim(),
          location: draft.location.trim(),
          pay: preview.metadata.salary ? "" : draft.pay.trim(),
          salary: preview.metadata.salary && draft.pay.trim() === (preview.metadata.pay ?? "") ? preview.metadata.salary : undefined,
          employerUrl: preview.metadata.employerUrl,
          description: draft.description,
          unverified: !preview.readable,
        }),
      });
      const data = (await res.json()) as { ok: boolean; id?: string; error?: string };
      if (!data.ok || !data.id) {
        setError(data.error ?? "The job was not saved.");
        return;
      }
      setUrl("");
      setPreview(null);
      router.push(`/role/${data.id}`);
      router.refresh();
    } catch {
      setError("The desk could not reach the server. Nothing was lost, try again.");
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="rounded-lg bg-sheet p-3 shadow-[0_1px_0_var(--rule)]">
      <h2 id={`${id}-h`} className="sr-only">Save a job</h2>
      <form onSubmit={lookUp} className="flex gap-2">
        <label htmlFor={`${id}-url`} className="sr-only">Job link</label>
        <input
          id={`${id}-url`}
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a job link from LinkedIn, Indeed or an employer"
          className={field}
          disabled={busy}
        />
        <button type="submit" disabled={busy} className={primary}>
          {busy && !preview ? "Reading" : "Save"}
        </button>
      </form>

      <p role="status" aria-live="polite" className={cn("mt-2 text-sm", error ? "text-caution" : "text-graphite", !error && !existing && "sr-only")}>
        {error || (existing ? `Already saved: ${existing.record.company}, ${existing.record.title}.` : "")}
        {existing && (
          <>
            {" "}
            <Link href={`/role/${existing.id}`} className="font-medium text-pen underline underline-offset-2">Open it</Link>
          </>
        )}
      </p>

      {preview && (
        <form onSubmit={confirm} className="mt-3 border-t border-rule pt-3">
          <p className="text-sm text-graphite">
            {preview.readable
              ? `Read from the page${preview.board ? " on the job board" : ""}. Correct anything that is wrong.`
              : `The page could not be read${preview.reason ? ` (${preview.reason.toLowerCase()})` : ""}. Add the details yourself; the job will be marked as not verified.`}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Company" value={draft.company} onChange={(v) => setDraft({ ...draft, company: v })} required />
            <Field label="Job title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} required />
            <Field label="Location" value={draft.location} onChange={(v) => setDraft({ ...draft, location: v })} hint="Leave empty if not stated" />
            <Field label="Pay" value={draft.pay} onChange={(v) => setDraft({ ...draft, pay: v })} hint="Leave empty if not stated" />
          </div>
          {!preview.readable && (
            <label className="mt-3 block text-sm">
              <span className="font-medium text-ink">Description (optional)</span>
              <span className="block text-xs text-graphite">Paste the posting text so the packet can use it. It is kept as unverified.</span>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={5}
                className="mt-1 w-full rounded-md border border-rule bg-sheet p-3 text-[15px] text-ink"
              />
            </label>
          )}
          {preview.metadata.employerUrl && (
            <p className="mt-3 break-all text-xs text-graphite">Employer link found: {preview.metadata.employerUrl}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={primary}>Save job</button>
            <button type="button" disabled={busy} onClick={() => setPreview(null)} className={secondary}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({ label, value, onChange, required, hint }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; hint?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="font-medium text-ink">{label}</span>
      {hint && <span className="block text-xs text-graphite">{hint}</span>}
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required} className={cn(field, "mt-1")} />
    </label>
  );
}
