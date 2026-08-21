import { notFound } from "next/navigation";
import { readReport, findApplication } from "@/lib/career-ops";
import { ApplicationWorkspace } from "@/components/application-workspace";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const app = findApplication(id);
  const report = readReport(id);
  if (!app && !report) notFound();
  const allowed = new Set(["fit", "resume", "cover", "activity"]);
  const view = allowed.has(query.view ?? "") ? query.view as "fit" | "resume" | "cover" | "activity" : "fit";
  return <ApplicationWorkspace id={id} app={app} report={report?.content ?? null} view={view} />;
}
