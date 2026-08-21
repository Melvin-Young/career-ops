import type { Application, CareerEvidenceItem } from "./career-ops";

export type ArtifactKind = "resume" | "cover-letter";
export type DraftContext = {
  app: Application;
  report: string;
  evidence: CareerEvidenceItem[];
  cv: string;
  fullName: string;
};

function rankEvidence(context: DraftContext): CareerEvidenceItem[] {
  const target = `${context.app.company} ${context.app.role} ${context.report}`.toLowerCase();
  const words = new Set(target.match(/[a-z][a-z0-9+#.-]{2,}/g) ?? []);
  const score = (claim: string) => (claim.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? []).filter((word) => words.has(word)).length;
  return [...context.evidence].sort((a, b) => score(b.claim) - score(a.claim));
}

/** Compose only from the tracked role, canonical CV, and explicitly approved
 * demonstrated evidence supplied by the server-side trust gate. */
export function composeArtifactDraft(kind: ArtifactKind, context: DraftContext, longForm: boolean) {
  const selected = rankEvidence(context).slice(0, kind === "resume" ? 10 : longForm ? 5 : 3);
  if (kind === "resume") {
    const base = context.cv.trim() || `# Resume Draft\n\n## Target\n\n${context.app.role} at ${context.app.company}`;
    const evidence = selected.length
      ? `\n\n## Role-specific evidence\n\n${selected.map((item) => `- ${item.claim}`).join("\n")}\n`
      : "\n";
    return { content: `${base}${evidence}`, provenance: selected.map((item) => item.id) };
  }

  const signature = context.fullName ? `\n${context.fullName}` : "";
  const intro = `Dear ${context.app.company} team,\n\nI'm applying for the ${context.app.role} role. I am interested in the opportunity and would like to understand how your team defines success, which problems matter most during the first months, and how the role works with the rest of the organization.`;
  const outro = `\n\nI'd welcome a conversation about the position, your current priorities, and whether my demonstrated experience matches what the team needs next.\n\nBest,${signature}`;
  const normalizedClaims = selected.map((item) => ({ item, claim: item.claim.trim().replace(/[.!?]?$/, ".") }));
  const included: typeof normalizedClaims = [];
  for (const candidate of normalizedClaims) {
    const claims = [...included, candidate].map(({ claim }) => claim).join(" ");
    if (longForm || `${intro}\n\n${claims}${outro}`.trim().split(/\s+/).length <= 120) included.push(candidate);
  }
  const evidenceParagraph = included.length ? `\n\n${included.map(({ claim }) => claim).join(" ")}` : "";
  const scopeParagraph = longForm && included.length
    ? "\n\nThese are the most relevant examples in my approved career evidence for this role. I would be glad to discuss their scope, the tradeoffs involved, and how that experience maps to your team's needs."
    : "";
  const content = `${intro}${evidenceParagraph}${scopeParagraph}${outro}`;
  return { content, provenance: included.map(({ item }) => item.id) };
}
