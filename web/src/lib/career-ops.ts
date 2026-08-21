import fs from "node:fs";
import path from "node:path";
import { atomicWrite } from "@/lib/core/safe-write";
import { parseApplications } from "@/lib/tracker-table.mjs";
// One definition of the `{n}-RESERVED.md` convention, shared with
// run-cli-support.mjs — see report-files.mjs for why it lives there.
import { isReservedReportFile } from "@/lib/report-files.mjs";
import { parsePipelineInbox } from "@/lib/pipeline-inbox.mjs";

/**
 * Resolve the career-ops "home" — the directory holding the user's sibling
 * files (cv.md, data/, reports/). In production the web/ app lives inside the
 * career-ops checkout, so the home is its parent (..). Dev overrides via
 * CAREER_OPS_ROOT to read the user's real (gitignored) data from a separate
 * checkout — see web/.env.local.
 */
export function careerOpsRoot(): string {
  const env = process.env.CAREER_OPS_ROOT?.trim();
  if (env) return env;
  return path.resolve(process.cwd(), "..");
}

/**
 * Absolute path to a core root script (e.g. doctor, verify-portals). The `.mjs`
 * is assembled here from the bare name so the literal never appears as a direct
 * `execFile`/`spawn` argument — Next's bundler statically traces such literals
 * as module imports and fails the production build otherwise.
 */
export function rootScript(nameNoExt: string): string {
  return path.join(careerOpsRoot(), `${nameNoExt}.mjs`);
}

// Feature-detect the core's `tracker.mjs delete --num` row-delete (#1200) by probing
// the local script source — older checkouts lack it, so the delete UI hides itself.
export function trackerCanDelete(): boolean {
  try {
    const src = fs.readFileSync(rootScript("tracker"), "utf8");
    return src.includes("delete") && src.includes("--num");
  } catch {
    return false;
  }
}

function read(rel: string): string | null {
  try {
    return fs.readFileSync(path.join(careerOpsRoot(), rel), "utf8");
  } catch {
    return null;
  }
}

export type DiscoveryLane = "likely" | "verify";
export type InboxJob = { url: string; company: string; role: string; location?: string; compensation?: string; done: boolean; postedAt?: string; discoveryLane?: DiscoveryLane; discoveryReason?: string };

/** Parse data/pipeline.md — `- [ ] URL | Company | Role [| Location [| Compensation]] [| label: …]*`.
 *  Positional split for the first columns (the optional 4th `location` #1015
 *  and 5th `compensation` #1017 must NOT bleed into `role`); labeled segments
 *  (posted:/trust:/lane:/reason:/note:/…) are filtered out of positional assignment wherever
 *  they appear and surfaced when useful. Unknown labels
 *  and further trailing columns are ignored gracefully. */
export function readInbox(): InboxJob[] {
  const md = read("data/pipeline.md");
  if (!md) return [];
  return parsePipelineInbox(md) as InboxJob[];
}

/**
 * Read data/scan-history.tsv → Map<url, first_seen(YYYY-MM-DD)>. The scanner
 * already stamps every discovered posting with the date it was first seen
 * (col 2), so we derive the inbox's freshness signal here WITHOUT touching the
 * core (see the inbox-triage build: freshness = option A, no scanner change).
 * Tolerant by construction: no file → empty map (freshness facet just hides);
 * a malformed row is skipped, never thrown (missing ≠ corrupt).
 */
export function readScanDates(): Map<string, string> {
  const tsv = read("data/scan-history.tsv");
  const dates = new Map<string, string>();
  if (!tsv) return dates;
  const lines = tsv.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || (i === 0 && line.startsWith("url\t"))) continue; // skip header
    const tab = line.indexOf("\t");
    if (tab < 1) continue;
    const url = line.slice(0, tab);
    const firstSeen = line.slice(tab + 1).split("\t")[0]?.trim();
    // keep the EARLIEST first_seen if a url recurs (it's "first" seen, after all)
    if (/^\d{4}-\d{2}-\d{2}$/.test(firstSeen) && !dates.has(url)) dates.set(url, firstSeen);
  }
  return dates;
}

export type Application = {
  n: string;
  date: string;
  company: string;
  /** Intermediary channel (#1596): agency/recruiter firm, "—" for direct, "" when the tracker has no Via column. */
  via: string;
  role: string;
  score: string;
  status: string;
  pdf: string;
  report: string;
  notes: string;
};

/**
 * Parse data/applications.md — the tracker table (source of truth).
 * The header-aware parsing lives in tracker-table.mjs, which resolves headers
 * through the SAME alias table the Node tooling uses (tracker-aliases.json,
 * exported by tracker-parse.mjs as HEADER_ALIASES) — one shared source, no
 * web-side mirror to drift (#954, PR #1598 review).
 */
export function readApplications(): Application[] {
  const md = read("data/applications.md");
  if (!md) return [];
  return parseApplications(md, careerOpsRoot());
}

export type CareerEvidenceLabel = "Demonstrated" | "Transferable" | "Unverified" | "Gap";

export type CareerEvidenceItem = {
  id: string;
  label: CareerEvidenceLabel;
  claim: string;
  category?: string;
  scope?: string;
  signal?: string;
  approval?: "approved" | "pending";
  outwardEligible: boolean;
  source: { path: string; section?: string };
};

export type CareerMarketSkill = {
  id: string;
  category: string;
  skill: string;
  mentions: number;
  currentEvidence: string;
  label: CareerEvidenceLabel;
  outwardEligible: false;
  source: { path: string; section?: string };
};

export type CareerVoiceReference = {
  id: string;
  title: string;
  path: string;
  contentHash: string;
  importedPath: string;
};

export type CareerEvidenceStore = {
  schemaVersion: 1;
  sources: Array<{ kind: string; sourceRoot: string; fingerprint: string; importedAt: string }>;
  evidence: CareerEvidenceItem[];
  marketSkills: CareerMarketSkill[];
  voiceReferences: CareerVoiceReference[];
};

/** Read-only Career Evidence view for the personal dashboard. A missing store
 * is a valid empty state; malformed state is surfaced instead of silently
 * becoming empty so a manual audit cannot overlook evidence corruption. */
export function readCareerEvidence(): { exists: boolean; data: CareerEvidenceStore | null; error: string | null } {
  const file = path.join(careerOpsRoot(), "data", "career-evidence.json");
  if (!fs.existsSync(file)) return { exists: false, data: null, error: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as CareerEvidenceStore;
    if (
      parsed?.schemaVersion !== 1
      || !Array.isArray(parsed.sources)
      || !Array.isArray(parsed.evidence)
      || !Array.isArray(parsed.marketSkills)
      || !Array.isArray(parsed.voiceReferences)
    ) throw new Error("unsupported or incomplete schema");
    return { exists: true, data: parsed, error: null };
  } catch (error) {
    return { exists: true, data: null, error: error instanceof Error ? error.message : "unknown parse error" };
  }
}

export type CareerHistoryRecord = {
  id: string;
  kind: "job" | "fit-analysis";
  title: string;
  company: string | null;
  role: string | null;
  captured: string | null;
  source: { path: string; contentHash: string };
  content: string;
};

export function readCareerHistory(): { jobs: CareerHistoryRecord[]; analyses: CareerHistoryRecord[]; error: string | null } {
  const file = path.join(careerOpsRoot(), "data", "career-history.json");
  if (!fs.existsSync(file)) return { jobs: [], analyses: [], error: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.jobs) || !Array.isArray(parsed.analyses)) throw new Error("unsupported or incomplete schema");
    return { jobs: parsed.jobs, analyses: parsed.analyses, error: null };
  } catch (error) {
    return { jobs: [], analyses: [], error: error instanceof Error ? error.message : "unknown parse error" };
  }
}

export type StatusHistoryEntry = { date: string; from: string; to: string; source: string; note: string };

export function readStatusHistory(n: string): StatusHistoryEntry[] {
  if (!/^\d+$/.test(n)) return [];
  const tsv = read("data/status-log.tsv");
  if (!tsv) return [];
  return tsv.split(/\r?\n/).flatMap((line) => {
    const [selector, date, from, to, source, ...note] = line.split("\t");
    if (selector !== n || !date || !to) return [];
    return [{ date, from: from === "-" ? "Unknown" : from, to: to === "-" ? "Unknown" : to, source: source || "unknown", note: note.join("\t") }];
  });
}

export type RoleActivityEntry = {
  kind: "follow-up" | "reply" | "interview" | "export";
  date: string;
  title: string;
  detail: string;
};

function firstMarkdownTable(content: string): Array<Record<string, string>> {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => /^\s*\|.*\|\s*$/.test(line));
  if (start < 0) return [];
  const table: string[] = [];
  for (const line of lines.slice(start)) {
    if (!/^\s*\|.*\|\s*$/.test(line)) break;
    table.push(line);
  }
  const split = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  const header = split(table[0] ?? "");
  return table.slice(1).flatMap((line) => {
    const cells = split(line);
    if (cells.every((cell) => /^:?-+:?$/.test(cell)) || cells.length !== header.length) return [];
    return [Object.fromEntries(header.map((name, index) => [name.toLowerCase(), cells[index]]))];
  });
}

/** Join the personal lifecycle sources that belong in one role workspace.
 * Missing files are normal empty states; uncertain reply matches stay out. */
export function readRoleActivity(app: Application): RoleActivityEntry[] {
  const activity: RoleActivityEntry[] = [];
  const followups = read("data/follow-ups.md");
  if (followups) {
    for (const row of firstMarkdownTable(followups)) {
      const appNum = row.appnum ?? row.app ?? row["app#"];
      if (appNum !== app.n) continue;
      activity.push({ kind: "follow-up", date: row.date ?? "", title: `${row.channel || "Follow-up"} follow-up`, detail: [row.contact, row.notes].filter(Boolean).join(" · ") });
    }
  }

  const interviews = read("data/active-interviews.md") ?? read("active-interviews.md");
  if (interviews) {
    for (const row of firstMarkdownTable(interviews)) {
      const notes = row.notes ?? "";
      const exact = new RegExp(`#${app.n}\\s+in\\s+tracker`, "i").test(notes);
      const namesMatch = (row.company ?? "").toLowerCase() === app.company.toLowerCase() && (row.role ?? "").toLowerCase() === app.role.toLowerCase();
      if (!exact && !namesMatch) continue;
      activity.push({ kind: "interview", date: row["date/time"] ?? row.date ?? "", title: [row.round, row.status].filter(Boolean).join(" · ") || "Interview", detail: [row.interviewer, notes].filter(Boolean).join(" · ") });
    }
  }

  const replies = read("data/reply-candidates.json");
  if (replies) {
    try {
      const parsed = JSON.parse(replies);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.candidates) ? parsed.candidates : [];
      for (const item of items) {
        const exact = String(item.application_num ?? item.appNum ?? "") === app.n;
        const text = `${item.subject ?? ""} ${item.body_snippet ?? item.body ?? ""}`.toLowerCase();
        const namesMatch = text.includes(app.company.toLowerCase()) && text.includes(app.role.toLowerCase());
        if (!exact && !namesMatch) continue;
        activity.push({ kind: "reply", date: String(item.date ?? item.received_at ?? ""), title: String(item.subject ?? item.signal ?? "Application reply"), detail: String(item.from ?? item.body_snippet ?? "") });
      }
    } catch { /* corrupt reply candidates are surfaced by reply-watch; do not guess here */ }
  }

  const outputRoot = path.join(careerOpsRoot(), "output");
  if (fs.existsSync(outputRoot)) {
    const prefix = `${app.n.padStart(3, "0")}-`;
    for (const bundle of fs.readdirSync(outputRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))) {
      const artifacts = path.join(outputRoot, bundle.name, "artifacts");
      if (!fs.existsSync(artifacts)) continue;
      for (const kind of ["resume", "cover-letter"]) {
        const kindRoot = path.join(artifacts, kind);
        if (!fs.existsSync(kindRoot)) continue;
        for (const version of fs.readdirSync(kindRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
          const pdf = path.join(kindRoot, version.name, "artifact.pdf");
          if (!fs.existsSync(pdf)) continue;
          activity.push({ kind: "export", date: fs.statSync(pdf).mtime.toISOString(), title: `${kind === "resume" ? "Resume" : "Cover letter"} ${version.name} exported`, detail: path.relative(careerOpsRoot(), pdf) });
        }
      }
    }
  }
  return activity.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Server-side lifecycle of the user's setup — mirrors the prerequisite list that
 * doctor.mjs uses (cv.md, config/profile.yml, modes/_profile.md, portals.yml), by
 * plain file-stat (no subprocess). Drives the home branch: first-run (no CV) →
 * the CV takeover; in-between (CV but no profile) → gentle nudges; established.
 */
export type LifecyclePhase = "first-run" | "in-between" | "established";
/**
 * Server-side lifecycle, mirroring the core doctor.mjs prerequisite list with the
 * SAME existsSync semantics (the SSOT the OnboardingBanner already reads via
 * /api/doctor). The 4 user-layer prereqs: cv.md, config/profile.yml,
 * modes/_profile.md, portals.yml.
 *   - first-run  → a TRULY empty install (no cv AND no data): the CV takeover.
 *     CRITICAL back-compat (maintainer): NEVER force onboarding on a user who
 *     already has data (a full pipeline/tracker with no cv.md is valid).
 *   - in-between → has cv/data but setup incomplete: dashboard + the nudge banner.
 *   - established → all 4 prereqs present.
 * onboardingNeeded mirrors doctor.mjs: true if ANY prereq is missing → show banner.
 */
export function doctorState(): {
  phase: LifecyclePhase;
  onboardingNeeded: boolean;
  missing: string[];
  hasCv: boolean;
  hasData: boolean;
} {
  const has = (rel: string) => {
    try {
      return fs.existsSync(path.join(careerOpsRoot(), rel));
    } catch {
      return false;
    }
  };
  const prereqs: [string, string][] = [
    ["cv.md", "cv.md"],
    ["config/profile.yml", "config/profile.yml"],
    ["modes/_profile.md", "modes/_profile.md"],
    ["portals.yml", "portals.yml"],
  ];
  const missing = prereqs.filter(([rel]) => !has(rel)).map(([, label]) => label);
  const hasCv = has("cv.md");
  const hasData = readApplications().length > 0 || readInbox().some((j) => !j.done);
  const onboardingNeeded = missing.length > 0;
  const phase: LifecyclePhase = !hasCv && !hasData ? "first-run" : onboardingNeeded ? "in-between" : "established";
  return { phase, onboardingNeeded, missing, hasCv, hasData };
}

export type PipelineSummary = {
  root: string;
  rootExists: boolean;
  inbox: InboxJob[];
  applications: Application[];
};

export function pipelineSummary(): PipelineSummary {
  const root = careerOpsRoot();
  const scanDates = readScanDates();
  return {
    root,
    rootExists: fs.existsSync(root),
    // join the freshness date (first_seen) onto each raw posting — the inbox's
    // triage view orders/faceted-filters on it entirely client-side.
    inbox: readInbox().map((j) => ({ ...j, postedAt: j.postedAt ?? scanDates.get(j.url) })),
    applications: readApplications(),
  };
}

export type ReportData = { content: string; file: string };

/** Locate the evaluation report for an application number.
 *  The tracker row's own report link is authoritative: report FILE numbers can
 *  differ from application numbers (e.g. app #309 → reports/308-…), so
 *  resolving only by leading filename number misses those. Links are
 *  normalized relative to the tracker file's directory (see #760). Falls back
 *  to the filename scan (reports/{n}-{slug}-{date}.md, possibly zero-padded)
 *  for rows without a parseable link.
 *
 *  Both the linked lookup and the fallback scan skip `{n}-RESERVED.md`
 *  placeholder files.
 *  `reserve-report-num.mjs` writes an empty `NNN-RESERVED.md` sentinel to
 *  claim a report number before a worker has actually written the report;
 *  it's normally deleted once the real report lands (or GC'd after 4h if
 *  abandoned). But "RESERVED" sorts alphabetically before nearly every real
 *  slug (company names start with lowercase/uppercase letters after the
 *  number-dash, "R" often lands mid-alphabet or earlier), so if a sentinel
 *  outlives its report — e.g. a worker was driven directly instead of
 *  through the orchestrator that owns cleanup — `.find()` could return the
 *  empty sentinel instead of the real report, making the report body and the
 *  Apply/PDF-ready checks disappear. */
export function findReportFile(n: string): string | null {
  const target = parseInt(n, 10);
  if (Number.isNaN(target)) return null;
  const root = careerOpsRoot();
  const app = readApplications().find((a) => parseInt(a.n, 10) === target);
  const linked = app?.report.match(/\]\(([^)]+)\)/)?.[1];
  if (linked) {
    const p = path.resolve(root, "data", linked);
    // Containment: a hand-edited link must not resolve outside the project.
    if (p.endsWith(".md") && !isReservedReportFile(p) && containedRealpath(p, root)) return p;
  }
  let files: string[];
  try {
    files = fs.readdirSync(path.join(root, "reports"));
  } catch {
    return null;
  }
  const match = files.find(
    (f) => f.endsWith(".md") && !isReservedReportFile(f) && parseInt(f, 10) === target,
  );
  if (!match) return null;
  const p = path.join(root, "reports", match);
  return containedRealpath(p, root) ? p : null;
}

/** True containment check: resolves symlinks before comparing, so a link
 *  planted under data/ or reports/ can't leak files outside the project. */
function containedRealpath(p: string, root: string): boolean {
  try {
    return fs.realpathSync(p).startsWith(fs.realpathSync(root) + path.sep);
  } catch {
    return false; // missing file or unresolvable link — treat as not found
  }
}

export function readReport(n: string): ReportData | null {
  const file = findReportFile(n);
  if (!file) return null;
  try {
    return { content: fs.readFileSync(file, "utf8"), file: path.basename(file) };
  } catch {
    return null;
  }
}

export function findApplication(n: string): Application | null {
  return readApplications().find((a) => a.n === n) ?? null;
}

/** The CANONICAL user-customization file the CLI/TUI reads. Durable facts the
 *  web assistant learns go HERE (single source of truth) inside a managed marker
 *  block — so the CLI sees them too. No web-only memory store (that would drift). */
export function profilePath(): string {
  return path.join(careerOpsRoot(), "modes", "_profile.md");
}

const NOTES_START = "<!-- co-web-notes:start -->";
const NOTES_END = "<!-- co-web-notes:end -->";

/** Read back ONLY the web-assistant managed notes from modes/_profile.md (small,
 *  focused — the agent reads the rest of the canonical files itself). Falls back
 *  to the legacy web-only memory file for back-compat. */
export function readMemory(): string {
  try {
    const md = fs.readFileSync(profilePath(), "utf8");
    const i = md.indexOf(NOTES_START);
    const j = md.indexOf(NOTES_END);
    if (i !== -1 && j !== -1 && j > i) return md.slice(i + NOTES_START.length, j).trim();
  } catch {
    /* no _profile.md yet */
  }
  try {
    return fs.readFileSync(path.join(careerOpsRoot(), ".career-ops-web", "memory.md"), "utf8").trim();
  } catch {
    return "";
  }
}

/** Append a durable fact to the canonical modes/_profile.md (creating the file +
 *  managed block if needed), PRESERVING existing user content. */
export function rememberFact(fact: string): "ok" | "deduped" | "error" {
  const f = fact.trim().replace(/\s+/g, " ").slice(0, 300);
  if (!f) return "deduped";
  const p = profilePath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    let md = "";
    try {
      md = fs.readFileSync(p, "utf8");
    } catch {
      md = "";
    }
    const i = md.indexOf(NOTES_START);
    const j = md.indexOf(NOTES_END);
    if (i !== -1 && j !== -1 && j > i) {
      if (md.slice(i, j).includes(f)) return "deduped";
      atomicWrite(p, md.slice(0, j) + `- ${f}\n` + md.slice(j));
      return "ok";
    }
    if (md.includes(f)) return "deduped";
    const section = `\n\n## Notes from the web assistant\n${NOTES_START}\n- ${f}\n${NOTES_END}\n`;
    const base = md.trim() ? md.replace(/\n*$/, "\n") : "# Profile customization\n";
    atomicWrite(p, base + section);
    return "ok";
  } catch {
    return "error";
  }
}
