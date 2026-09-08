import { doctorState } from "@/lib/career-ops";
import { listRoles } from "@/lib/roles/server";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { FirstRunHome } from "@/components/home/first-run-home";
import { SaveJob } from "@/components/desk/save-job";
import { JobList } from "@/components/desk/job-list";

export const dynamic = "force-dynamic"; // always read the local files at request time

// The desk: save a link, pick a job. A truly empty install still gets the CV
// takeover first, because nothing can be scored without a CV.
export default async function Desk() {
  const { phase, onboardingNeeded } = doctorState();
  if (phase === "first-run") return <FirstRunHome />;
  const roles = await listRoles();
  return (
    <div className="mx-auto max-w-[640px] px-4 py-5 sm:py-8">
      {onboardingNeeded && <OnboardingBanner />}
      <h1 className="mb-3 text-[22px] font-semibold tracking-[-0.01em] text-ink sm:text-[28px]">Jobs</h1>
      <SaveJob />
      <JobList roles={roles} />
    </div>
  );
}
