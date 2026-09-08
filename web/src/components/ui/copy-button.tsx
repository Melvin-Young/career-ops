"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// Copies text and says what happened. The status is announced (aria-live) and
// written, so a failure is never silent and success is never color alone.
export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2500);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className={cn(
          "inline-flex min-h-[44px] items-center rounded-md border border-rule bg-sheet px-3 text-sm font-medium text-ink hover:bg-sheet-hover",
          className,
        )}
      >
        {state === "copied" ? "Copied" : label}
      </button>
      <span role="status" aria-live="polite" className={cn("text-xs", state === "failed" ? "text-caution" : "text-graphite")}>
        {state === "failed" ? "Copy failed, select the text instead" : ""}
      </span>
    </span>
  );
}
