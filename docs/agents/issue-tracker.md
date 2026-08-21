# Issue tracker: GitHub

Ideas, specs, and implementation tickets for this fork live in GitHub Issues at `Melvin-Young/career-ops`. Use the `gh` CLI with `--repo Melvin-Young/career-ops` so writes never land in the upstream repository by accident.

## Conventions

- Create an idea or ticket: `gh issue create --repo Melvin-Young/career-ops --title "..." --body "..."`
- Read an issue: `gh issue view <number> --repo Melvin-Young/career-ops --comments`
- List open work: `gh issue list --repo Melvin-Young/career-ops --state open`
- Comment: `gh issue comment <number> --repo Melvin-Young/career-ops --body "..."`
- Close completed or declined work: `gh issue close <number> --repo Melvin-Young/career-ops --comment "..."`

There is no mandatory triage workflow or label vocabulary. Capture ideas when they arise, add enough context to make the desired outcome understandable, and refine an idea into implementation tickets only when it is selected for delivery.

## Specs and implementation tickets

When a skill says to publish a spec or ticket, create a GitHub issue in `Melvin-Young/career-ops`. A ticket should contain the problem, intended behavior, acceptance criteria, evidence or design links, and any blocking relationships.

Use GitHub's native issue dependencies when available. Otherwise, put `Blocked by: #<number>` near the top of the blocked ticket. Work blockers first.

Pull requests are not an idea or request-tracking surface. Do not treat upstream or external pull requests as backlog items unless the user explicitly asks.
