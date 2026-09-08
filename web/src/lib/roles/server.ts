import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as yaml from "js-yaml";
import {
  careerOpsRoot,
  findApplication,
  readApplications,
  readInbox,
  readReport,
  readRoleActivity,
  readStatusHistory,
  rootScript,
  type Application,
  type InboxJob,
  type RoleActivityEntry,
  type StatusHistoryEntry,
} from "@/lib/career-ops";
import { atomicWrite } from "@/lib/core/safe-write";
import { addOffersToPipeline } from "@/lib/core/pipeline";
import { normalizeUrl } from "@/lib/core/url-key.mjs";
import { parseReport } from "@/lib/format";
import { splitSections, cleanHeading } from "@/lib/report-sections.mjs";
import { listRoleArtifacts } from "@/lib/artifact-service";
import { interpretSetStatus, runSetStatus, setStatusScriptAvailable, type SetStatusOutcome } from "@/lib/set-status-runner";
import { roleKeyForUrl, isTrackerId, isUrlKey } from "./identity.mjs";
import { planSave, isSaveableUrl } from "./save-plan.mjs";
import { extractPostingMetadata, isBoardHost, type PostingMetadata } from "./metadata.mjs";
import { formatSaveNote, parseSaveNote } from "./note.mjs";
import { compareRoles, deriveRoleState, segmentsFor, stateLabel, type RoleState, type Segment } from "./state.mjs";
import { readDraftAnswers, type DraftAnswer } from "./answer-drafts.mjs";

// The desk's server operations. Every write goes through a canonical core
// writer (scan.mjs appendToPipeline, set-status.mjs, merge-tracker.mjs,
// application-answers.mjs); this file composes them and reads them back. It
// is also the surface a Telegram/Hermes bridge would call — one function per
// user intent, no HTTP assumptions.

export type RoleSummary = {
  id: string;
  kind: "opportunity" | "application";
  title: string;
  company: string;
  location: string | null;
  pay: string | null;
  url: string;
  employerUrl: string | null;
  state: RoleState;
  stateLabel: string;
  segments: Segment[];
  score: string | null;
  date: string | null;
  unverified: boolean;
  trackerN: string | null;
  trackerStatus: string | null;
  appliedOn: string | null;
  appliedVia: string | null;
};

export type ArtifactSummary = {
  latestVersion: number | null;
  latestState: "draft" | "approved" | "superseded" | null;
  approvedVersion: number | null;
  pdfReady: boolean;
  versions: number;
};

export type FitSummary = {
  score: string | null;
  decision: string | null;
  verdict: string | null;
  strengths: string[];
  gaps: string[];
  hardStops: string[];
  riskLevel: string | null;
  legitimacy: string | null;
  verification: string | null;
  advertisedComp: string | null;
  nextAction: string | null;
  sections: Array<{ heading: string; content: string }>;
  file: string;
};

export type ReviewedAnswer = { question: string; answer: string };

export type RoleDetail = RoleSummary & {
  redirectTo?: string;
  note: ReturnType<typeof parseSaveNote>;
  jdFile: string | null;
  savedAt: string | null;
  fit: FitSummary | null;
  artifacts: { resume: ArtifactSummary | null; cover: ArtifactSummary | null };
  drafts: DraftAnswer[];
  answers: ReviewedAnswer[];
  history: StatusHistoryEntry[];
  activity: RoleActivityEntry[];
  belowApplyLine: boolean;
};

const APPLY_LINE = 4.0;

// ── reading ────────────────────────────────────────────────────────────────

function trackerUrl(app: Application): string {
  if (app.url && /^https?:\/\//i.test(app.url)) return app.url;
  const fromNotes = app.notes.match(/https?:\/\/[^\s|)]+/)?.[0];
  if (fromNotes) return fromNotes;
  const report = readReport(app.n);
  if (!report) return "";
  const url = parseReport(report.content).fields.find((f) => f.label === "URL")?.value ?? "";
  return /^https?:\/\//i.test(url) ? url : "";
}

// The date comes from the ledger (set-status.mjs appends one line per real
// transition, dated by --on); the platform comes from the tracker's Notes
// cell, where --note lands. Neither is guessed from the row's Date column.
function appliedFacts(app: Application, history: StatusHistoryEntry[]): { appliedOn: string | null; appliedVia: string | null } {
  const entry = [...history].reverse().find((h) => /applied/i.test(h.to));
  const via = `${app.notes} ${entry?.note ?? ""}`.match(/applied via ([^;|]+)/i)?.[1]?.trim() ?? null;
  return { appliedOn: entry?.date ?? null, appliedVia: via };
}

function scoreOf(app: Application | null, reportContent: string | null): string | null {
  const raw = app?.score || (reportContent ? parseReport(reportContent).fields.find((f) => f.label === "Score")?.value : null) || null;
  if (!raw || /^(N\/A|—|-)$/.test(raw.trim())) return null;
  return raw.replace(/\*\*/g, "").trim();
}

async function artifactSummary(n: string, kind: "resume" | "cover-letter"): Promise<ArtifactSummary | null> {
  try {
    const listed = await listRoleArtifacts(n, kind);
    const latest = listed.versions[0] ?? null;
    return {
      latestVersion: latest?.version ?? null,
      latestState: latest?.state ?? null,
      approvedVersion: listed.approvedVersion,
      pdfReady: listed.pdfReady,
      versions: listed.versions.length,
    };
  } catch {
    return null;
  }
}

async function summarizeTracked(app: Application): Promise<RoleSummary> {
  const report = readReport(app.n);
  const history = readStatusHistory(app.n);
  const resume = await artifactSummary(app.n, "resume");
  const state = deriveRoleState({
    trackerStatus: app.status,
    hasReport: Boolean(report),
    approvedResume: resume?.approvedVersion != null,
    lifecycle: history.flatMap((h) => [h.from, h.to]),
  });
  const score = scoreOf(app, report?.content ?? null);
  const { appliedOn, appliedVia } = appliedFacts(app, history);
  const inboxTwin = readInbox().find((j) => normalizeUrl(j.url) && normalizeUrl(j.url) === normalizeUrl(trackerUrl(app)));
  const note = parseSaveNote(inboxTwin?.note ?? app.notes);
  return {
    id: app.n,
    kind: segmentsFor(state).includes("applied") ? "application" : "opportunity",
    title: app.role,
    company: app.company,
    location: inboxTwin?.location ?? null,
    pay: inboxTwin?.compensation ?? note.pay ?? null,
    url: trackerUrl(app),
    employerUrl: note.employerUrl,
    state,
    stateLabel: stateLabel(state, { score, unverified: false, date: appliedOn, platform: appliedVia }),
    segments: segmentsFor(state),
    score,
    date: app.date || null,
    unverified: false,
    trackerN: app.n,
    trackerStatus: app.status,
    appliedOn,
    appliedVia,
  };
}

function summarizeSaved(job: InboxJob): RoleSummary | null {
  const id = roleKeyForUrl(job.url);
  if (!id) return null;
  const note = parseSaveNote(job.note);
  const state = deriveRoleState({});
  return {
    id,
    kind: "opportunity",
    title: job.role,
    company: job.company,
    location: job.location ?? null,
    pay: job.compensation ?? note.pay ?? null,
    url: job.url,
    employerUrl: note.employerUrl,
    state,
    stateLabel: stateLabel(state, { unverified: note.unverified }),
    segments: segmentsFor(state),
    score: null,
    date: job.postedAt ?? null,
    unverified: note.unverified,
    trackerN: null,
    trackerStatus: null,
    appliedOn: null,
    appliedVia: null,
  };
}

/** Every role the desk knows: tracker rows first, then saved links that have no row yet. */
export async function listRoles(): Promise<RoleSummary[]> {
  const apps = readApplications();
  const tracked = await Promise.all(apps.map(summarizeTracked));
  const known = new Set(tracked.map((r) => normalizeUrl(r.url)).filter(Boolean));
  const seen = new Set<string>();
  const saved: RoleSummary[] = [];
  for (const job of readInbox()) {
    if (job.done) continue;
    const key = normalizeUrl(job.url);
    if (!key || seen.has(key) || known.has(key)) continue;
    seen.add(key);
    const summary = summarizeSaved(job);
    if (summary) saved.push(summary);
  }
  return [...tracked, ...saved].sort(compareRoles);
}

function machineSummary(content: string): Record<string, unknown> {
  const fence = content.match(/## Machine Summary\s*\n+```ya?ml\n([\s\S]*?)```/i)?.[1];
  if (!fence) return {};
  try {
    const parsed = yaml.load(fence);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : [];
}

function stringOr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : null;
}

function fitSummary(reportContent: string, file: string, score: string | null): FitSummary {
  const meta = parseReport(reportContent);
  const machine = machineSummary(reportContent);
  const verification = reportContent.match(/^\s*\*\*Verification:\*\*\s*(.+)$/im)?.[1]?.trim() ?? null;
  const { sections } = splitSections(meta.body);
  const verdictSection = sections.find((s) => s.letter === "F");
  const shown = sections
    .filter((s) => !/machine summary|application answers|cover letter draft|keywords extracted|draft application answers/i.test(s.heading))
    .map((s) => ({ heading: cleanHeading(s.heading), content: s.content }));
  return {
    score: score ?? stringOr(machine.score),
    decision: stringOr(machine.final_decision),
    verdict: verdictSection?.content.trim() || null,
    strengths: stringList(machine.top_strengths),
    gaps: stringList(machine.soft_gaps),
    hardStops: stringList(machine.hard_stops),
    riskLevel: stringOr(machine.risk_level),
    legitimacy: meta.legitimacy ?? stringOr(machine.legitimacy_tier),
    verification,
    advertisedComp: stringOr(machine.advertised_comp),
    nextAction: stringOr(machine.next_action),
    sections: shown,
    file,
  };
}

type AnswersModule = {
  parseApplicationAnswersSection(text: string): { date: string; state: string; freeText: Array<{ question?: string; answer?: string }> } | null;
  upsertApplicationAnswersSection(text: string, snapshot: Record<string, unknown>): string;
};

async function answersModule(): Promise<AnswersModule | null> {
  const file = rootScript("application-answers");
  if (!fs.existsSync(file)) return null;
  return import(/* webpackIgnore: true */ pathToFileURL(file).href) as Promise<AnswersModule>;
}

async function readReviewedAnswers(reportContent: string): Promise<ReviewedAnswer[]> {
  const mod = await answersModule();
  if (!mod) return [];
  try {
    const parsed = mod.parseApplicationAnswersSection(reportContent);
    return (parsed?.freeText ?? [])
      .map((e) => ({ question: String(e.question ?? "").trim(), answer: String(e.answer ?? "").trim() }))
      .filter((e) => e.question);
  } catch {
    return [];
  }
}

/**
 * The full packet for one role id. `redirectTo` is set when a saved link has
 * since gained a tracker row: the caller should send the client to that id so
 * the URL identity and the canonical id stay one record.
 */
export async function resolveRole(id: string): Promise<RoleDetail | null> {
  if (isTrackerId(id)) {
    const app = findApplication(id);
    if (!app) return null;
    const summary = await summarizeTracked(app);
    const report = readReport(app.n);
    const cover = await artifactSummary(app.n, "cover-letter");
    const resume = await artifactSummary(app.n, "resume");
    const fit = report ? fitSummary(report.content, report.file, summary.score) : null;
    const inboxTwin = readInbox().find((j) => normalizeUrl(j.url) === normalizeUrl(summary.url));
    const note = parseSaveNote(inboxTwin?.note ?? app.notes);
    const numeric = summary.score ? parseFloat(summary.score) : NaN;
    return {
      ...summary,
      note,
      jdFile: note.jd,
      savedAt: inboxTwin?.postedAt ?? app.date ?? null,
      fit,
      artifacts: { resume, cover },
      drafts: report ? readDraftAnswers(report.content).drafts : [],
      answers: report ? await readReviewedAnswers(report.content) : [],
      history: readStatusHistory(app.n),
      activity: readRoleActivity(app),
      belowApplyLine: Number.isFinite(numeric) && numeric < APPLY_LINE,
    };
  }
  if (!isUrlKey(id)) return null;
  const job = readInbox().find((j) => !j.done && roleKeyForUrl(j.url) === id);
  if (!job) return null;
  const twin = readApplications().find((a) => normalizeUrl(trackerUrl(a)) === normalizeUrl(job.url));
  const summary = summarizeSaved(job);
  if (!summary) return null;
  if (twin) return { ...summary, redirectTo: twin.n, note: parseSaveNote(job.note), jdFile: null, savedAt: null, fit: null, artifacts: { resume: null, cover: null }, drafts: [], answers: [], history: [], activity: [], belowApplyLine: false };
  const note = parseSaveNote(job.note);
  return {
    ...summary,
    note,
    jdFile: note.jd,
    savedAt: job.postedAt ?? null,
    fit: null,
    artifacts: { resume: null, cover: null },
    drafts: [],
    answers: [],
    history: [],
    activity: [],
    belowApplyLine: false,
  };
}

/** Read a pasted description saved beside the role (`local:jds/…`). */
export function readJdCapture(ref: string | null): string | null {
  if (!ref) return null;
  const rel = ref.replace(/^local:/, "");
  if (!/^jds\/[^/]+\.md$/.test(rel)) return null;
  const file = path.join(careerOpsRoot(), rel);
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

// ── saving ─────────────────────────────────────────────────────────────────

export type SavePreview =
  | { ok: false; error: string }
  | { ok: true; existing: "tracker" | "inbox"; id: string; record: { company: string; title: string } }
  | { ok: true; existing: null; id: string; url: string; readable: boolean; board: boolean; metadata: PostingMetadata; reason: string | null };

const FETCH_TIMEOUT_MS = 8_000;
const FETCH_MAX_BYTES = 1_500_000;

async function fetchPage(url: string): Promise<{ html: string | null; reason: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) return { html: null, reason: `The page answered ${res.status}` };
    const type = res.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(type)) return { html: null, reason: "The link is not a web page" };
    const text = (await res.text()).slice(0, FETCH_MAX_BYTES);
    return { html: text, reason: null };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { html: null, reason: aborted ? "The page took too long to answer" : "The page could not be reached" };
  } finally {
    clearTimeout(timer);
  }
}

function savePlan(url: string) {
  return planSave({
    url,
    inbox: readInbox().filter((j) => !j.done),
    tracker: readApplications().map((a) => ({ n: a.n, url: trackerUrl(a), company: a.company, role: a.role })),
  });
}

/** Phase one of a save: is it new, and what does the page state about itself? Writes nothing. */
export async function previewSave(rawUrl: unknown): Promise<SavePreview> {
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!isSaveableUrl(url)) return { ok: false, error: "Paste a full link that starts with http:// or https://" };
  const plan = savePlan(url);
  if (plan.existing && plan.id && plan.record) return { ok: true, existing: plan.existing, id: plan.id, record: plan.record };
  const { html, reason } = await fetchPage(url);
  const metadata = html ? extractPostingMetadata(html, url) : extractPostingMetadata("", url);
  const readable = Boolean(html) && Boolean(metadata.title || metadata.company);
  return {
    ok: true,
    existing: null,
    id: plan.id ?? roleKeyForUrl(url) ?? "",
    url,
    readable,
    board: isBoardHost(url),
    metadata,
    reason: readable ? null : reason ?? (html ? "The page did not state a job title" : null),
  };
}

export type SaveInput = {
  url: unknown;
  company?: unknown;
  title?: unknown;
  location?: unknown;
  pay?: unknown;
  salary?: unknown;
  employerUrl?: unknown;
  description?: unknown;
  unverified?: unknown;
};

export type SaveResult = { ok: true; id: string; existing: "tracker" | "inbox" | null; jd: string | null } | { ok: false; error: string };

function slug(value: string, fallback: string): string {
  const s = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || fallback;
}

function writeJdCapture(company: string, title: string, url: string, description: string): string {
  const dir = path.join(careerOpsRoot(), "jds");
  fs.mkdirSync(dir, { recursive: true });
  const base = `${slug(company, "company")}-${slug(title, "role")}`;
  let name = `${base}.md`;
  for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${base}-${i}.md`;
  const body = `# ${title} — ${company}\n\n**URL:** ${url}\n**Saved:** ${new Date().toISOString().slice(0, 10)}\n**Source:** pasted by the user from the desk; not verified against the live page\n\n---\n\n${description.trim()}\n`;
  atomicWrite(path.join(dir, name), body);
  return `local:jds/${name}`;
}

/** Phase two: write the saved job through the core's pipeline writers. Idempotent on the URL. */
export async function commitSave(input: SaveInput): Promise<SaveResult> {
  const url = typeof input.url === "string" ? input.url.trim() : "";
  if (!isSaveableUrl(url)) return { ok: false, error: "Paste a full link that starts with http:// or https://" };
  const plan = savePlan(url);
  if (plan.existing && plan.id) return { ok: true, id: plan.id, existing: plan.existing, jd: null };
  const company = typeof input.company === "string" ? input.company.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!company || !title) return { ok: false, error: "Add the company and the job title so the job can be told apart later" };
  const location = typeof input.location === "string" ? input.location.trim() : "";
  const pay = typeof input.pay === "string" ? input.pay.trim() : "";
  const salaryIn = input.salary && typeof input.salary === "object" ? (input.salary as { min?: unknown; max?: unknown; currency?: unknown }) : null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const salary = salaryIn && (num(salaryIn.min) || num(salaryIn.max)) ? { min: num(salaryIn.min), max: num(salaryIn.max), currency: typeof salaryIn.currency === "string" ? salaryIn.currency : null } : null;
  const employerUrl = typeof input.employerUrl === "string" && /^https?:\/\//i.test(input.employerUrl) ? input.employerUrl.trim() : null;
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const unverified = input.unverified === true;
  const jd = description ? writeJdCapture(company, title, url, description) : null;
  const note = formatSaveNote({ unverified, employerUrl, jd, pay: salary ? null : pay || null });
  const result = await addOffersToPipeline([
    { url, company, title, location, postedAt: "", ats: "", source: "web-save", note, ...(salary ? { salary } : {}) },
  ]);
  if (result.error) return { ok: false, error: result.error };
  if (result.added < 1) return { ok: false, error: "Nothing was saved" };
  const id = roleKeyForUrl(url);
  if (!id) return { ok: false, error: "The link could not be keyed" };
  return { ok: true, id, existing: null, jd };
}

// ── recording a submission ─────────────────────────────────────────────────

export type AppliedInput = { id: unknown; date: unknown; platform: unknown };
export type AppliedResult =
  | { ok: true; trackerN: string; created: boolean; changed: boolean; statusLogged: boolean; date: string; platform: string }
  | { ok: false; status: number; error: string };

const PLATFORM_RE = /^[\p{L}\p{N} .'&()/-]{1,40}$/u;

function todayLocal(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function runScript(name: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, [rootScript(name), ...args], { cwd: careerOpsRoot(), timeout: 60_000, env: process.env }, (err, stdout, stderr) => {
      const code = typeof (err as NodeJS.ErrnoException | null)?.code === "number" ? Number((err as NodeJS.ErrnoException).code) : err ? 1 : 0;
      resolve({ code, stdout: stdout || "", stderr: stderr || "" });
    });
  });
}

function statusLogPath(): string {
  const tracker = path.join(careerOpsRoot(), "data", "applications.md");
  return path.join(path.dirname(tracker), "status-log.tsv");
}

/**
 * Create a tracker row for a saved link that was applied to without an
 * evaluation, through the documented contract: a reserved number, a TSV in
 * batch/tracker-additions with the `N/A` score sentinel and no report link,
 * merged by merge-tracker.mjs. The ledger then records `-` → Applied with
 * source `web`, exactly the shape DATA_CONTRACT.md reserves for a row with no
 * prior state.
 */
async function createAppliedRow(role: RoleSummary, date: string, platform: string): Promise<{ n: string } | { error: string }> {
  for (const script of ["reserve-report-num", "merge-tracker"]) {
    if (!fs.existsSync(rootScript(script))) return { error: `this root has data only (${script}.mjs is missing)` };
  }
  const reserved = await runScript("reserve-report-num", []);
  const num = reserved.stdout.trim().match(/\d+/)?.[0];
  if (reserved.code !== 0 || !num) return { error: "could not reserve a tracker number" };
  const additions = path.join(careerOpsRoot(), "batch", "tracker-additions");
  fs.mkdirSync(additions, { recursive: true });
  const notes = `saved from web, no evaluation; applied via ${platform}; url: ${role.url}`;
  const row = [String(Number(num)), date, role.company, role.title, "Applied", "N/A", "❌", "—", notes.replace(/[\t\r\n|]/g, " "), role.url].join("\t");
  const tsv = path.join(additions, `${num}-${slug(role.company, "company")}.tsv`);
  fs.writeFileSync(tsv, `${row}\n`, "utf8");
  const merged = await runScript("merge-tracker", []);
  await runScript("reserve-report-num", ["--release", num]);
  if (merged.code !== 0) {
    console.error(`merge-tracker.mjs exited ${merged.code}: ${merged.stderr.trim() || merged.stdout.trim()}`);
    return { error: "the tracker merge failed; nothing was recorded" };
  }
  const rows = readApplications();
  const byNum = rows.find((a) => a.n === String(Number(num)) && a.company === role.company);
  const byUrl = rows.find((a) => normalizeUrl(trackerUrl(a)) === normalizeUrl(role.url));
  const created = byUrl ?? byNum;
  if (!created) return { error: "the row was merged but could not be read back" };
  try {
    fs.appendFileSync(statusLogPath(), `${created.n}\t${date}\t-\tApplied\tweb\tapplied via ${platform}\n`, "utf8");
  } catch (error) {
    console.error(`status-log append failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { n: created.n };
}

/** Record that the user submitted an application themselves. Never triggered by a link or a download. */
export async function recordApplied(input: AppliedInput): Promise<AppliedResult> {
  const id = typeof input.id === "string" ? input.id : "";
  const date = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayLocal();
  const platform = typeof input.platform === "string" ? input.platform.trim() : "";
  if (!platform || !PLATFORM_RE.test(platform)) return { ok: false, status: 400, error: "Say where you applied (LinkedIn, Indeed, the employer site…)" };
  if (date > todayLocal()) return { ok: false, status: 400, error: "The date cannot be in the future" };
  const role = await resolveRole(id);
  if (!role) return { ok: false, status: 404, error: "That job is no longer in the desk" };
  if (!setStatusScriptAvailable()) return { ok: false, status: 503, error: "recording needs the career-ops scripts; this root has data only" };

  let trackerN = role.redirectTo ?? role.trackerN;
  let created = false;
  if (!trackerN) {
    const made = await createAppliedRow(role, date, platform);
    if ("error" in made) return { ok: false, status: 500, error: made.error };
    trackerN = made.n;
    created = true;
  }
  const outcome: SetStatusOutcome = interpretSetStatus(
    await runSetStatus(["--row", trackerN, "Applied", "--on", date, "--note", `applied via ${platform}`, "--source", "web", "--json"]),
    "record-applied: set-status.mjs",
  );
  if (!outcome.ok) return { ok: false, status: outcome.status, error: outcome.body.error };
  return { ok: true, trackerN, created, changed: created || outcome.body.changed, statusLogged: created || outcome.body.statusLogged, date, platform };
}

// ── reviewed answers ───────────────────────────────────────────────────────

/** Persist reviewed answers into the report's canonical Application Answers section. */
export async function saveReviewedAnswers(n: string, answers: unknown): Promise<{ ok: true; answers: ReviewedAnswer[] } | { ok: false; error: string }> {
  if (!isTrackerId(n)) return { ok: false, error: "answers need a tracked role" };
  const report = readReport(n);
  if (!report) return { ok: false, error: "this role has no report to hold answers yet" };
  const mod = await answersModule();
  if (!mod) return { ok: false, error: "application-answers.mjs is missing from this root" };
  const list = Array.isArray(answers) ? answers : [];
  const clean: ReviewedAnswer[] = list
    .map((a) => ({ question: String((a as { question?: unknown })?.question ?? "").replace(/\s+/g, " ").trim(), answer: String((a as { answer?: unknown })?.answer ?? "").trim() }))
    .filter((a) => a.question && a.answer);
  const file = path.join(careerOpsRoot(), "reports", report.file);
  // Keep whatever the apply mode recorded in the other groups (selections,
  // field values, files); only the free-text answers are owned by the desk.
  const existing = mod.parseApplicationAnswersSection(report.content);
  const updated = mod.upsertApplicationAnswersSection(report.content, {
    ...(existing ?? {}),
    date: todayLocal(),
    state: existing?.state === "submitted" ? "submitted" : "filled",
    freeText: clean,
  });
  atomicWrite(file, updated);
  return { ok: true, answers: clean };
}
