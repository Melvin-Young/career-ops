"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RoleSummary } from "@/lib/roles/server";
import { matchesQuery } from "@/lib/roles/state.mjs";
import { cn } from "@/lib/cn";

type Segment = "todo" | "applied" | "all";

const RAIL: Record<RoleSummary["state"], string> = {
  saved: "bg-rule",
  evaluated: "bg-graphite",
  packet: "bg-pen",
  applied: "bg-stamp",
  responded: "bg-stamp",
  interview: "bg-stamp",
  offer: "bg-stamp",
  hired: "bg-stamp",
  rejected: "bg-rule",
  discarded: "bg-rule",
  skip: "bg-rule",
};

// The list of jobs, rule-separated rows with a rail. The segment defaults to
// what needs the user. Counts only appear when they are not zero, and the
// search field only when there is enough to search.
export function JobList({ roles }: { roles: RoleSummary[] }) {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("todo");
  const [query, setQuery] = useState("");
  const [fourPlus, setFourPlus] = useState(false);

  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("co-job-done", refresh);
    return () => window.removeEventListener("co-job-done", refresh);
  }, [router]);

  const counts = useMemo(() => ({
    todo: roles.filter((r) => r.segments.includes("todo")).length,
    applied: roles.filter((r) => r.segments.includes("applied")).length,
    all: roles.length,
  }), [roles]);
  const anyScored = roles.some((r) => r.score);
  const rows = useMemo(
    () => roles.filter((r) => r.segments.includes(segment) && matchesQuery(r, query) && (!fourPlus || (r.score != null && parseFloat(r.score) >= 4))),
    [roles, segment, query, fourPlus],
  );

  if (roles.length === 0) {
    return (
      <p className="mt-6 text-[15px] text-graphite">Nothing saved yet. Paste a link above to start a packet.</p>
    );
  }

  return (
    <section aria-label="Jobs" className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Show" className="flex gap-1">
          {(["todo", "applied", "all"] as Segment[]).map((s) => (
            <button
              key={s}
              role="tab"
              type="button"
              aria-selected={segment === s}
              onClick={() => setSegment(s)}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-sm font-medium",
                segment === s ? "bg-ink text-sheet" : "text-graphite hover:bg-sheet-hover",
              )}
            >
              {s === "todo" ? "To do" : s === "applied" ? "Applied" : "All"}
              {counts[s] > 0 && <span className={cn("tabular-nums", segment === s ? "text-sheet" : "text-graphite")}>{counts[s]}</span>}
            </button>
          ))}
        </div>
        {anyScored && (
          <button
            type="button"
            aria-pressed={fourPlus}
            onClick={() => setFourPlus((v) => !v)}
            className={cn("ml-auto inline-flex min-h-[44px] items-center rounded-md border px-3 text-sm", fourPlus ? "border-ink bg-ink text-sheet" : "border-rule text-graphite hover:bg-sheet-hover")}
          >
            4.0 and up
          </button>
        )}
      </div>

      {roles.length > 3 && (
        <label className="mt-3 block">
          <span className="sr-only">Search company or title</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company or title"
            className="min-h-[44px] w-full rounded-md border border-rule bg-sheet px-3 text-[15px] text-ink placeholder:text-graphite"
          />
        </label>
      )}

      {rows.length === 0 ? (
        <p className="mt-6 text-[15px] text-graphite">
          {query ? "No job matches that search." : segment === "todo" ? "Nothing needs you right now." : "Nothing here yet."}
        </p>
      ) : (
        <ol className="mt-3 overflow-hidden rounded-lg bg-sheet shadow-[0_1px_0_var(--rule)]">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-rule last:border-b-0">
              <Link href={`/role/${r.id}`} className="flex min-h-[44px] gap-3 py-3 pr-4 hover:bg-sheet-hover">
                <span aria-hidden className={cn("w-1 shrink-0 self-stretch rounded-r", RAIL[r.state])} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{r.title}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] leading-snug">
                    <span className="font-medium text-ink">{r.company}</span>
                    {r.location && <span className="text-graphite">{r.location}</span>}
                    {r.pay && <span className="text-graphite tabular-nums">{r.pay}</span>}
                  </span>
                  <span className={cn("mt-1 block text-[13px]", r.state === "packet" ? "text-pen" : r.segments.includes("applied") ? "text-stamp" : r.unverified ? "text-caution" : "text-graphite")}>
                    {r.stateLabel}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
