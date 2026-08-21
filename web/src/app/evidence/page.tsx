import { readCareerEvidence, readCareerHistory, type CareerEvidenceLabel } from "@/lib/career-ops";

export const dynamic = "force-dynamic";

const LABEL_TONE: Record<CareerEvidenceLabel, string> = {
  Demonstrated: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Transferable: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Unverified: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Gap: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export default function EvidencePage() {
  const result = readCareerEvidence();
  const history = readCareerHistory();

  if (result.error) {
    return (
      <Shell>
        <Notice title="Career Evidence needs attention">
          The local evidence store exists but could not be read: {result.error}. Restore its backup or rerun the import after reviewing the file.
        </Notice>
      </Shell>
    );
  }

  if (!result.exists || !result.data) {
    return (
      <Shell>
        <Notice title="No Career Evidence imported yet">
          Preview an import with <Code>npm run import:evidence -- --source /path/to/Skill_Corpus --json</Code>, then add <Code>--apply</Code> after reviewing the plan.
        </Notice>
      </Shell>
    );
  }

  const { sources, evidence, marketSkills, voiceReferences } = result.data;
  const outwardEligible = evidence.filter((item) => item.outwardEligible).length;
  const gaps = marketSkills.filter((item) => item.label === "Gap").length;

  return (
    <Shell>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat value={evidence.length} label="career facts" />
        <Stat value={outwardEligible} label="approved for drafting" />
        <Stat value={marketSkills.length} label="market signals" />
        <Stat value={gaps} label="internal gaps" />
      </div>

      <Section title="Career facts" description="Approved evidence available to resumes, cover letters, and application answers.">
        <div className="grid gap-3 md:grid-cols-2">
          {evidence.map((item) => (
            <article key={item.id} className="rounded-2xl border border-border bg-surface/45 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Label value={item.label} />
                {item.category && <span className="text-xs text-faint">{item.category}</span>}
              </div>
              <p className="mt-3 text-sm leading-6 text-landing">{item.claim}</p>
              {(item.scope || item.signal) && (
                <p className="mt-2 text-xs text-muted">{[item.scope, item.signal].filter(Boolean).join(" · ")}</p>
              )}
              <Source path={item.source.path} section={item.source.section} />
            </article>
          ))}
        </div>
      </Section>

      <Section title="Market evidence" description="Demand signals and gaps guide targeting. They are internal-only and cannot become candidate claims.">
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-surface/70 text-xs uppercase tracking-wide text-faint">
              <tr><th className="px-4 py-3">Skill</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Mentions</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {marketSkills.map((item) => (
                <tr key={item.id} className="bg-surface/25">
                  <td className="px-4 py-3 font-medium text-landing">{item.skill}</td>
                  <td className="px-4 py-3 text-muted">{item.category}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">{item.mentions}</td>
                  <td className="px-4 py-3 text-muted">{item.currentEvidence}</td>
                  <td className="px-4 py-3"><Label value={item.label} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Voice references" description="Imported samples calibrate tone only; they never introduce factual claims.">
        <div className="grid gap-3 sm:grid-cols-2">
          {voiceReferences.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-surface/45 p-4">
              <p className="font-medium text-landing">{item.title}</p>
              <p className="mt-1 break-all text-xs text-muted">{item.importedPath}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Historical intelligence" description="Archived corpus roles and analyses remain inspectable but never count as active Opportunities or Applications.">
        {history.error ? (
          <Notice title="Career History needs attention">{history.error}</Notice>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {[...history.jobs, ...history.analyses].map((item) => (
              <details key={item.id} className="rounded-2xl border border-border bg-surface/45 p-4">
                <summary className="cursor-pointer font-medium text-landing">{item.company && item.role ? `${item.company} · ${item.role}` : item.title}</summary>
                <p className="mt-2 text-xs text-muted">{item.kind === "job" ? "Historical job record" : "Historical fit analysis"}{item.captured ? ` · ${item.captured}` : ""}</p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-background/60 p-3 text-xs leading-5 text-muted">{item.content}</pre>
                <p className="mt-2 break-all text-[11px] text-faint">Source: {item.source.path}</p>
              </details>
            ))}
          </div>
        )}
      </Section>

      <Section title="Import provenance" description="One-way source records retained for audit and reproducibility.">
        <div className="space-y-3">
          {sources.map((source) => (
            <div key={`${source.sourceRoot}-${source.fingerprint}`} className="rounded-2xl border border-border bg-surface/45 p-4 text-sm">
              <p className="font-medium text-landing">{source.kind}</p>
              <p className="mt-1 break-all text-xs text-muted">{source.sourceRoot}</p>
              <p className="mt-2 text-xs text-faint">Imported {formatDate(source.importedAt)} · fingerprint {source.fingerprint.slice(0, 12)}</p>
            </div>
          ))}
        </div>
      </Section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-2xl tracking-tight text-landing">Career Evidence</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">Your reviewed facts, market intelligence, and writing references in one auditable place.</p>
      {children}
    </main>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{title}</h2>
      <p className="mt-1 text-sm text-faint">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="rounded-2xl border border-border bg-surface/50 p-4"><div className="text-3xl font-semibold tabular-nums">{value}</div><div className="mt-1 text-xs text-faint">{label}</div></div>;
}

function Label({ value }: { value: CareerEvidenceLabel }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${LABEL_TONE[value]}`}>{value}</span>;
}

function Source({ path, section }: { path: string; section?: string }) {
  return <p className="mt-3 break-all text-[11px] text-faint">Source: {path}{section ? ` / ${section}` : ""}</p>;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-8 rounded-2xl border border-border bg-surface/50 p-6"><h2 className="font-medium text-landing">{title}</h2><p className="mt-2 text-sm leading-6 text-muted">{children}</p></div>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-surface px-1.5 py-0.5 text-xs text-landing">{children}</code>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}
