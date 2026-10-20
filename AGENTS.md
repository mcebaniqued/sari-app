# Repository workflow

- Create a new branch for each scope or purpose. Use a descriptive branch name and the appropriate base branch; do not reuse a branch that has already been merged.
- Keep each branch focused on its agreed scope. Record unrelated findings as actionable entries in `TODO.md` instead of implementing them in the current branch. Link an existing GitHub issue when one already tracks the work.
- Group incremental commits by scope and purpose. Separate dependencies, configuration, implementation, test infrastructure, test coverage, fixes, and documentation when practical.

# Pull request descriptions

- Use a concise, reviewer-friendly format with these sections, in order: `Summary`, `Changes`, `Testing`, `Setup and limitations`, and `Related issues`. Omit sections that do not apply.
- Lead with the concrete problem and resulting user behavior. Keep the title descriptive and group changes into short bullets with clear labels when helpful.
- Report the validation actually performed and its results. Separate passed checks from remaining manual acceptance checks; do not imply local checks are CI results.
- Include relevant setup requirements, known limitations, deferred scope, and links to documentation or follow-up issues. Avoid boilerplate and conversational history.
- Link related issues. Use automatic closing keywords only when the PR fully resolves the linked issue.
