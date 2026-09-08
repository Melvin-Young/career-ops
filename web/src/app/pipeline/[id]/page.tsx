import { redirect } from "next/navigation";

// Old report links (`/pipeline/{n}`) open the same role's packet.
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/role/${encodeURIComponent(id)}`);
}
