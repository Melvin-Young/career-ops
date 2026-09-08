"use client";

import { AssistantConsole } from "@/components/assistant-console";
import { JobsProvider } from "@/components/jobs/job-store";
import { PipelineProvider } from "@/components/pipeline/pipeline-provider";
import { ApplyProvider } from "@/components/apply/apply-provider";
import { ExploreProvider } from "@/components/explore/explore-provider";
import { TopBar } from "@/components/shell/top-bar";

// The shell is one top bar and the page. Providers stay: the worker store,
// pipeline snapshot, assisted-apply session and explore state are shared by
// the secondary tools and by the packet's Prepare action.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <JobsProvider>
      <PipelineProvider>
        <ApplyProvider>
          <ExploreProvider>
            <TopBar />
            <main className="min-h-[calc(100dvh-3.5rem)] overflow-x-hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
              {children}
            </main>
            <AssistantConsole />
          </ExploreProvider>
        </ApplyProvider>
      </PipelineProvider>
    </JobsProvider>
  );
}
