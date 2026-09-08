// The desk writes one labeled `note:` segment per saved row in data/pipeline.md
// (the core writer's generic free-text field). This module owns that text in
// both directions so the reader and the writer cannot disagree about it.
//
//   note: saved from web; unverified; employer=https://…; jd=local:jds/x.md; pay=£90k
//
// Every marker is optional. A row written by the scanner has no note, or a note
// this module does not understand, and reads back as "nothing known".

/**
 * @typedef {Object} SaveNote
 * @property {boolean} fromWeb
 * @property {boolean} unverified  The page could not be read when saved.
 * @property {string|null} employerUrl
 * @property {string|null} jd  `local:jds/…` reference to a pasted description.
 * @property {string|null} pay  Free-text pay the page stated but the positional column could not carry.
 */

/**
 * @param {Partial<SaveNote>} note
 * @returns {string}
 */
export function formatSaveNote({ unverified = false, employerUrl = null, jd = null, pay = null } = {}) {
  const parts = ["saved from web"];
  if (unverified) parts.push("unverified");
  if (employerUrl) parts.push(`employer=${employerUrl}`);
  if (jd) parts.push(`jd=${jd}`);
  if (pay) parts.push(`pay=${String(pay).replace(/;/g, ",")}`);
  return parts.join("; ");
}

/**
 * @param {string|undefined|null} text
 * @returns {SaveNote}
 */
export function parseSaveNote(text) {
  const out = { fromWeb: false, unverified: false, employerUrl: null, jd: null, pay: null };
  for (const raw of String(text ?? "").split(";")) {
    const part = raw.trim();
    if (!part) continue;
    if (part === "saved from web") out.fromWeb = true;
    else if (part === "unverified") out.unverified = true;
    else if (part.startsWith("employer=")) out.employerUrl = part.slice("employer=".length).trim() || null;
    else if (part.startsWith("jd=")) out.jd = part.slice("jd=".length).trim() || null;
    else if (part.startsWith("pay=")) out.pay = part.slice("pay=".length).trim() || null;
  }
  return out;
}
