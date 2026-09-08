import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { readJdCapture, resolveRole } from "@/lib/roles/server";
import { shortDate } from "@/lib/roles/state.mjs";
import { Spine, Stop } from "@/components/packet/spine";
import { FitSection } from "@/components/packet/fit-section";
import { PreparePacket } from "@/components/packet/prepare-packet";
import { ArtifactPanel } from "@/components/packet/artifact-panel";
import { AnswersPanel } from "@/components/packet/answers-panel";
import { AppliedStamp, PacketActions } from "@/components/packet/packet-actions";
import { StatusSelect } from "@/components/status-select";

export const dynamic = "force-dynamic";

// One job and its packet. The id is a tracker number or a saved link's key;
// a saved link that gained a row is sent to the row so both entrances land
// on the same record.
export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await resolveRole(id);
  if (!role) notFound();
  if (role.redirectTo) redirect(`/role/${role.redirectTo}`);

  const jd = readJdCapture(role.jdFile);
  const submitted = role.segments.includes("applied");
  const hasFit = Boolean(role.fit);
  const resume = role.artifacts.resume;
  const cover = role.artifacts.cover;
  const artifactDetail = (a: typeof resume) =>
    !a || a.versions === 0 ? null : a.approvedVersion != null ? `v${a.approvedVersion} approved${a.pdfReady ? ", PDF ready" : ""}` : `draft v${a.latestVersion}`;

  return (
    <div className="mx-auto max-w-[880px] px-4 py-4 sm:py-8">
      <Link href="/" className="inline-flex min-h-[44px] items-center gap-1 text-[15px] text-graphite hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> Jobs
      </Link>

      {submitted && (
        <p className="mt-2 rounded-md bg-stamp-soft px-3 py-2 text-[14px] text-stamp">
          {role.stateLabel}. {role.trackerN && `Tracker row ${role.trackerN}.`}
        </p>
      )}

      <header className="mt-3">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink [overflow-wrap:anywhere] sm:text-[28px]">{role.title}</h1>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[15px]">
          <span className="font-medium text-ink">{role.company}</span>
          {role.location && <span className="text-graphite">{role.location}</span>}
          {role.pay && <span className="text-graphite">{role.pay}</span>}
          {!role.location && !role.pay && <span className="text-graphite">Location and pay not stated</span>}
        </p>
        <PacketActions id={role.id} url={role.url} company={role.company} title={role.title} appliedOn={role.appliedOn} appliedVia={role.appliedVia} />
      </header>

      <Spine>
        <Stop label="Saved" detail={role.savedAt ? shortDate(role.savedAt) : role.date ? shortDate(role.date) : null} state="done">
          <dl className="grid gap-0.5 text-[14px]">
            <div className="flex flex-wrap items-center gap-x-2">
              <dt className="text-graphite">Source</dt>
              <dd className="min-w-0 [overflow-wrap:anywhere]">{role.url ? <a href={role.url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-[44px] items-center text-pen underline underline-offset-2">{role.url}</a> : "no link"}</dd>
            </div>
            {role.employerUrl && (
              <div className="flex flex-wrap items-center gap-x-2">
                <dt className="text-graphite">Employer</dt>
                <dd className="min-w-0 [overflow-wrap:anywhere]"><a href={role.employerUrl} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-[44px] items-center text-pen underline underline-offset-2">{role.employerUrl}</a></dd>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-2">
              <dt className="text-graphite">Page</dt>
              <dd className={role.unverified ? "text-caution" : ""}>{role.unverified ? "not read when saved; details typed by you" : hasFit && role.fit?.verification ? `verification: ${role.fit.verification}` : "read when saved; not yet verified as open"}</dd>
            </div>
            {role.trackerN && (
              <div className="flex flex-wrap items-center gap-x-2">
                <dt className="text-graphite">Tracker</dt>
                <dd className="flex items-center gap-2">row {role.trackerN} <StatusSelect n={role.trackerN} current={role.trackerStatus ?? "Evaluated"} /></dd>
              </div>
            )}
          </dl>
          {jd && (
            <details className="mt-2">
              <summary className="min-h-[44px] cursor-pointer list-none py-2 text-[15px] font-medium text-pen">Pasted description</summary>
              <pre className="whitespace-pre-wrap rounded-md bg-sheet p-3 text-[14px] leading-relaxed text-ink">{jd}</pre>
            </details>
          )}
        </Stop>

        <Stop label="Fit" detail={hasFit ? (role.score ? role.score.replace(/\/5$/, " of 5") : "evaluated") : "not evaluated"} state={hasFit ? "done" : "open"}>
          {role.fit ? <FitSection fit={role.fit} belowApplyLine={role.belowApplyLine} /> : <PreparePacket id={role.id} url={role.url} title={role.title} company={role.company} />}
        </Stop>

        <Stop label="Resume" detail={artifactDetail(resume) ?? (role.trackerN ? "no draft" : null)} state={resume?.approvedVersion != null ? "done" : resume?.versions ? "open" : "todo"}>
          {role.trackerN ? <ArtifactPanel n={role.trackerN} kind="resume" label="Resume" belowApplyLine={role.belowApplyLine} /> : <Held />}
        </Stop>

        <Stop label="Cover letter" detail={artifactDetail(cover) ?? (role.trackerN ? "optional" : null)} state={cover?.approvedVersion != null ? "done" : cover?.versions ? "open" : "todo"}>
          {role.trackerN ? <ArtifactPanel n={role.trackerN} kind="cover-letter" label="Cover letter" belowApplyLine={role.belowApplyLine} /> : <Held />}
        </Stop>

        <Stop label="Answers" detail={role.answers.length ? `${role.answers.length} reviewed` : role.drafts.length ? `${role.drafts.length} draft${role.drafts.length === 1 ? "" : "s"} to review` : null} state={role.answers.length ? "done" : role.drafts.length ? "open" : "todo"}>
          <AnswersPanel n={role.trackerN} drafts={role.drafts} answers={role.answers} />
        </Stop>

        <Stop label="Applied" detail={submitted ? null : "not recorded"} state={submitted ? "applied" : "todo"} last>
          <AppliedStamp trackerN={role.trackerN} appliedOn={role.appliedOn} appliedVia={role.appliedVia} />
          {role.history.length > 0 && (
            <ol className="mt-3 divide-y divide-rule rounded-lg bg-sheet shadow-[0_1px_0_var(--rule)]">
              {role.history.map((h, i) => (
                <li key={`${h.date}-${i}`} className="px-3 py-2 text-[14px]">
                  <span className="text-ink">{h.from === "Unknown" ? "Recorded as" : `${h.from} to`} {h.to}</span>
                  <span className="ml-2 text-graphite">{h.date}, {h.source}</span>
                  {h.note && <span className="block text-graphite">{h.note}</span>}
                </li>
              ))}
            </ol>
          )}
          {role.activity.length > 0 && (
            <ul className="mt-3 divide-y divide-rule rounded-lg bg-sheet shadow-[0_1px_0_var(--rule)]">
              {role.activity.map((a, i) => (
                <li key={`${a.kind}-${i}`} className="px-3 py-2 text-[14px]">
                  <span className="text-ink">{a.title}</span>
                  {a.date && <span className="ml-2 text-graphite">{a.date.slice(0, 10)}</span>}
                  {a.detail && <span className="block text-graphite [overflow-wrap:anywhere]">{a.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </Stop>
      </Spine>
    </div>
  );
}

function Held() {
  return <p className="text-[14px] text-graphite">Available once the packet is prepared.</p>;
}
