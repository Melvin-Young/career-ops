"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { shortDate } from "@/lib/roles/state.mjs";
import { cn } from "@/lib/cn";

const PLATFORMS = ["LinkedIn", "Indeed", "Employer site", "Other"];
const JUST_APPLIED_KEY = "desk:just-applied";

function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// The two actions a phone needs at the top: open the posting to apply there,
// and record that you did. Opening never changes state. Recording asks for
// the role, the date and the platform, then writes through set-status.mjs.
export function PacketActions({ id, url, company, title, appliedOn, appliedVia }: { id: string; url: string; company: string; title: string; appliedOn: string | null; appliedVia: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayLocal());
  const [platform, setPlatform] = useState(appliedVia && PLATFORMS.includes(appliedVia) ? appliedVia : appliedVia ? "Other" : "LinkedIn");
  const [other, setOther] = useState(appliedVia && !PLATFORMS.includes(appliedVia) ? appliedVia : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (appliedOn) setDate(appliedOn);
  }, [appliedOn]);

  async function record(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const via = platform === "Other" ? other.trim() : platform;
    if (!via) {
      setError("Say where you applied.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/roles/applied", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, date, platform: via }) });
      const data = (await res.json()) as { ok?: boolean; trackerN?: string; error?: string };
      if (!res.ok || !data.ok || !data.trackerN) throw new Error(data.error ?? "The application was not recorded");
      try {
        sessionStorage.setItem(JUST_APPLIED_KEY, data.trackerN);
      } catch {
        /* private mode */
      }
      setOpen(false);
      if (data.trackerN !== id) router.replace(`/role/${data.trackerN}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The application was not recorded");
    } finally {
      setBusy(false);
    }
  }

  const hasUrl = /^https?:\/\//i.test(url);
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {hasUrl ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-rule bg-sheet px-4 text-[15px] font-medium text-ink hover:bg-sheet-hover"
        >
          Open posting <ExternalLink className="size-4 text-graphite" aria-hidden />
          <span className="sr-only">(opens in a new tab; you apply there yourself)</span>
        </a>
      ) : (
        <span className="inline-flex min-h-[44px] items-center text-[14px] text-graphite">No link to open.</span>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-[44px] items-center rounded-md px-4 text-[15px] font-medium",
          appliedOn ? "border border-stamp/40 bg-stamp-soft text-stamp" : "bg-pen text-pen-ink hover:bg-pen-hover",
        )}
      >
        {appliedOn ? `Applied ${shortDate(appliedOn)}` : "I applied"}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={appliedOn ? "Update your application record" : "Record your application"}>
        <form onSubmit={record}>
          <p className="text-[15px] text-ink">
            {title} at {company}
          </p>
          <p className="mt-1 text-[13px] text-graphite">Only record this after you submitted the application yourself. Nothing is sent from here.</p>
          <label className="mt-4 block text-[14px]">
            <span className="font-medium text-ink">Date you applied</span>
            <input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} required className="mt-1 min-h-[44px] w-full rounded-md border border-rule bg-sheet px-3 text-[15px] text-ink" />
          </label>
          <fieldset className="mt-3">
            <legend className="text-[14px] font-medium text-ink">Where</legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {PLATFORMS.map((p) => (
                <label key={p} className={cn("flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border px-3 text-[15px]", platform === p ? "border-ink bg-ink text-sheet" : "border-rule text-ink")}>
                  <input type="radio" name="platform" value={p} checked={platform === p} onChange={() => setPlatform(p)} className="sr-only" />
                  {p}
                </label>
              ))}
            </div>
            {platform === "Other" && (
              <label className="mt-2 block text-[14px]">
                <span className="sr-only">Name the platform</span>
                <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Name the platform" maxLength={40} className="min-h-[44px] w-full rounded-md border border-rule bg-sheet px-3 text-[15px] text-ink placeholder:text-graphite" />
              </label>
            )}
          </fieldset>
          {error && <p role="alert" className="mt-3 rounded-md bg-caution-soft px-3 py-2 text-[14px] text-caution">{error}</p>}
          <button type="submit" disabled={busy} className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-stamp px-4 text-[15px] font-medium text-stamp-ink hover:opacity-90 disabled:opacity-50">
            {busy ? "Recording" : appliedOn ? "Update record" : "Record application"}
          </button>
        </form>
      </Sheet>
    </div>
  );
}

/** The applied stop's dot fills once, right after a submission is recorded. */
export function AppliedStamp({ trackerN, appliedOn, appliedVia }: { trackerN: string | null; appliedOn: string | null; appliedVia: string | null }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    try {
      if (trackerN && sessionStorage.getItem(JUST_APPLIED_KEY) === trackerN) {
        sessionStorage.removeItem(JUST_APPLIED_KEY);
        setAnimate(true);
      }
    } catch {
      /* ignore */
    }
  }, [trackerN]);
  if (!appliedOn) return <p className="text-[14px] text-graphite">Not recorded. After you submit on the employer&apos;s site, tap I applied.</p>;
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className={cn("inline-block h-6 w-1.5 rounded-full bg-stamp", animate && "stamp-in")} />
      <p className="text-[15px] text-ink">
        Recorded {shortDate(appliedOn)}{appliedVia ? ` on ${appliedVia}` : ""}.
      </p>
    </div>
  );
}
