"use client";

import { useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import type { DraftAnswer } from "@/lib/roles/answer-drafts.mjs";
import type { ReviewedAnswer } from "@/lib/roles/server";
import { cn } from "@/lib/cn";

const primary = "inline-flex min-h-[44px] items-center justify-center rounded-md bg-pen px-4 text-[15px] font-medium text-pen-ink hover:bg-pen-hover disabled:opacity-50";
const secondary = "inline-flex min-h-[44px] items-center justify-center rounded-md border border-rule bg-sheet px-4 text-[15px] font-medium text-ink hover:bg-sheet-hover disabled:opacity-50";

// Text meant for the application form. Two lists, in words: reviewed and
// ready to paste, or drafts from the evaluation that still need a read.
// Reviewed answers persist in the report's Application Answers section.
export function AnswersPanel({ n, drafts, answers: initial }: { n: string | null; drafts: DraftAnswer[]; answers: ReviewedAnswer[] }) {
  const [answers, setAnswers] = useState<ReviewedAnswer[]>(initial);
  const [editing, setEditing] = useState<{ index: number | null; question: string; answer: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function persist(next: ReviewedAnswer[], message: string) {
    if (!n) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/roles/answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n, answers: next }) });
      const data = (await res.json()) as { ok: boolean; answers?: ReviewedAnswer[]; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Could not save answers");
      setAnswers(data.answers ?? next);
      setEditing(null);
      setStatus(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save answers");
    } finally {
      setBusy(false);
    }
  }

  const pending = drafts.filter((d) => !answers.some((a) => a.question.toLowerCase() === d.question.toLowerCase()));

  if (!n) {
    return (
      <div className="rounded-lg bg-sheet p-4 shadow-[0_1px_0_var(--rule)]">
        <p className="text-[15px] text-ink">Answers are kept with the report.</p>
        <p className="mt-1 text-[13px] text-graphite">Prepare the packet first, then add the questions the form asks.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-sheet p-4 shadow-[0_1px_0_var(--rule)]">
      <p className="text-xs text-graphite">Text for the application form.</p>
      {error && <p role="alert" className="mt-2 rounded-md bg-caution-soft px-3 py-2 text-[14px] text-caution">{error}</p>}
      <p role="status" aria-live="polite" className={cn("mt-2 text-[14px] text-graphite", !status && "sr-only")}>{status}</p>

      <h3 className="mt-3 text-[15px] font-semibold text-ink">Reviewed, ready to paste</h3>
      {answers.length === 0 ? (
        <p className="mt-1 text-[14px] text-graphite">Nothing reviewed yet.</p>
      ) : (
        <ol className="mt-2 divide-y divide-rule">
          {answers.map((a, i) => (
            <li key={`${a.question}-${i}`} className="py-3">
              {editing?.index === i ? (
                <Editor value={editing} onChange={setEditing} busy={busy} onSave={() => persist(answers.map((x, j) => (j === i ? { question: editing.question, answer: editing.answer } : x)), "Answer updated.")} onCancel={() => setEditing(null)} />
              ) : (
                <>
                  <p className="text-[15px] font-medium text-ink">{a.question}</p>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{a.answer}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CopyButton text={a.answer} />
                    <button type="button" disabled={busy} onClick={() => setEditing({ index: i, question: a.question, answer: a.answer })} className={secondary}>Edit</button>
                    <button type="button" disabled={busy} onClick={() => persist(answers.filter((_, j) => j !== i), "Answer removed.")} className="min-h-[44px] px-2 text-sm text-graphite underline-offset-2 hover:underline">Remove</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      {pending.length > 0 && (
        <>
          <h3 className="mt-5 text-[15px] font-semibold text-ink">Drafts from the evaluation, not yet reviewed</h3>
          <ol className="mt-2 divide-y divide-rule">
            {pending.map((d, i) => (
              <li key={`${d.question}-${i}`} className="py-3">
                {editing?.index === -1 - i ? (
                  <Editor value={editing} onChange={setEditing} busy={busy} onSave={() => persist([...answers, { question: editing.question, answer: editing.answer }], "Answer reviewed and added.")} onCancel={() => setEditing(null)} />
                ) : (
                  <>
                    <p className="text-[15px] font-medium text-ink">{d.question}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-graphite">{d.answer}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => setEditing({ index: -1 - i, question: d.question, answer: d.answer })} className={primary}>Review and add</button>
                      <CopyButton text={d.answer} label="Copy draft" />
                    </div>
                  </>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="mt-5 border-t border-rule pt-3">
        {editing?.index === null ? (
          <Editor value={editing} onChange={setEditing} busy={busy} onSave={() => persist([...answers, { question: editing.question, answer: editing.answer }], "Answer added.")} onCancel={() => setEditing(null)} />
        ) : (
          <button type="button" disabled={busy} onClick={() => setEditing({ index: null, question: "", answer: "" })} className={secondary}>Add a question from the form</button>
        )}
      </div>
    </div>
  );
}

function Editor({ value, onChange, onSave, onCancel, busy }: { value: { index: number | null; question: string; answer: string }; onChange: (v: { index: number | null; question: string; answer: string }) => void; onSave: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <div>
      <label className="block text-[14px]">
        <span className="font-medium text-ink">Question, as the form asks it</span>
        <input value={value.question} onChange={(e) => onChange({ ...value, question: e.target.value })} className="mt-1 min-h-[44px] w-full rounded-md border border-rule bg-sheet px-3 text-[15px] text-ink" />
      </label>
      <label className="mt-2 block text-[14px]">
        <span className="font-medium text-ink">Your answer</span>
        <textarea value={value.answer} onChange={(e) => onChange({ ...value, answer: e.target.value })} rows={5} className="mt-1 w-full rounded-md border border-rule bg-sheet p-3 text-[15px] leading-relaxed text-ink" />
      </label>
      <p className="mt-1 text-xs text-graphite">Only facts you can stand behind. Leave anything unresolved as a question in the text.</p>
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy || !value.question.trim() || !value.answer.trim()} onClick={onSave} className={primary}>Save as reviewed</button>
        <button type="button" disabled={busy} onClick={onCancel} className={secondary}>Cancel</button>
      </div>
    </div>
  );
}
