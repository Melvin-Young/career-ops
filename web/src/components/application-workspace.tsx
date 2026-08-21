import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { type Application, readRoleActivity, readStatusHistory } from "@/lib/career-ops";
import { trackedRoleKind } from "@/lib/tracked-role";
import { legitimacyTone, parseReport, scoreTone } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { CompanyLogo } from "@/components/company-logo";
import { StatusSelect } from "@/components/status-select";
import { GeneratePdfButton } from "@/components/generate-pdf-button";
import { ApplyButton } from "@/components/apply-button";
import { ReportView } from "@/components/report-view";
import { ArtifactWorkspace } from "@/components/artifact-workspace";

type View = "fit" | "resume" | "cover" | "activity";

export function ApplicationWorkspace({ id, app, report, view }: { id: string; app: Application | null; report: string | null; view: View }) {
  const meta = report ? parseReport(report) : null;
  const field = (label: string) => meta?.fields.find((item) => item.label === label)?.value;
  const company = app?.company ?? meta?.title ?? `Role #${id}`;
  const role = app?.role ?? field("Role") ?? "Tracked role";
  const score = app?.score || field("Score");
  const url = field("URL");
  const history = readStatusHistory(id);
  const roleActivity = app ? readRoleActivity(app) : [];
  const tabs: Array<{ key: View; label: string }> = [{ key: "fit", label: "Fit" }, { key: "resume", label: "Resume" }, { key: "cover", label: "Cover Letter" }, { key: "activity", label: "Activity" }];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 max-sm:pb-24">
      <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand"><ArrowLeft className="size-4" /> Pipeline</Link>
      <header className="mt-5">
        <div className="flex items-start gap-3">
          <CompanyLogo name={company} size={42} />
          <div><p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">#{id} · {app ? trackedRoleKind(app.status, history.flatMap((entry) => [entry.from, entry.to])) : "Opportunity"}</p><h1 className="mt-1 font-display text-3xl tracking-tight text-landing">{company}</h1><p className="mt-1 text-muted">{role}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {score && <Badge tone={scoreTone(score)}>{score}</Badge>}
          {meta?.legitimacy && <Badge tone={legitimacyTone(meta.legitimacy)}>{meta.legitimacy}</Badge>}
          {app && <StatusSelect n={id} current={app.status} />}
          <GeneratePdfButton n={id} company={company} pdfReady={(app?.pdf ?? "").includes("✅")} />
          <ApplyButton n={id} url={url?.startsWith("http") ? url : undefined} company={company} pdfReady={(app?.pdf ?? "").includes("✅")} />
          {url?.startsWith("http") && <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">posting <ExternalLink className="size-3" /></a>}
        </div>
      </header>

      <nav className="mt-7 flex gap-1 border-b border-border" aria-label="Application workspace">
        {tabs.map((tab) => <Link key={tab.key} href={`/pipeline/${id}?view=${tab.key}`} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${view === tab.key ? "border-brand text-foreground" : "border-transparent text-muted hover:text-foreground"}`}>{tab.label}</Link>)}
      </nav>

      <div className="mt-7">
        {view === "fit" && <ReportView id={id} app={app} report={report} embedded />}
        {view === "resume" && app && <ArtifactWorkspace n={id} kind="resume" />}
        {view === "cover" && app && <ArtifactWorkspace n={id} kind="cover-letter" />}
        {(view === "resume" || view === "cover") && !app && <Empty text="Add this report to the tracker before creating application artifacts." />}
        {view === "activity" && (
          <section>
            <h2 className="font-display text-xl text-landing">Activity</h2>
            <p className="mt-1 text-sm text-muted">Current state: <strong className="text-foreground">{app?.status ?? "Report only"}</strong></p>
            <div className="mt-5 space-y-3">
              {history.length ? history.map((entry, index) => <div key={`${entry.date}-${index}`} className="rounded-2xl border border-border bg-surface/40 p-4"><div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium text-landing">{entry.from} → {entry.to}</span><span className="text-xs text-faint">{entry.date} · {entry.source}</span></div>{entry.note && <p className="mt-2 text-sm text-muted">{entry.note}</p>}</div>) : <Empty text={app ? `No transition ledger entries yet. The current tracker state is ${app.status}.` : "No tracker or status history exists for this report."} />}
            </div>
            <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Follow-ups, replies, interviews, and exports</h3>
            <div className="mt-3 space-y-3">
              {roleActivity.length ? roleActivity.map((entry, index) => <div key={`${entry.kind}-${entry.date}-${index}`} className="rounded-2xl border border-border bg-surface/40 p-4"><div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium capitalize text-landing">{entry.kind}: {entry.title}</span>{entry.date && <span className="text-xs text-faint">{entry.date}</span>}</div>{entry.detail && <p className="mt-2 text-sm text-muted">{entry.detail}</p>}</div>) : <Empty text="No follow-ups, matched replies, interviews, or artifact exports are recorded for this role yet." />}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-8 text-center text-sm text-muted">{text}</div>;
}
