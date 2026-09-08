// Read the evaluation's "H) Draft Application Answers" block into question and
// answer pairs. The core writes that block as free markdown (only when the
// score clears 4.5), so this reader is tolerant: it accepts numbered or bold
// question lines followed by prose, and it returns nothing rather than
// inventing pairs when the block has another shape.
import { splitSections } from "../report-sections.mjs";

/**
 * @typedef {{ question: string, answer: string }} DraftAnswer
 */

/**
 * @param {string} reportBody
 * @returns {{ drafts: DraftAnswer[], raw: string|null }}
 */
export function readDraftAnswers(reportBody) {
  const { sections } = splitSections(String(reportBody ?? ""));
  const section = sections.find((s) => s.letter === "H" || /draft application answers/i.test(s.heading));
  if (!section || !section.content.trim()) return { drafts: [], raw: null };
  return { drafts: parseDraftPairs(section.content), raw: section.content };
}

const QUESTION_LINE = /^\s*(?:\d+[.)]\s*)?(?:\*\*(.+?)\*\*|###?\s+(.+)|Q(?:uestion)?\s*\d*\s*[:.]\s*(.+))\s*$/;

/**
 * @param {string} content
 * @returns {DraftAnswer[]}
 */
export function parseDraftPairs(content) {
  const drafts = [];
  let current = null;
  for (const line of String(content ?? "").split("\n")) {
    const q = line.match(QUESTION_LINE);
    if (q) {
      if (current && current.answer.trim()) drafts.push({ question: current.question, answer: current.answer.trim() });
      current = { question: (q[1] ?? q[2] ?? q[3]).replace(/:$/, "").trim(), answer: "" };
      continue;
    }
    if (!current) continue;
    const text = line.replace(/^\s*>\s?/, "").replace(/^\s*A(?:nswer)?\s*[:.]\s*/i, "");
    current.answer += (current.answer ? "\n" : "") + text;
  }
  if (current && current.answer.trim()) drafts.push({ question: current.question, answer: current.answer.trim() });
  return drafts.map((d) => ({ question: d.question, answer: d.answer.replace(/\n{3,}/g, "\n\n").trim() }));
}
