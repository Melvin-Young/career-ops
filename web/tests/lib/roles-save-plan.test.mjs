import test from "node:test";
import assert from "node:assert/strict";
import { planSave, isSaveableUrl } from "../../src/lib/roles/save-plan.mjs";
import { roleKeyForUrl, isTrackerId, isUrlKey } from "../../src/lib/roles/identity.mjs";
import { formatSaveNote, parseSaveNote } from "../../src/lib/roles/note.mjs";

const inbox = [{ url: "https://boards.example.test/acme/jobs/111?utm_source=x", company: "Acme", role: "Platform Engineer" }];
const tracker = [{ n: "4", url: "https://boards.example.test/umbrella/jobs/900", company: "Umbrella", role: "Platform Engineer" }];

test("a repeat save resolves to the existing inbox record, tracking params ignored", () => {
  const plan = planSave({ url: "https://boards.example.test/acme/jobs/111", inbox, tracker });
  assert.equal(plan.existing, "inbox");
  assert.equal(plan.id, roleKeyForUrl(inbox[0].url));
  assert.deepEqual(plan.record, { company: "Acme", title: "Platform Engineer" });
});

test("a URL already in the tracker resolves to its row number", () => {
  const plan = planSave({ url: "https://boards.example.test/umbrella/jobs/900/", inbox, tracker });
  assert.equal(plan.existing, "tracker");
  assert.equal(plan.id, "4");
});

test("the same company with a different requisition is a new record", () => {
  const plan = planSave({ url: "https://boards.example.test/acme/jobs/222", inbox, tracker });
  assert.equal(plan.existing, null);
  assert.match(plan.id, /^u-[0-9a-f]{12}$/);
  assert.notEqual(plan.id, roleKeyForUrl(inbox[0].url));
});

test("identity helpers classify ids and refuse unkeyable input", () => {
  assert.equal(roleKeyForUrl("not a url"), null);
  assert.equal(isTrackerId("12"), true);
  assert.equal(isTrackerId("u-abc"), false);
  assert.equal(isUrlKey(roleKeyForUrl("https://a.test/b")), true);
  assert.equal(isSaveableUrl("https://a.test/b"), true);
  assert.equal(isSaveableUrl("ftp://a.test/b"), false);
  assert.equal(isSaveableUrl("acme.com/jobs"), false);
});

test("the pipeline note round-trips every marker and reads an unknown note as nothing", () => {
  const text = formatSaveNote({ unverified: true, employerUrl: "https://jobs.acme.example/1", jd: "local:jds/acme-role.md", pay: "£90k; bonus" });
  assert.equal(text, "saved from web; unverified; employer=https://jobs.acme.example/1; jd=local:jds/acme-role.md; pay=£90k, bonus");
  assert.deepEqual(parseSaveNote(text), { fromWeb: true, unverified: true, employerUrl: "https://jobs.acme.example/1", jd: "local:jds/acme-role.md", pay: "£90k, bonus" });
  assert.deepEqual(parseSaveNote("curated list"), { fromWeb: false, unverified: false, employerUrl: null, jd: null, pay: null });
  assert.deepEqual(parseSaveNote(undefined), { fromWeb: false, unverified: false, employerUrl: null, jd: null, pay: null });
});
