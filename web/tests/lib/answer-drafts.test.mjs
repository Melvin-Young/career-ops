import test from "node:test";
import assert from "node:assert/strict";
import { readDraftAnswers, parseDraftPairs } from "../../src/lib/roles/answer-drafts.mjs";

const REPORT = `## A) Role Summary
Text.

## H) Draft Application Answers

1. **Why do you want to work at Acme?**

> Because the platform team owns the golden paths I have built elsewhere.
> Second line.

2. **Describe a time you reduced deploy lead time.**
At Acme the workflow library took deploys from 45 to 14 minutes.

## Keywords extracted
- ci
`;

test("the H block parses into question/answer pairs and keeps multi-line answers", () => {
  const { drafts, raw } = readDraftAnswers(REPORT);
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].question, "Why do you want to work at Acme?");
  assert.equal(drafts[0].answer, "Because the platform team owns the golden paths I have built elsewhere.\nSecond line.");
  assert.equal(drafts[1].answer, "At Acme the workflow library took deploys from 45 to 14 minutes.");
  assert.match(raw, /Why do you want/);
});

test("a report without the block yields no drafts, and prose without questions is not turned into pairs", () => {
  assert.deepEqual(readDraftAnswers("## A) Role Summary\nText."), { drafts: [], raw: null });
  assert.deepEqual(parseDraftPairs("Just a paragraph of advice with no questions."), []);
});
