"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { WorkerPills } from "@/components/jobs/worker-pills";
import { UsageMeter } from "@/components/usage-meter";
import { useJobs } from "@/components/jobs/job-store";
import { SECONDARY_ITEMS, isActivePath } from "@/lib/nav-items";
import { cn } from "@/lib/cn";

// One bar for every width: the wordmark returns to the desk, More opens the
// secondary tools. A native <dialog> gives the menu focus trapping, Escape and
// a backdrop without a hand-rolled drawer.
export function TopBar() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const { jobs } = useJobs();
  const running = jobs.filter((j) => j.status === "running").length;

  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-ground/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-14 max-w-[880px] items-center gap-1 px-4">
        <Link href="/" className="inline-flex min-h-[44px] items-center gap-2 rounded-md pr-2 text-[15px] font-semibold text-ink">
          <span aria-hidden className="inline-block size-2.5 rounded-sm bg-ink" />
          career-ops
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {running > 0 && (
            <Link href="/jobs" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-2 text-sm text-graphite" aria-label={`${running} worker${running === 1 ? "" : "s"} running`}>
              <span aria-hidden className="job-indeterminate inline-block h-1.5 w-8 rounded-full bg-rule" />
              {running} running
            </Link>
          )}
          <ThemeToggle />
          <button
            type="button"
            onClick={() => dialog.current?.showModal()}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-3 text-sm font-medium text-ink hover:bg-sheet-hover"
            aria-haspopup="dialog"
          >
            More
          </button>
        </div>
      </div>

      <dialog
        ref={dialog}
        aria-label="More tools"
        className="m-0 h-dvh max-h-dvh w-[min(22rem,100vw)] max-w-full bg-sheet p-0 text-ink shadow-2xl backdrop:bg-ink/40 [inset-inline-start:auto] [inset-inline-end:0]"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="flex h-full flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex items-center justify-between border-b border-rule px-4 py-2">
            <span className="text-[15px] font-semibold">More tools</span>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close menu" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-graphite hover:bg-sheet-hover">
              <X className="size-5" />
            </button>
          </div>
          <nav className="flex flex-col px-2 py-2" aria-label="Secondary">
            {SECONDARY_ITEMS.map(({ href, label, hint, icon: Icon }) => {
              const active = isActivePath(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-[15px]",
                    active ? "bg-pen-soft text-ink" : "text-ink hover:bg-sheet-hover",
                  )}
                >
                  <Icon className="size-4 text-graphite" aria-hidden />
                  <span className="flex flex-col">
                    <span>{label}</span>
                    {hint && <span className="text-xs text-graphite">{hint}</span>}
                  </span>
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => {
              dialog.current?.close();
              window.dispatchEvent(new Event("co-assistant"));
            }}
            className="mx-2 flex min-h-[44px] items-center gap-3 rounded-md px-3 text-[15px] text-ink hover:bg-sheet-hover"
          >
            <MessageSquare className="size-4 text-graphite" aria-hidden />
            Ask the assistant
          </button>
          <div className="px-3">
            <WorkerPills />
          </div>
          <div className="mt-auto space-y-3 border-t border-rule px-4 pt-3">
            <UsageMeter />
            <div className="flex items-center justify-between pb-2">
              <span className="text-sm text-graphite">Local, on this Mac</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </dialog>
    </header>
  );
}
