"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useJobs } from "@/components/jobs/job-store";
import { WorkerCard } from "@/components/jobs/worker-card";

// Runs the real evaluation (modes/oferta.md through /api/run) for THIS job
// only. Nothing starts by opening the page; the button says what it costs.
// While the worker runs, its progress shows here; on failure the error stays
// visible with a retry. On success the saved link has become a tracker row,
// and the page moves to that id.
export function PreparePacket({ id, url, title, company }: { id: string; url: string; title: string; company: string }) {
  const router = useRouter();
  const { jobs, startJob } = useJobs();
  const job = useMemo(
    () => jobs.filter((j) => j.kind === "evaluate" && j.input === url).sort((a, b) => b.startedAt - a.startedAt)[0],
    [jobs, url],
  );
  const [settling, setSettling] = useState(false);
  const [note, setNote] = useState("");
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!job || job.status !== "done" || handled.current === job.id) return;
    handled.current = job.id;
    setSettling(true);
    let tries = 0;
    const poll = async () => {
      tries += 1;
      try {
        const res = await fetch(`/api/roles/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = (await res.json()) as { role?: { redirectTo?: string; trackerN: string | null; fit: unknown } };
        const target = data.role?.redirectTo ?? (data.role?.fit ? data.role.trackerN : null);
        if (target && target !== id) {
          router.replace(`/role/${target}`);
          return;
        }
        if (target === id) {
          router.refresh();
          setSettling(false);
          return;
        }
      } catch {
        /* retry below */
      }
      if (tries < 6) window.setTimeout(poll, 1500);
      else {
        setSettling(false);
        setNote("The worker finished but no report is linked to this job yet. Open Workers for its output, then reload.");
      }
    };
    poll();
  }, [job, id, router]);

  function start() {
    setNote("");
    if (!/^https?:\/\//i.test(url)) {
      setNote("This job has no link the evaluator can read.");
      return;
    }
    startJob({ title: `Evaluate ${company}`, subtitle: title, kind: "evaluate", input: url, page: `/role/${id}` });
  }

  if (job?.status === "running" || settling) {
    return (
      <div className="rounded-lg bg-sheet p-4 shadow-[0_1px_0_var(--rule)]">
        <p className="text-[15px] text-ink">Preparing the packet for this job only.</p>
        <p className="mt-1 text-[13px] text-graphite">Reads the posting, scores the fit against your CV, writes the report and tracker row. Usually a few minutes.</p>
        <div className="mt-3">{job && <WorkerCard job={job} variant="inline" />}</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-sheet p-4 shadow-[0_1px_0_var(--rule)]">
      {job?.status === "error" && (
        <p role="alert" className="mb-3 rounded-md bg-caution-soft px-3 py-2 text-[14px] text-caution">
          The evaluation did not finish: {job.steps[job.steps.length - 1]?.label ?? "unknown error"}. Nothing was recorded.
        </p>
      )}
      {note && <p role="status" className="mb-3 text-[14px] text-caution">{note}</p>}
      <p className="text-[15px] text-ink">No fit yet.</p>
      <p className="mt-1 text-[13px] text-graphite">Prepare the packet to score this job against your CV and unlock resume, letter and answers. Runs your AI CLI on this job only and spends tokens.</p>
      <button
        type="button"
        onClick={start}
        className="mt-3 inline-flex min-h-[44px] items-center rounded-md bg-pen px-4 text-[15px] font-medium text-pen-ink hover:bg-pen-hover"
      >
        {job?.status === "error" ? "Try again" : "Prepare packet"}
      </button>
    </div>
  );
}
