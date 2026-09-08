"use client";

import { CvIngest } from "@/components/cv/cv-ingest";

// The first-run takeover: when cv.md is missing, the CV intake IS the desk.
// Nothing can be scored without a CV, so this comes before the job list.
export function FirstRunHome() {
  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 sm:py-12">
      <section className="rounded-lg bg-sheet p-5 shadow-[0_1px_0_var(--rule)] sm:p-7">
        <p className="text-[13px] text-graphite">Local, on this Mac</p>
        <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.01em] text-ink sm:text-[30px]">
          Add your CV to start the desk.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-graphite">
          No account. Paste text or drop a .md or .txt file. A PDF needs an AI CLI in{" "}
          <a href="/config" className="text-pen underline underline-offset-2">Config</a>{" "}
          first. Scanning job boards is free; tokens are only spent when you choose to score a job.
        </p>
        <div className="mt-6">
          <CvIngest />
        </div>
      </section>
    </div>
  );
}
