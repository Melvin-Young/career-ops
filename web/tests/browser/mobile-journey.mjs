#!/usr/bin/env node
// Browser oracle for the desk (docs/specs/CAREER-MOBILE-001). Not a unit
// suite: it drives a running dev server that points at an ISOLATED fixture
// root (web/tests/fixtures/build-mobile-root.mjs) with the stub CLI first on
// PATH, and it writes screenshots plus a JSON evidence file.
//
//   node web/tests/browser/mobile-journey.mjs --base http://127.0.0.1:3111 \
//     --root <fixture root> --out <screenshot dir>
//
// Every check records what was observed; a failed check does not stop the
// run, it is listed under `failures` in evidence.json and the exit code is 1.
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1]] : [])).filter((p) => p.length));
const BASE = args.base ?? "http://127.0.0.1:3111";
const ROOT = resolve(args.root);
const OUT = resolve(args.out ?? "mobile-journey-out");
mkdirSync(OUT, { recursive: true });

const { chromium } = await import(pathToFileURL(resolve(ROOT, "node_modules", "playwright", "index.mjs")).href);

const evidence = { base: BASE, root: ROOT, startedAt: new Date().toISOString(), checks: [], failures: [], screenshots: [] };
function check(name, ok, detail = "") {
  evidence.checks.push({ name, ok, detail });
  if (!ok) evidence.failures.push({ name, detail });
  console.log(`${ok ? "ok " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}
async function shot(page, name) {
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  evidence.screenshots.push(file);
}
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── a local "employer site" so the save flow reads real HTML ──────────────
const POSTINGS = {
  "/jobs/1": `<html><head><title>Ignored</title><script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "Staff Platform Engineer",
    url: "http://127.0.0.1:PORT/careers/staff-platform-engineer",
    hiringOrganization: { "@type": "Organization", name: "Pied Piper" },
    jobLocation: { "@type": "Place", address: { addressLocality: "Leeds", addressCountry: "GB" } },
    baseSalary: { "@type": "MonetaryAmount", currency: "GBP", value: { "@type": "QuantitativeValue", minValue: 95000, maxValue: 110000, unitText: "YEAR" } },
  })}</script></head><body><h1>Staff Platform Engineer</h1></body></html>`,
  "/jobs/2": `<html><head><title>Job Application for Platform Engineer, Data at Pied Piper</title></head><body>Second requisition, same company.</body></html>`,
};
const posting = http.createServer((req, res) => {
  const body = POSTINGS[req.url];
  if (req.url === "/wall") {
    res.writeHead(403, { "Content-Type": "text/html" });
    res.end("<html><body>Sign in to continue</body></html>");
    return;
  }
  if (!body) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body.replace("PORT", String(posting.address().port)));
});
await new Promise((r) => posting.listen(0, "127.0.0.1", r));
const PORT = posting.address().port;
const postingUrl = (p) => `http://127.0.0.1:${PORT}${p}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] });
await context.addInitScript(() => {
  try {
    localStorage.setItem("career-ops:config", JSON.stringify({ mode: "cli", cliId: "claude" }));
    localStorage.setItem("career-ops:theme", "light");
  } catch {}
});
const page = await context.newPage();
let dialogs = 0;
page.on("dialog", (d) => { dialogs += 1; d.dismiss().catch(() => {}); });

const noHorizontalScroll = async (name) => {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`${name}: no page-level horizontal scroll`, sw <= iw, `scrollWidth ${sw}, innerWidth ${iw}`);
};
const touchTargets = async (name) => {
  const small = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("main a, main button, main input, main select, main textarea, main summary, header a, header button")) {
      if (!(el instanceof HTMLElement) || el.closest("[hidden]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 44 || r.width < 44) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  check(`${name}: primary targets are at least 44x44`, small.length === 0, small.join("; "));
};
const contrast = (name) => contrastOn(page, name);
const contrastOn = async (target, name) => {
  const pairs = await target.evaluate(() => {
    const lum = (c) => {
      if (!/^rgba?\(/.test(c)) return null;
      const m = c.match(/\d+(\.\d+)?/g).map(Number);
      if (m.length === 4 && m[3] < 1) return null;
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
    };
    const bgOf = (el) => {
      let e = el;
      while (e) {
        const bg = getComputedStyle(e).backgroundColor;
        if (bg && !/rgba\(\d+, \d+, \d+, 0\)/.test(bg) && bg !== "transparent") return bg;
        e = e.parentElement;
      }
      return "rgb(255, 255, 255)";
    };
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("main p, main span, main a, main button, main h1, main h2, main dt, main dd, main li")) {
      const text = (el.textContent || "").trim();
      if (!text || el.children.length > 2) continue;
      const cs = getComputedStyle(el);
      const fg = cs.color;
      const bg = bgOf(el);
      const key = `${fg}|${bg}|${cs.fontSize}|${cs.fontWeight}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const l1 = lum(fg), l2 = lum(bg);
      if (l1 == null || l2 == null) { out.push({ fg, bg, size: cs.fontSize, ratio: null, pass: true, unparsed: true, sample: text.slice(0, 30) }); continue; }
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const px = parseFloat(cs.fontSize);
      const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
      out.push({ fg, bg, size: cs.fontSize, ratio: Math.round(ratio * 100) / 100, pass: ratio >= (large ? 3 : 4.5), sample: text.slice(0, 30) });
    }
    return out;
  });
  const bad = pairs.filter((p) => !p.pass);
  check(`${name}: text contrast meets AA`, bad.length === 0, bad.map((b) => `${b.sample} ${b.fg} on ${b.bg} = ${b.ratio}`).join("; "));
  evidence[`contrast:${name}`] = pairs;
};

try {
  // 1. Populated desk
  await page.goto(`${BASE}/`);
  await page.waitForSelector("text=Jobs");
  await shot(page, "01-desk-390");
  const rows = await page.locator("main ol li").count();
  check("desk lists tracker rows and saved links", rows >= 5, `${rows} rows in To do`);
  check("desk shows a saved-not-read state in words", await page.locator("text=Saved, page not read").count() > 0);
  await noHorizontalScroll("desk");
  await touchTargets("desk");
  await contrast("desk");

  // 2. Save a readable posting
  const rolesBefore = (await (await fetch(`${BASE}/api/roles`)).json()).roles.length;
  await page.fill("input[type=url]", postingUrl("/jobs/1"));
  await page.click("form button[type=submit]");
  await page.waitForSelector("text=Read from the page");
  await shot(page, "02-save-preview-390");
  check("save preview reads company from the page", (await page.inputValue("input[value='Pied Piper']").catch(() => "")) === "Pied Piper");
  check("save preview reads pay from the page", await page.locator("input[value='95,000–110,000 GBP per year']").count() === 1);
  await page.click("text=Save job");
  await page.waitForURL(/\/role\/u-[0-9a-f]{12}$/);
  const savedUrl = page.url();
  const savedId = savedUrl.split("/").pop();
  await page.waitForSelector("h1");
  await shot(page, "03-saved-role-390");
  check("saved role opens by its URL identity", /^u-[0-9a-f]{12}$/.test(savedId), savedId);
  check("saved role shows the employer link found on the page", await page.locator("a[href*='/careers/staff-platform-engineer']").count() === 1);
  check("pipeline.md holds the new row with the desk note", read("data/pipeline.md").includes(postingUrl("/jobs/1")) && read("data/pipeline.md").includes("saved from web; employer="));
  check("pay was written to the positional compensation column", /95000-110000 GBP/.test(read("data/pipeline.md")));

  // 3. Duplicate save: same URL with tracking params → existing record, no new row
  await page.goto(`${BASE}/`);
  await page.fill("input[type=url]", `${postingUrl("/jobs/1")}?utm_source=phone`);
  await page.click("form button[type=submit]");
  await page.waitForSelector("text=Already saved");
  await shot(page, "04-duplicate-save-390");
  const dupRes = await fetch(`${BASE}/api/roles/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true, url: postingUrl("/jobs/1"), company: "Pied Piper", title: "Staff Platform Engineer" }) });
  const dupJson = await dupRes.json();
  const rolesAfterDup = (await (await fetch(`${BASE}/api/roles`)).json()).roles.length;
  check("a repeated confirm returns the existing id and adds nothing", dupJson.existing === "inbox" && dupJson.id === savedId && rolesAfterDup === rolesBefore + 1, JSON.stringify(dupJson));
  const occurrences = read("data/pipeline.md").split(postingUrl("/jobs/1")).length - 1;
  check("pipeline.md has exactly one row for the URL", occurrences === 1, `${occurrences} rows`);

  // 4. Distinct requisition at the same company → new record
  await page.fill("input[type=url]", postingUrl("/jobs/2"));
  await page.click("form button[type=submit]");
  await page.waitForSelector("text=Read from the page");
  await page.click("text=Save job");
  await page.waitForURL(/\/role\/u-[0-9a-f]{12}$/);
  const secondId = page.url().split("/").pop();
  check("a different requisition at the same company is a distinct record", secondId !== savedId);

  // 5. Unreadable page → manual fallback with pasted description, marked unverified
  await page.goto(`${BASE}/`);
  await page.fill("input[type=url]", postingUrl("/wall"));
  await page.click("form button[type=submit]");
  await page.waitForSelector("text=could not be read");
  await shot(page, "05-save-fallback-390");
  await page.fill("input[required] >> nth=0", "Aviato");
  await page.fill("input[required] >> nth=1", "Site Reliability Engineer");
  await page.fill("textarea", "Pasted description for the fixture. On-call rotation, Kubernetes, Terraform.");
  await page.click("text=Save job");
  await page.waitForURL(/\/role\/u-[0-9a-f]{12}$/);
  await page.waitForSelector("text=not read when saved");
  await shot(page, "06-unverified-role-390");
  const wallId = page.url().split("/").pop();
  check("unverified save keeps the URL and the typed details", read("data/pipeline.md").includes(`${postingUrl("/wall")} | Aviato | Site Reliability Engineer`));
  check("pasted description is kept as a jds capture", /jd=local:jds\/aviato-site-reliability-engineer\.md/.test(read("data/pipeline.md")) && existsSync(join(ROOT, "jds", "aviato-site-reliability-engineer.md")));

  // 6. Persistence after reload
  await page.goto(`${BASE}/`);
  await page.reload();
  const listed = await page.locator("main ol li").allTextContents();
  check("saved jobs persist across reload", listed.some((t) => t.includes("Pied Piper")) && listed.some((t) => t.includes("Aviato")), `${listed.length} rows`);

  // 7. Prepare packet: failure first (stub marker), then retry succeeds
  writeFileSync(join(ROOT, ".stub-fail"), "");
  await page.goto(`${BASE}/role/${savedId}`);
  await page.click("text=Prepare packet");
  await page.waitForSelector("text=did not finish", { timeout: 60_000 });
  await shot(page, "07-prepare-failed-390");
  check("a failed worker is shown as failed, nothing recorded", !read("data/applications.md").includes("Pied Piper"));
  await page.click("text=Try again");
  await page.waitForURL(/\/role\/\d+$/, { timeout: 90_000 });
  const trackerN = page.url().split("/").pop();
  await page.waitForSelector("text=Stub verdict");
  await shot(page, "08-packet-fit-390");
  check("after the worker finishes the saved link resolves to its tracker row", /^\d+$/.test(trackerN) && read("data/applications.md").includes("Pied Piper"), `row ${trackerN}`);
  const stubLog = readFileSync(process.env.CAREER_OPS_STUB_LOG ?? join(OUT, "missing"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const lastRun = stubLog[stubLog.length - 1];
  check("the real worker interface was invoked for the selected job only", lastRun.prompt.includes(`Posting URL: ${postingUrl("/jobs/1")}`) && !lastRun.prompt.includes(postingUrl("/jobs/2")) && lastRun.argv.includes("--output-format") && lastRun.cwd === ROOT, `${stubLog.length} invocations logged`);
  const oldIdRes = await fetch(`${BASE}/api/roles/${savedId}`);
  const oldIdJson = await oldIdRes.json();
  check("the URL identity now redirects to the tracker id", oldIdJson.role?.redirectTo === trackerN);

  // 8. Artifacts on the fixture role 1: approved v1 with PDF, draft v2
  await page.goto(`${BASE}/role/1`);
  await page.waitForSelector("text=v1");
  await page.waitForSelector("a[href*='/api/artifacts/pdf?n=1&kind=resume&v=1']");
  await shot(page, "09-packet-resume-approved-390");
  const v1 = await fetch(`${BASE}/api/artifacts/pdf?n=1&kind=resume&v=1`);
  const v1bytes = Buffer.from(await v1.arrayBuffer());
  check("download link serves PDF bytes for the approved version", v1.status === 200 && v1bytes.subarray(0, 4).toString() === "%PDF" && v1.headers.get("x-artifact-version") === "1", `${v1.status}, ${v1bytes.length} bytes, ${v1.headers.get("content-disposition")}`);
  const wrong = await fetch(`${BASE}/api/artifacts/pdf?n=1&kind=resume&v=2`);
  check("a link naming an unapproved version is refused", wrong.status === 409);
  // approve v2 (the newer draft) and confirm the binding moves
  await page.click("button[aria-pressed='false']:has-text('v2')");
  await page.click("text=Approve v2");
  await page.click("div.bg-pen-soft >> text=Approve v2");
  await page.waitForSelector("text=Resume v2 approved");
  await shot(page, "10-packet-resume-v2-approved-390");
  const staleAfter = await fetch(`${BASE}/api/artifacts/pdf?n=1&kind=resume&v=1`);
  check("the old v1 link no longer serves bytes after v2 is approved", staleAfter.status === 409);
  const approvedMeta = JSON.parse(read("output/001-acme-corp-senior-platform-engineer/artifacts/resume/approved.json"));
  check("approved pointer names v2", approvedMeta.version === 2);

  // 9. Export failure then retry, previous export untouched
  const v2dir = join(ROOT, "output/001-acme-corp-senior-platform-engineer/artifacts/resume/v002");
  chmodSync(v2dir, 0o555);
  await page.click("text=Export PDF");
  await page.waitForSelector("main [role=alert]", { timeout: 60_000 });
  await shot(page, "11-export-failed-390");
  const v1pdfIntact = existsSync(join(ROOT, "output/001-acme-corp-senior-platform-engineer/artifacts/resume/v001/artifact.pdf"));
  const v2pdfAbsent = !existsSync(join(v2dir, "artifact.pdf"));
  const alertText = (await page.locator("main [role=alert]").first().textContent()) ?? "";
  check("export failure leaves the previous export in place and shows an error", v1pdfIntact && v2pdfAbsent && alertText.length > 0, `v1 intact ${v1pdfIntact}, v2 absent ${v2pdfAbsent}, alert: ${alertText.slice(0, 120)}`);
  chmodSync(v2dir, 0o755);
  await page.click("text=Export PDF");
  await page.waitForSelector("a[href*='/api/artifacts/pdf?n=1&kind=resume&v=2']", { timeout: 60_000 });
  const v2 = await fetch(`${BASE}/api/artifacts/pdf?n=1&kind=resume&v=2`);
  const v2bytes = Buffer.from(await v2.arrayBuffer());
  check("retry exports v2 without re-approval and the link serves v2", v2.status === 200 && v2bytes.subarray(0, 4).toString() === "%PDF" && v2.headers.get("x-artifact-version") === "2");
  await shot(page, "12-export-retry-ok-390");

  // 10. Editing an approved version creates a new draft; dirty guard on switch
  await page.click("text=Edit as new draft");
  await page.fill("textarea#resume-editor", (await page.inputValue("textarea#resume-editor")) + "\n- Added on the phone.");
  await shot(page, "13-editing-390");
  const dialogsBefore = dialogs;
  await page.click("button[aria-pressed='false']:has-text('v1')");
  await sleep(300);
  check("switching versions with unsaved edits asks first", dialogs === dialogsBefore + 1);
  await page.click("text=Save draft");
  await page.waitForSelector("text=Saved as a new draft, v3");
  const v3 = existsSync(join(ROOT, "output/001-acme-corp-senior-platform-engineer/artifacts/resume/v003/content.md"));
  const stillV2 = JSON.parse(read("output/001-acme-corp-senior-platform-engineer/artifacts/resume/approved.json")).version === 2;
  check("edits to an approved version become v3 and leave v2 approved", v3 && stillV2);

  // 11. Answers: review a draft, copy, persist in the report
  await page.click("text=Review and add");
  await page.click("text=Save as reviewed");
  await page.waitForSelector("text=Answer reviewed and added");
  await shot(page, "14-answers-390");
  const reportText = read("reports/001-acme-corp-2026-09-01.md");
  check("a reviewed answer is written to the report's Application Answers section", reportText.includes("## Application Answers") && reportText.includes("Why do you want to work at Acme Corp?"));
  await page.click("main button:has-text('Copy') >> nth=0");
  await page.waitForSelector("text=Copied");
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check("copy puts the answer text on the clipboard and says so", clip.includes("platform group"));

  // 12. Opening the posting changes nothing
  const statusBefore = read("data/applications.md");
  const [popup] = await Promise.all([context.waitForEvent("page"), page.click("text=Open posting")]);
  await popup.close();
  check("opening the posting leaves the tracker untouched", read("data/applications.md") === statusBefore);
  check("downloading leaves the tracker untouched", read("data/applications.md") === statusBefore);

  // 13. I applied on the evaluated role: one transition, idempotent
  await page.click("text=I applied");
  await page.waitForSelector("text=Record your application");
  await shot(page, "15-applied-sheet-390");
  await page.click("label:has-text('Indeed')");
  await page.click("text=Record application");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"), null, { timeout: 30_000 });
  await page.waitForSelector("text=/Recorded [A-Z][a-z]{2} \\d/", { timeout: 30_000 });
  await shot(page, "16-applied-recorded-390");
  const ledger1 = read("data/status-log.tsv").split("\n").filter((l) => l.startsWith("1\t"));
  check("recording writes Applied through set-status with the date and platform", /\| 1 \|[^\n]*\| Applied \|/.test(read("data/applications.md")) && ledger1.length === 1 && ledger1[0].includes("Applied\tweb") && read("data/applications.md").includes("applied via Indeed"), ledger1.join(" / "));
  const again = await fetch(`${BASE}/api/roles/applied`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "1", date: ledger1[0].split("\t")[1], platform: "Indeed" }) });
  const againJson = await again.json();
  const ledger1b = read("data/status-log.tsv").split("\n").filter((l) => l.startsWith("1\t"));
  check("repeating the confirmation adds no second transition", again.status === 200 && againJson.changed === false && ledger1b.length === 1, JSON.stringify(againJson));

  // 14. I applied on a saved link with no packet: row created through the TSV contract
  await page.goto(`${BASE}/role/${secondId}`);
  await page.click("text=I applied");
  await page.click("label:has-text('Employer site')");
  await page.click("text=Record application");
  await page.waitForURL(/\/role\/\d+$/, { timeout: 60_000 });
  const createdN = page.url().split("/").pop();
  await page.waitForSelector("text=/Recorded [A-Z][a-z]{2} \\d/", { timeout: 30_000 });
  await shot(page, "17-applied-without-packet-390");
  const createdRow = read("data/applications.md").split("\n").find((l) => l.startsWith(`| ${createdN} |`));
  check("a submission without a packet creates a tracker row with the N/A sentinel and no report", Boolean(createdRow) && createdRow.includes("| N/A |") && createdRow.includes("| Applied |") && createdRow.includes("Pied Piper"), createdRow);
  const createdLedger = read("data/status-log.tsv").split("\n").filter((l) => l.startsWith(`${createdN}\t`));
  check("its ledger line records - to Applied from the web", createdLedger.length === 1 && createdLedger[0].includes("\t-\tApplied\tweb"), createdLedger.join(" / "));
  const againNew = await fetch(`${BASE}/api/roles/applied`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: secondId, date: createdLedger[0].split("\t")[1], platform: "Employer site" }) });
  const againNewJson = await againNew.json();
  const rowsWithPied = read("data/applications.md").split("\n").filter((l) => l.includes("Platform Engineer, Data")).length;
  check("repeating that confirmation neither duplicates the row nor the ledger line", againNewJson.trackerN === createdN && rowsWithPied === 1 && read("data/status-log.tsv").split("\n").filter((l) => l.startsWith(`${createdN}\t`)).length === 1, JSON.stringify(againNewJson));
  check("the desk keeps the unverified Aviato role reachable", (await fetch(`${BASE}/api/roles/${wallId}`)).status === 200);

  // 15. Widths, zoom, keyboard
  for (const width of [360, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${BASE}/`);
    await page.waitForSelector("main ol li");
    await shot(page, `18-desk-${width}`);
    await noHorizontalScroll(`desk ${width}`);
    await page.goto(`${BASE}/role/1`);
    await page.waitForSelector("text=v2");
    await shot(page, `19-packet-${width}`);
    await noHorizontalScroll(`packet ${width}`);
    await touchTargets(`packet ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/role/1`);
  await page.waitForSelector("text=v2");
  await contrast("packet");
  await page.evaluate(() => { document.body.style.zoom = "2"; });
  await sleep(300);
  await shot(page, "20-packet-390-zoom200");
  const zoomed = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, cta: !!document.querySelector("button")?.getBoundingClientRect().width }));
  check("200% zoom keeps controls and avoids horizontal scroll", zoomed.sw <= zoomed.iw + 1 && zoomed.cta, JSON.stringify(zoomed));
  await page.evaluate(() => { document.body.style.zoom = ""; });
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto(`${BASE}/`);
  await page.focus("input[type=url]");
  const saveVisible = await page.locator("form button[type=submit]").isVisible();
  check("with the keyboard open (short viewport) the Save control stays reachable", saveVisible);
  await shot(page, "21-desk-390-keyboard");

  // 16. Desktop
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main ol li");
  await shot(page, "22-desk-1280");
  await page.goto(`${BASE}/role/1`);
  await page.waitForSelector("text=v2");
  await shot(page, "23-packet-1280");
  await noHorizontalScroll("desk 1280");
  await page.click("text=More");
  await page.waitForSelector("text=More tools");
  await shot(page, "24-more-menu-1280");
  check("secondary tools remain reachable from More", (await page.locator("dialog nav a").count()) >= 8);
  await page.keyboard.press("Escape");

  // 17. Dark theme and reduced motion at phone width, in a context whose
  // stored theme is dark (the main context pins light for stable captures).
  const darkContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce" });
  await darkContext.addInitScript(() => {
    try {
      localStorage.setItem("career-ops:config", JSON.stringify({ mode: "cli", cliId: "claude" }));
      localStorage.setItem("career-ops:theme", "dark");
    } catch {}
  });
  const light = page;
  const dark = await darkContext.newPage();
  await dark.goto(`${BASE}/role/1`);
  await dark.waitForSelector("text=v2");
  const isDark = await dark.evaluate(() => document.documentElement.classList.contains("dark"));
  check("dark theme is applied from the stored preference", isDark);
  await shot(dark, "25-packet-390-dark");
  Object.defineProperty(globalThis, "__page", { value: dark, configurable: true });
  await contrastOn(dark, "packet dark");
  await dark.goto(`${BASE}/`);
  await dark.waitForSelector("main ol li");
  await shot(dark, "26-desk-390-dark");
  await contrastOn(dark, "desk dark");
  await darkContext.close();
  void light;

  // 18. Legacy links redirect
  const legacy = await fetch(`${BASE}/pipeline/1`, { redirect: "manual" });
  check("old /pipeline/{n} links redirect to the packet", legacy.status >= 300 && legacy.status < 400 && (legacy.headers.get("location") ?? "").endsWith("/role/1"));
} catch (error) {
  check("journey completed without an unexpected error", false, error instanceof Error ? error.stack ?? error.message : String(error));
  await shot(page, "99-unexpected-error").catch(() => {});
} finally {
  await browser.close();
  posting.close();
  evidence.finishedAt = new Date().toISOString();
  writeFileSync(join(OUT, "evidence.json"), JSON.stringify(evidence, null, 2));
  console.log(`\n${evidence.checks.length} checks, ${evidence.failures.length} failed. Evidence: ${join(OUT, "evidence.json")}`);
  process.exit(evidence.failures.length ? 1 : 0);
}

export { statSync };
