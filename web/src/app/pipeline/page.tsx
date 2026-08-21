import { Suspense } from "react";
import { pipelineSummary, readStatusHistory } from "@/lib/career-ops";
import { PipelineView } from "@/components/pipeline-view";

export const dynamic = "force-dynamic"; // always read fresh local files

export default function PipelinePage() {
  const { inbox, applications } = pipelineSummary();
  const lifecycleStatuses = Object.fromEntries(applications.map((app) => [
    app.n,
    readStatusHistory(app.n).flatMap((entry) => [entry.from, entry.to]),
  ]));
  return (
    <Suspense>
      <PipelineView applications={applications} inbox={inbox} lifecycleStatuses={lifecycleStatuses} />
    </Suspense>
  );
}
