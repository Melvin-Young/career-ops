import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import yaml from "js-yaml";
import {
  careerOpsRoot,
  findApplication,
  readCareerEvidence,
  readReport,
  rootScript,
  type Application,
  type CareerEvidenceItem,
} from "./career-ops";
import { composeArtifactDraft, type ArtifactKind } from "./artifact-draft";

type ArtifactMetadata = {
  kind: ArtifactKind;
  version: number;
  state: "draft" | "approved" | "superseded";
  provenance: string[];
  opportunityIdentity: string;
  sourceIdentity: string;
};

type ArtifactModule = {
  applicationArtifactPaths(input: { reportNum: string; company: string; role: string; root: string }): unknown;
  listArtifactVersions(paths: unknown, kind: ArtifactKind): ArtifactMetadata[];
  readArtifactVersion(paths: unknown, kind: ArtifactKind, version: number): { metadata: ArtifactMetadata; content: string };
  resolveApprovedArtifact(paths: unknown, kind: ArtifactKind): null | { metadata: ArtifactMetadata; content: string; paths: { pdf: string } };
  saveArtifactDraft(paths: unknown, input: Record<string, unknown>): ArtifactMetadata;
  approveArtifactVersion(paths: unknown, input: { kind: ArtifactKind; version: number }): ArtifactMetadata;
  exportApprovedArtifactToPdf(paths: unknown, kind: ArtifactKind): Promise<{ metadata: ArtifactMetadata; pdf: string }>;
};

type RoleArtifactContext = {
  app: Application;
  report: string;
  evidence: CareerEvidenceItem[];
  cv: string;
  fullName: string;
  opportunityIdentity: string;
  sourceIdentity: string;
  root: string;
};

function validateKind(value: unknown): ArtifactKind {
  if (value !== "resume" && value !== "cover-letter") throw new Error("kind must be resume or cover-letter");
  return value;
}

function fullNameFromProfile(root: string): string {
  const profile = path.join(root, "config", "profile.yml");
  if (!fs.existsSync(profile)) return "";
  try {
    const parsed = yaml.load(fs.readFileSync(profile, "utf8")) as { candidate?: { full_name?: unknown } } | null;
    return typeof parsed?.candidate?.full_name === "string" ? parsed.candidate.full_name.trim() : "";
  } catch {
    return "";
  }
}

async function artifactModule(): Promise<ArtifactModule> {
  return import(/* webpackIgnore: true */ pathToFileURL(rootScript("application-artifacts")).href) as Promise<ArtifactModule>;
}

function roleContext(n: string): RoleArtifactContext {
  if (!/^\d+$/.test(n)) throw new Error("numeric n is required");
  const app = findApplication(n);
  if (!app) throw new Error(`tracked role #${n} was not found`);
  const report = readReport(n)?.content ?? "";
  const evidenceResult = readCareerEvidence();
  if (evidenceResult.error) throw new Error(`Career Evidence cannot be read: ${evidenceResult.error}`);
  const evidence = evidenceResult.data?.evidence.filter((item) => (
    item.approval === "approved" && item.label === "Demonstrated" && item.outwardEligible === true
  )) ?? [];
  const root = careerOpsRoot();
  const cvPath = path.join(root, "cv.md");
  const cv = fs.existsSync(cvPath) ? fs.readFileSync(cvPath, "utf8") : "";
  const sourceIdentity = `career-profile:sha256:${createHash("sha256").update(JSON.stringify({ evidence, cv })).digest("hex")}`;
  const reportIdentity = createHash("sha256").update(report).digest("hex").slice(0, 16);
  const opportunityIdentity = `tracker:${n}:${app.company}:${app.role}:report:${reportIdentity}`;
  return { app, report, evidence, cv, fullName: fullNameFromProfile(root), opportunityIdentity, sourceIdentity, root };
}

function pathsFor(mod: ArtifactModule, n: string, context: RoleArtifactContext) {
  return mod.applicationArtifactPaths({ reportNum: n, company: context.app.company, role: context.app.role, root: path.join(context.root, "output") });
}

export async function listRoleArtifacts(n: string, kindValue: unknown) {
  const kind = validateKind(kindValue);
  const context = roleContext(n);
  const mod = await artifactModule();
  const paths = pathsFor(mod, n, context);
  const versions = mod.listArtifactVersions(paths, kind).map((metadata) => ({
    ...metadata,
    content: mod.readArtifactVersion(paths, kind, metadata.version).content,
  }));
  const approved = mod.resolveApprovedArtifact(paths, kind);
  return { kind, versions, approvedVersion: approved?.metadata.version ?? null, pdfReady: Boolean(approved?.paths.pdf && fs.existsSync(approved.paths.pdf)) };
}

export async function generateRoleArtifact(n: string, kindValue: unknown, longForm: boolean) {
  const kind = validateKind(kindValue);
  const context = roleContext(n);
  const mod = await artifactModule();
  const paths = pathsFor(mod, n, context);
  const draft = composeArtifactDraft(kind, context, longForm);
  return mod.saveArtifactDraft(paths, { kind, content: draft.content, opportunityIdentity: context.opportunityIdentity, sourceIdentity: context.sourceIdentity, provenance: draft.provenance });
}

export async function saveRoleArtifact(n: string, kindValue: unknown, content: unknown, provenanceValue: unknown, baseVersion: unknown) {
  const kind = validateKind(kindValue);
  const context = roleContext(n);
  const mod = await artifactModule();
  const paths = pathsFor(mod, n, context);
  const allowed = new Set(context.evidence.map((item) => item.id));
  const provenance = Array.isArray(provenanceValue) ? provenanceValue.filter((item): item is string => typeof item === "string" && allowed.has(item)) : [];
  return mod.saveArtifactDraft(paths, {
    kind,
    content: typeof content === "string" ? content : "",
    opportunityIdentity: context.opportunityIdentity,
    sourceIdentity: context.sourceIdentity,
    provenance,
    baseVersion: baseVersion ?? null,
  });
}

export async function approveRoleArtifact(n: string, kindValue: unknown, version: unknown) {
  const kind = validateKind(kindValue);
  const context = roleContext(n);
  const mod = await artifactModule();
  return mod.approveArtifactVersion(pathsFor(mod, n, context), { kind, version: Number(version) });
}

export async function exportRoleArtifact(n: string, kindValue: unknown) {
  const kind = validateKind(kindValue);
  const context = roleContext(n);
  const mod = await artifactModule();
  const exported = await mod.exportApprovedArtifactToPdf(pathsFor(mod, n, context), kind);
  return { version: exported.metadata.version, download: `/api/artifacts/pdf?n=${n}&kind=${kind}` };
}

export async function readRoleArtifactPdf(n: string, kindValue: unknown) {
  const kind = validateKind(kindValue);
  const context = roleContext(n);
  const mod = await artifactModule();
  const approved = mod.resolveApprovedArtifact(pathsFor(mod, n, context), kind);
  if (!approved || !fs.existsSync(approved.paths.pdf)) return null;
  return { bytes: fs.readFileSync(approved.paths.pdf), kind, version: approved.metadata.version };
}
