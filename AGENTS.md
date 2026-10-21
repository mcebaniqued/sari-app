# Agent instructions

Sari is a pantry app with a React frontend in `web/`, an Express API in `api/`, shared Zod schemas and API types in `packages/contracts/`, and Playwright tests in `e2e/`.

- Use [README.md](README.md) for onboarding. Consult the relevant sections of [CONTRIBUTION.md](CONTRIBUTION.md) for architecture, configuration, testing, API behavior, or deployment as the task requires.
- Keep public request/response contracts in `packages/contracts`. Keep feature-specific frontend code inside its feature; shared frontend components and utilities must not import feature code.
- Keep database credentials and secrets backend-only. Never expose them through `VITE_` variables, logs, commits, or reports.

## Repository workflow

- Inspect the current branch, working tree, and diff before modifying files. Treat authorization to edit, create or switch branches, stage, commit, push, and open PRs as distinct; perform only actions authorized by the task. Permission for one does not authorize the others.
- When branch creation is authorized, create a new branch for each scope or purpose using a descriptive name and the appropriate base branch; do not reuse a merged branch. Do not automatically create or switch branches merely because a new task was requested.
- Keep each branch focused on its agreed scope. Report unrelated findings without implementing them or expanding the scope. When tracking updates are authorized, record actionable entries in `TODO.md` or link existing GitHub issues; check for existing entries and issues before creating duplicates.
- Group incremental commits by scope and purpose. Separate dependencies, configuration, implementation, test infrastructure, test coverage, fixes, and documentation when practical.
- For report-only audits, research, or proposals, do not modify repository files (including `TODO.md`) or create GitHub issues unless those changes are authorized. When the user requests a proposal before a substantial refactor, agree on the scope and commit breakdown before implementation.
- Keep refactors behavior-preserving unless a behavior change is authorized. Check imports, package scripts, configuration, deployment entry points, and dynamic references before removing files or exports as unused.

## Operational safety

- Require explicit authorization for production database migrations or restores, destructive operations, deployments, and credential rotations. Authorization for development work does not extend to production environments.
- Do not force-push, hard-reset, discard unrelated work, or overwrite existing changes without explicit authorization.
- Prefer non-destructive inspection and validation. Before an authorized destructive operation, explain its material impact, prerequisites, and recovery options. Keep database procedures in [docs/database-operations.md](docs/database-operations.md).

## Code quality

- Review every code change for purpose, readability, correctness, and impact. Use clear names and logical structure; add comments or JSDoc where reasoning, behavior, constraints, side effects, or tradeoffs are not obvious. Explain why when the code alone is insufficient, without restating obvious operations.
- Follow existing conventions, with ESLint, Prettier, and TypeScript as the primary enforceable quality checks. Keep formatting and refactoring within the agreed scope; do not introduce unrelated style-only changes or restructure code to suit subjective preferences.
- Separate independent declarations and meaningful steps with blank lines, keeping related statements together. Passing Prettier does not establish readability; review the logical grouping manually.
- Follow the syntax and conventions supported by each file's parser or tooling. Add comments only where supported; otherwise, put necessary explanations in the appropriate documentation. Keep `.json` files valid strict JSON.
- Review ignore rules, coverage exclusions, and lint/type suppressions when relevant to a change. Keep necessary exceptions narrowly scoped and explain their purpose in a supported comment or linked documentation; do not add exceptions merely to make checks pass.

## Validation

- Run commands from the repository root. Use `npm ci --include=optional` when installing dependencies; native build tools depend on optional packages. Root development, lint, type-check, and test scripts prepare shared contracts automatically; run `npm run contracts:build` before invoking application workspace checks directly.
- For source or configuration changes, run relevant focused checks and `npm run check` before completion. It checks formatting, lint, types, unused code, deployment configuration, unit/component tests, and production builds.
- For changes affecting persistence or browser behavior, run the applicable integration/browser coverage. Prefer `npm run test:integration` for disposable MongoDB and Playwright. Explicit database test URIs must name a database ending in `_test`; never use personal or production databases for tests.
- Derive expected behavior from public contracts, requirements, and acceptance criteria. Do not assume existing implementations or tests are correct merely because checks pass. Cover relevant failure paths, edge cases, boundaries, and regression risks, preferring assertions on observable behavior over internal implementation details.
- For every bug fix, add regression tests that reproduce the bug and verify the corrected behavior. When practical, demonstrate that the regression test fails against the defective behavior before applying the fix.
- For documentation-only changes, check formatting with `npm run format:check`, relative links, and any documented commands. Do not run application test suites unless the change affects their behavior.
- Resolve failures caused by the change and rerun affected checks. Once required checks pass, repeat or broaden validation only when new edits, failures, or unresolved concerns justify it.

## Documentation

- Keep README.md concise and focused on developer onboarding, prioritizing complete, accurate, usable instructions over a fixed line count. Use this order: app purpose, prerequisites, setup commands, verification, repository map, and links to further guidance.
- Describe the app's capabilities first and summarize the stack briefly. Make essential setup commands copyable, distinguish required settings from optional integrations, and explain how to confirm the app works after startup.
- Put detailed development, testing, API, troubleshooting, and deployment guidance in CONTRIBUTION.md or linked reference docs. Keep agent instructions in AGENTS.md and link to these guides from README.md.
- Documentation must describe current facts and procedures, without implementation histories or prior test-run reports. Keep extensive feature lists, roadmaps, and operational details out of README.md.
- Remove obsolete facts and historical narratives while preserving useful documentation. Do not delete a file merely because it is Markdown.

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

## Completion reports

- Summarize what changed, why, the checks actually run and their results, and any remaining limitations or manual verification. Distinguish local validation from CI results and report skipped or blocked checks explicitly.
- When applicable, include reviewable commit links and the branch, push, and PR status.
