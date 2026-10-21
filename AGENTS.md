# Agent instructions

- Read [README.md](README.md) for onboarding and [CONTRIBUTION.md](CONTRIBUTION.md) for development conventions, validation commands, and deployment details before making changes.
- Keep README.md short and focused on developer onboarding. Put development guidance in CONTRIBUTION.md and agent instructions in AGENTS.md. Documentation must describe current facts and procedures, without implementation histories or prior test-run reports.

## Repository workflow

- Create a new branch for each scope or purpose. Use a descriptive branch name and the appropriate base branch; do not reuse a branch that has already been merged.
- Keep each branch focused on its agreed scope. Record unrelated findings as actionable entries in `TODO.md` instead of implementing them in the current branch. Link an existing GitHub issue when one already tracks the work.
- Group incremental commits by scope and purpose. Separate dependencies, configuration, implementation, test infrastructure, test coverage, fixes, and documentation when practical.
- For every bug fix, add regression tests that reproduce the bug and verify the corrected behavior.

## Commits and issue scope

- Map planned changes to the relevant issue and acceptance criteria before staging. An issue may require several commits; keep each commit focused on one coherent purpose and avoid mixing unrelated issues.
- Use Conventional Commit subjects: `type(scope): short imperative description` (for example, `fix(barcodes): preserve leading zeros`). Use a commit body when needed to explain the reason, tradeoffs, or validation, and reference an existing issue with `Refs #123`. Do not invent issue numbers or use closing keywords for partial work.
- Select files by their contribution to the commit's purpose, not by directory or file extension. Include the source, configuration, migrations, lockfiles, tests, or documentation needed for that change; separate independently reviewable work when practical without leaving commits unnecessarily broken.
- Inspect the working tree and diff before staging. Stage explicit paths or individual hunks when files contain multiple concerns, then review the staged diff and file list before committing. Do not include unrelated user edits, secrets, local environment files, or incidental generated output.
- When several issues touch the same file, split changes by hunk or incremental commit where practical. Keep shared prerequisites in a clearly identified commit and describe which issues depend on them.
- For PRs covering multiple issues, map each issue to the behavior delivered and the relevant commit or commit group in `Related issues`. Identify partial coverage and remaining work; close an issue only when its acceptance criteria are satisfied.

## Pull request descriptions

- Use a concise, reviewer-friendly format with these sections, in order: `Summary`, `Changes`, `Testing`, `Setup and limitations`, and `Related issues`. Omit sections that do not apply.
- Lead with the concrete problem and resulting user behavior. Keep the title descriptive and group changes into short bullets with clear labels when helpful.
- Report the validation actually performed and its results. Separate passed checks from remaining manual acceptance checks; do not imply local checks are CI results.
- Include relevant setup requirements, known limitations, deferred scope, and links to documentation or follow-up issues. Avoid boilerplate and conversational history.
- Link related issues. Use automatic closing keywords only when the PR fully resolves the linked issue.
