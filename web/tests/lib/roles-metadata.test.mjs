import test from "node:test";
import assert from "node:assert/strict";
import { extractPostingMetadata, parseHeadline, isBoardHost } from "../../src/lib/roles/metadata.mjs";

const JSONLD = `<html><head><title>Ignored</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Senior Platform Engineer","url":"https://jobs.acme.example/12345","hiringOrganization":{"@type":"Organization","name":"Acme Corp"},"jobLocation":{"@type":"Place","address":{"addressLocality":"Manchester","addressCountry":"GB"}},"baseSalary":{"@type":"MonetaryAmount","currency":"GBP","value":{"@type":"QuantitativeValue","minValue":90000,"maxValue":100000,"unitText":"YEAR"}}}</script>
</head><body></body></html>`;

test("schema.org JobPosting supplies title, company, location, pay and an employer link", () => {
  const meta = extractPostingMetadata(JSONLD, "https://www.linkedin.com/jobs/view/1");
  assert.equal(meta.title, "Senior Platform Engineer");
  assert.equal(meta.company, "Acme Corp");
  assert.equal(meta.location, "Manchester, GB");
  assert.equal(meta.pay, "90,000–100,000 GBP per year");
  assert.deepEqual(meta.salary, { min: 90000, max: 100000, currency: "GBP", unit: "YEAR" });
  assert.equal(meta.employerUrl, "https://jobs.acme.example/12345");
  assert.equal(meta.source, "jsonld");
});

test("a LinkedIn og:title yields company, title and location without inventing pay", () => {
  const html = `<meta property="og:title" content="Globex hiring Staff DevOps Engineer in Berlin, Germany | LinkedIn"><meta property="og:site_name" content="LinkedIn">`;
  const meta = extractPostingMetadata(html, "https://www.linkedin.com/jobs/view/2");
  assert.equal(meta.company, "Globex");
  assert.equal(meta.title, "Staff DevOps Engineer");
  assert.equal(meta.location, "Berlin, Germany");
  assert.equal(meta.pay, null);
  assert.equal(meta.source, "og");
});

test("a bare <title> becomes the title only; the board's site name is never taken as the company", () => {
  const html = `<title>Backend Engineer - Remote - Indeed.com</title><meta property="og:site_name" content="Indeed">`;
  const meta = extractPostingMetadata(html, "https://www.indeed.com/viewjob?jk=abc");
  assert.equal(meta.title, "Backend Engineer");
  assert.equal(meta.location, "Remote");
  assert.equal(meta.company, null);
  assert.equal(meta.source, "title");
});

test("an unreadable page yields nothing at all", () => {
  const meta = extractPostingMetadata("<html><body>Sign in to continue</body></html>", "https://www.linkedin.com/jobs/view/3");
  assert.deepEqual(meta, { title: null, company: null, location: null, pay: null, salary: null, employerUrl: null, source: null });
});

test("headline patterns are named, not guessed", () => {
  assert.deepEqual(parseHeadline("Job Application for Data Engineer at Initech", "https://boards.greenhouse.io/initech/jobs/1"), { company: "Initech", title: "Data Engineer", location: null });
  assert.deepEqual(parseHeadline("Some page", "https://example.test/x"), { company: null, title: "Some page", location: null });
  assert.equal(isBoardHost("https://uk.indeed.com/viewjob"), true);
  assert.equal(isBoardHost("https://jobs.acme.example/1"), false);
});
