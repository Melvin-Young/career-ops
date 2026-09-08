# Design plan — the application desk

Ticket: `docs/specs/CAREER-MOBILE-001-fable-redesign.md`. Art direction owner: Fable. This file is the compact plan the frontend-design process asks for, kept next to the code so later passes can read what was decided and why.

## Subject and thesis

The product is one person's application desk: a job comes in as a link, becomes a packet (fit, resume, letter, answers), and leaves as a recorded submission. The characteristic object is **the job with its packet**, so the first viewport is a place to drop a link and a list of jobs that need something from you. Nothing else competes for that space.

Thesis: **a paper docket, set in one plain typeface, with a single spine that shows how far each job has travelled.** The spine is the one bold element. Everything around it is quiet rules, weight contrast and sentence-case copy.

## Tokens

Color (light first; dark swaps roles):

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `ground` | `#EDEFF2` | `#0F1216` | page background, cool paper grey rather than cream |
| `sheet` | `#FFFFFF` | `#171B21` | the docket sheet every list and packet sits on |
| `ink` | `#151A21` | `#EEF1F4` | body and titles |
| `graphite` | `#525A66` | `#A3ACB8` | secondary text, meets 4.5:1 on sheet |
| `rule` | `#D3D8DF` | `#2A313B` | hairlines between rows and sections |
| `pen` | `#1F3FBF` | `#8FA6FF` | the one action color: primary buttons, links, focus, selected |
| `stamp` | `#9F2D2D` | `#F08A8A` | recorded submission only, the "applied" stamp |
| `caution` | `#8A5A00` | `#F2C14E` | unverified, needs review, failure text (always with a word, never alone) |

Type: **IBM Plex Sans** only (400 / 500 / 600), loaded through `next/font/google`. Tabular numerals everywhere numbers sit in a column. Roles:

- Page title 22px / 600 on phone, 28px on desktop, tracking −0.01em.
- Row title 16px / 600. Row meta 13px / 400 graphite.
- Body 15px / 400, line height 1.55, measure under 70 characters.
- Small label 12px / 500, sentence case. No uppercase eyebrows, no monospace labels.

Spacing: 4px base. Rows 12px vertical, 16px horizontal. Sections 24px apart. Page gutter 16px on phone, 32px on desktop.

Shape: sheets and sections 8px radius, controls 6px. List rows carry no border of their own, only a rule between them and a 3px rail on the left that is part of the spine language.

Motion: one moment. When a submission is recorded the spine fills to the "applied" stop over 400ms. Nothing animates on load. `prefers-reduced-motion` removes the fill.

## Layouts

Phone, the desk (`/`):

```
┌──────────────────────────────┐
│ career-ops            More ▾ │  top bar, wordmark + secondary menu
│                              │
│ ┌──────────────────────────┐ │
│ │ Paste a job link    Save │ │  the entry, 44px tall
│ └──────────────────────────┘ │
│ To do 3   Applied 2   All 6  │  segments, counts only when > 0
│ ▌Senior Platform Engineer    │  rail  title
│ ▌Acme  Manchester  £90–100k  │        company location pay
│ ▌Packet ready                │        state word
│ ─────────────────────────────│
│ ▌Staff DevOps Engineer       │
│ ▌Globex  Remote              │
│ ▌Saved, not verified         │
└──────────────────────────────┘
```

Phone, the packet (`/role/[id]`):

```
┌──────────────────────────────┐
│ ‹ Jobs                       │
│ Senior Platform Engineer     │
│ Acme  Manchester  £90–100k   │
│ [Open posting]  [I applied]  │  two 44px actions, always visible
│                              │
│ ●─ Saved   Sep 8, from LinkedIn
│ │  source link, employer link
│ ●─ Fit     4.2 of 5, verified
│ │  verdict, strengths, gaps
│ ●─ Resume  v2 approved
│ │  preview, Edit, Approve, Download v2
│ ●─ Letter  draft v1
│ ●─ Answers 2 of 3 reviewed
│ ○─ Applied not recorded
└──────────────────────────────┘
```

Desktop (≥1024px): the desk keeps a 640px column. The packet widens to 880px; artifact editing shows preview beside the editor.

Alignment: everything left-aligned to the gutter. The spine sits in the gutter so section content and the page title share one left edge.

## Principles

1. State is written, not colored: every rail color is accompanied by a word ("Saved", "Packet ready", "Applied on Sep 8").
2. Facts stay facts: unknown metadata says "not stated"; an unread page says "not verified"; a draft says "draft". No global "Ready" badge.
3. One primary action per screen: Save on the desk, I applied on the packet.
4. Secondary tools live behind More. Nothing is removed, nothing shares the first viewport.
5. Copy is plain: verbs first, sentence case, no filler.

## Review against the brief

Checked against the generic-default list before building:

- Cream, serif display and orange accent: replaced with cool grey paper, one grotesk, pen blue. The rejected treatment's `Instrument Serif` and burnt orange are gone from the tokens; secondary pages that still import the old font names receive the new face through aliases so the app stays coherent until those pages are redesigned.
- Near-black with one acid accent: dark mode is a blue-grey sheet on a darker ground, accent is a soft pen blue, no neon.
- Broadsheet hairlines with zero radius: rules are used because rows are a list, but sheets carry an 8px radius and there are no newspaper columns.
- SaaS card kit: list rows are rule-separated, not boxed; packet sections hang off one spine on one sheet. Identical rounded cards with the same shadow do not appear.
- Template chrome: no uppercase eyebrows, no middle-dot meta strings (row meta is laid out with spacing and weight), no monospace data labels, no arrows appended to buttons.

Changed during review: the first sketch used "Acme · Manchester · £90k" meta strings and a mono `v003` tag. Both were listed tells; the meta is now a spaced, weight-contrasted row and versions read "v3" in the body face.

## Skills used

- `frontend-design` (process, calibration list above).
- MengTo `tailwindcss` (responsive composition; Tailwind v4 tokens in `globals.css` take precedence over the skill's examples).
- MengTo `no-ai-design-slop` (passive gate during build and in the final pass).
- No surface, motion, shader or glass skill was loaded: the thesis needs none, and adding one would spend boldness in a second place.

## Mobbin references and what was adopted

- [Glassdoor saved jobs](https://mobbin.com/screens/e510cf9a-ddda-476b-a3e9-7df9dff2cca6): title, company, location, pay, age in that order, one row per job. Adopted the ordering and row density.
- [Handshake saved items](https://mobbin.com/screens/2e31bea5-8644-478b-9353-c19c0bcede28): saved content grouped by type with company and role separated. Adopted the separation of company from role; rejected the nested containers.
- [Handshake job detail](https://mobbin.com/screens/bdf60a86-021f-4f98-af9b-087662437283): an "at a glance" fact block and a bottom action labelled "Apply externally". Adopted the honest external-apply label ("Open posting") and the fact block for stated metadata.
- [Upwork job detail](https://mobbin.com/screens/4aff5815-0f41-4793-9fc4-455684857009): a quiet top banner when a proposal was already submitted. Adopted as the recorded-submission banner on the packet.
- [Strava end date sheet](https://mobbin.com/screens/3580352a-2566-49f5-915e-7a621fdf55e9): one question, one date, one primary button. Adopted for the "I applied" confirmation sheet.
- [Linktree PDF preview](https://mobbin.com/screens/1556454c-72a0-4899-b19f-be47547b3bf5): a document preview with a clear View action. Adopted the tangible preview; approval and version binding are our own requirements.
