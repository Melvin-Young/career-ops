import { cn } from "@/lib/cn";

// The packet's one bold element: a vertical spine with a stop per stage.
// Each stop says its state in words; the dot only repeats it.
export type StopState = "done" | "open" | "applied" | "todo";

export function Spine({ children }: { children: React.ReactNode }) {
  return <ol className="mt-6">{children}</ol>;
}

export function Stop({
  label,
  detail,
  state,
  last = false,
  children,
  id,
}: {
  label: string;
  detail?: string | null;
  state: StopState;
  last?: boolean;
  children?: React.ReactNode;
  id?: string;
}) {
  const dot = {
    done: "border-ink bg-ink",
    open: "border-ink bg-sheet",
    applied: "border-stamp bg-stamp",
    todo: "border-rule bg-sheet",
  }[state];
  return (
    <li id={id} className="relative pl-7 pb-8 last:pb-0">
      {!last && <span aria-hidden className={cn("absolute left-[7px] top-4 bottom-0 w-0.5", state === "applied" ? "bg-stamp/40" : "bg-rule")} />}
      <span aria-hidden className={cn("absolute left-0 top-[5px] size-4 rounded-full border-2", dot)} />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-[17px] font-semibold leading-6 text-ink">{label}</h2>
        {detail && <span className={cn("text-[13px]", state === "applied" ? "text-stamp" : "text-graphite")}>{detail}</span>}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </li>
  );
}
