import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FitSummary } from "@/lib/roles/server";

// The evaluation, read before edited: the facts line, the verdict, then
// strengths and gaps, with the full report behind a disclosure. This is text
// for the user, and says so, because the answers section next to it is text
// for the application.
export function FitSection({ fit, belowApplyLine }: { fit: FitSummary; belowApplyLine: boolean }) {
  const facts: string[] = [];
  if (fit.score) facts.push(`${fit.score.replace(/\/5$/, " of 5")}`);
  if (fit.decision) facts.push(`Recommends: ${fit.decision}`);
  if (fit.legitimacy) facts.push(`Legitimacy: ${fit.legitimacy}`);
  facts.push(fit.verification ? `Verification: ${fit.verification}` : "Verification: not recorded");
  if (fit.advertisedComp) facts.push(`Stated pay: ${fit.advertisedComp}`);

  return (
    <div className="rounded-lg bg-sheet p-4 shadow-[0_1px_0_var(--rule)]">
      <p className="text-xs text-graphite">For you, not for the form.</p>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-ink">
        {facts.map((f) => <span key={f}>{f}</span>)}
      </p>
      {belowApplyLine && (
        <p className="mt-3 rounded-md bg-caution-soft px-3 py-2 text-[14px] text-caution">
          Below the 4.0 apply line. career-ops recommends against applying unless you have a specific reason.
        </p>
      )}
      {fit.verdict && (
        <div className="report-prose mt-3 text-[15px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{fit.verdict}</ReactMarkdown>
        </div>
      )}
      {fit.hardStops.length > 0 && <List title="Hard stops" items={fit.hardStops} tone="caution" />}
      {fit.strengths.length > 0 && <List title="Strengths" items={fit.strengths} />}
      {fit.gaps.length > 0 && <List title="Gaps" items={fit.gaps} />}
      {fit.nextAction && <p className="mt-3 text-[14px] text-graphite">Next: {fit.nextAction}</p>}
      {fit.sections.length > 0 && (
        <details className="mt-4 border-t border-rule pt-3">
          <summary className="min-h-[44px] cursor-pointer list-none py-2 text-[15px] font-medium text-pen">Full report</summary>
          <div className="report-prose mt-2">
            {fit.sections.map((s) => (
              <ReactMarkdown key={s.heading} remarkPlugins={[remarkGfm]}>{`## ${s.heading}\n\n${s.content}`}</ReactMarkdown>
            ))}
          </div>
          <p className="mt-3 text-xs text-graphite">Report file: reports/{fit.file}</p>
        </details>
      )}
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: "caution" }) {
  return (
    <div className="mt-3">
      <p className={tone === "caution" ? "text-[14px] font-medium text-caution" : "text-[14px] font-medium text-ink"}>{title}</p>
      <ul className="mt-1 list-disc pl-5 text-[15px] leading-relaxed text-ink">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
