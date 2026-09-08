#!/usr/bin/env node
// Assemble an isolated career-ops root for the desk's browser run.
//
//   node web/tests/fixtures/build-mobile-root.mjs <targetDir>
//
// The target receives a COPY of the system layer (root scripts, lib/,
// templates/, providers/, modes/ minus the personal files, tracker-aliases.json)
// so every core writer resolves its own directory as the root, a node_modules
// symlink so those scripts can import their dependencies, and the fictional
// user layer under web/tests/fixtures/mobile. Nothing here touches the real
// workspace; the target is the only thing written.
//
// Artifact versions for tracker row 1 (draft v1 → approved v1 with a PDF →
// newer draft v2; a cover-letter draft v1) are produced through
// application-artifacts.mjs itself, never hand-written.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../../..");
const FIXTURE = join(here, "mobile");
const PERSONAL_MODES = new Set(["_profile.md", "_custom.md", "_brief.md"]);

export async function buildMobileRoot(target) {
  if (!target) throw new Error("targetDir is required");
  target = resolve(target);
  if (target === REPO || REPO.startsWith(target + "/")) throw new Error("refusing to build inside the repository");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  for (const name of readdirSync(REPO)) {
    if (name.endsWith(".mjs") || name === "tracker-aliases.json" || name === "package.json" || name === "VERSION") {
      cpSync(join(REPO, name), join(target, name));
    }
  }
  for (const dir of ["lib", "templates", "providers", "plugins", "plugins-registry"]) {
    if (existsSync(join(REPO, dir))) cpSync(join(REPO, dir), join(target, dir), { recursive: true });
  }
  cpSync(join(REPO, "modes"), join(target, "modes"), { recursive: true, filter: (src) => !PERSONAL_MODES.has(src.split("/").pop()) });
  mkdirSync(join(target, "batch"), { recursive: true });
  cpSync(join(REPO, "batch", "batch-prompt.md"), join(target, "batch", "batch-prompt.md"));
  symlinkSync(join(REPO, "node_modules"), join(target, "node_modules"), "dir");
  for (const dir of ["output", "jds", "reports", "data", "batch/tracker-additions"]) mkdirSync(join(target, dir), { recursive: true });

  cpSync(FIXTURE, target, { recursive: true });
  writeFileSync(join(target, "reports", ".gitkeep"), "");

  const artifacts = await import(pathToFileURL(join(target, "application-artifacts.mjs")).href);
  const paths = artifacts.applicationArtifactPaths({ reportNum: "1", company: "Acme Corp", role: "Senior Platform Engineer", root: join(target, "output") });
  const identity = { opportunityIdentity: "tracker:1:Acme Corp:Senior Platform Engineer:report:fixture", sourceIdentity: "career-profile:sha256:fixture" };
  artifacts.saveArtifactDraft(paths, { kind: "resume", content: RESUME_V1, provenance: ["evidence-fixture-0001", "evidence-fixture-0003"], ...identity });
  artifacts.approveArtifactVersion(paths, { kind: "resume", version: 1 });
  await artifacts.exportApprovedArtifactToPdf(paths, "resume");
  artifacts.saveArtifactDraft(paths, { kind: "resume", content: RESUME_V2, provenance: ["evidence-fixture-0001", "evidence-fixture-0002", "evidence-fixture-0003"], baseVersion: 1, ...identity });
  artifacts.saveArtifactDraft(paths, { kind: "cover-letter", content: COVER_V1, provenance: ["evidence-fixture-0001"], ...identity });

  return target;
}

const RESUME_V1 = `Jordan Reyes
Platform Engineer

Summary
Platform engineer with 7 years building CI/CD and internal tooling for mid-size SaaS teams.

Role-specific evidence
- Designed a reusable CI workflow library adopted by 14 product teams, taking deploy lead time from 45 to 14 minutes
- Led the migration of more than 200 repositories to trunk-based development, cutting change-failure rate by 31%
`;

const RESUME_V2 = `${RESUME_V1}- Ran a Kubernetes platform on EKS serving 40 microservices at 99.95% availability over three years
`;

const COVER_V1 = `Dear Acme Corp team,

I'm applying for the Senior Platform Engineer role. Your new platform group is being formed to own golden paths across 200 repositories, which is the shape of the problem I solved with a workflow library adopted by 14 teams.

Best,
Jordan Reyes
`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildMobileRoot(process.argv[2])
    .then((dir) => {
      console.log(dir);
    })
    .catch((error) => {
      console.error(`build-mobile-root: ${error.message}`);
      process.exit(1);
    });
}

export { existsSync };
