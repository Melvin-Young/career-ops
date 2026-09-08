# Domain Docs

How engineering skills should consume this repository's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repository root.
- Relevant ADRs under `docs/adr/`.

If either location does not exist, proceed silently. Do not create placeholder domain documentation. The `domain-modeling` skill creates or updates these files when terminology or a hard-to-reverse decision is actually resolved.

## File structure

This is a single-context repository:

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-example-decision.md
│       └── 0002-another-decision.md
└── ...
```

## Use the glossary's vocabulary

When an issue title, specification, test, or implementation names a domain concept, use the term defined in `CONTEXT.md`. Do not drift to synonyms that the glossary explicitly avoids.

If a needed concept is missing, first determine whether the repository already uses a different term. If the concept is genuinely new or ambiguous, resolve it through `domain-modeling` and record the result.

## Flag ADR conflicts

If proposed work conflicts with an existing ADR, surface that conflict explicitly instead of silently overriding the decision. Reopen the decision only with evidence and a recorded replacement or amendment.
