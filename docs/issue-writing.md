# Issue-writing policy

Use this policy for every new or substantially rewritten Sari GitHub issue, whether it is created manually, through an API, or by an agent. Issue forms help collect the right information, but using a form does not by itself make an issue ready for implementation.

## Industry basis and Sari conventions

This policy combines broadly applicable practices with decisions made specifically for Sari.

Industry guidance informs these principles:

- Backlog refinement adds the detail needed for near-term work while allowing later work to remain less detailed.
- User stories describe a user need and value; acceptance criteria state the observable conditions for accepting the work.
- INVEST is a useful review aid for implementation-ready user stories, not a required issue format.
- A shared Definition of Done is distinct from issue-specific acceptance criteria.
- Given–When–Then is one optional way to make behavior examples precise.
- Native issue relationships should represent hierarchy and blocking dependencies when the platform supports them.

Sari specifically uses the four categories below, sentence-case titles without classification prefixes, proportional verification, and the repository quality expectations in [AGENTS.md](../AGENTS.md) and [CONTRIBUTION.md](../CONTRIBUTION.md). These are project conventions rather than universal industry rules.

## Choose the issue category

### Feature / User story

Use for user-facing functionality.

Required:

- The user need or problem, including the intended outcome or value
- Testable acceptance criteria

Add context or existing behavior, constraints and dependencies, out-of-scope boundaries, or specific verification scenarios when they improve clarity. Use “As a user…” only when it communicates a real perspective more clearly; do not manufacture a persona or benefit to fit a template.

### Bug / Defect

Use for behavior that violates an established requirement or expected contract. Label an issue as a bug only when the defect is confirmed; describe a suspected defect as an investigation until evidence establishes the violated expectation.

Required:

- The problem and its impact
- Actual behavior
- Expected behavior
- Reproduction steps or independently verifiable evidence
- Acceptance criteria for the resolution

Add the affected environment, branch, or version; screenshots or sanitized logs; regression scenarios; constraints; or dependencies when relevant. Never include credentials, personal data, or other secrets.

### Technical task

Use for maintenance, refactoring, infrastructure, and other internal engineering work.

Required:

- The objective and rationale
- The scope
- Verifiable completion criteria

Add technical constraints, dependencies, verification, or out-of-scope boundaries when relevant. Do not force an internal task into an artificial user story.

### Investigation / Planning / Tracking

Use for unresolved decisions, research, architectural exploration, or coordination of broader work.

Required:

- The goal or question
- The scope
- The expected deliverable or decision

Add known options and tradeoffs, a decision owner, a timebox, dependencies, or related implementation work when useful. Parent and tracking issues may remain broad until their child work is ready for refinement. An investigation can close when its agreed decision or artifact is delivered; it does not need to include or complete the resulting implementation.

## Write the title

- Use a concise, descriptive, sentence-case title.
- Prefer an action-oriented title for implementation work and an outcome-oriented title for an investigation or tracker.
- Identify the affected capability and intended result.
- Preserve proper nouns and established Sari terminology.
- Do not add classification prefixes such as `feat:`, `fix:`, or `a11y:` when labels already communicate the category.

Conventional Commit formatting still applies to commits as described in [AGENTS.md](../AGENTS.md); it is not the issue-title format.

## Write acceptance or completion criteria

Criteria must describe observable behavior or measurable deliverables that another person can verify independently.

- Cover important negative cases, boundaries, and failure conditions when they affect acceptance.
- Replace phrases such as “works correctly” or “provides good UX” with a concrete expected result.
- Use Given–When–Then only when the scenario structure makes behavior clearer.
- Use Markdown checkboxes when progress visibility is useful; they are not mandatory.
- Avoid prescribing implementation details unless they are approved constraints.
- Do not repeat shared testing and quality requirements from the Definition of Done in every issue.

For an investigation, planning item, or tracker, use completion criteria for the agreed decision, recommendation, artifact, or coordination outcome instead of inventing product behavior.

## Refine and split work

Use INVEST to evaluate an implementation-ready user story:

- **Independent:** minimizes unnecessary coupling to other work
- **Negotiable:** describes the outcome without prematurely fixing the solution
- **Valuable:** delivers a useful outcome
- **Estimable:** is understood well enough to assess its size
- **Small:** is manageable as one delivery scope
- **Testable:** has verifiable acceptance criteria

INVEST is a refinement aid, not six required issue fields. Do not force it onto bugs, technical tasks, investigations, or broad parent issues.

Split work when parts provide independently useful outcomes, have distinct dependencies, or have independently verifiable deliverables. Do not split solely by file, frontend/backend layer, discipline, or a trivial implementation sequence when the pieces do not deliver value independently.

## Record relationships and dependencies

Use each relationship for its specific meaning:

- **Parent/sub-issue:** structural decomposition of a larger outcome
- **Blocked by:** a genuine prerequisite that prevents meaningful progress
- **Related:** useful context without required implementation order

Prefer GitHub's native sub-issue and dependency relationships when available. Do not maintain a duplicate hierarchy block in the issue body unless the native relationship cannot represent information reviewers need. A related issue is not automatically a blocker.

## Separate decisions from uncertainty

Make the status of important information explicit:

- **Confirmed requirement:** approved behavior or constraint
- **Proposed approach:** a recommendation that remains open to review
- **Unresolved decision:** a question that still needs an owner or outcome

Never convert an assumption or recommendation into an acceptance criterion. If an unresolved decision materially changes scope, behavior, security, data, or architecture, record it as a blocker to implementation readiness.

## Check readiness before implementation

Use this lightweight check during refinement:

- The intended outcome is clear.
- Requirements or deliverables are sufficiently testable.
- Critical decisions are resolved.
- Genuine blockers are identified with the correct relationships.
- The scope is manageable.
- Relevant existing behavior, public contracts, and historical decisions have been considered.

Readiness is not an additional approval ceremony. A broad parent, tracker, or future idea may remain intentionally unready while the next actionable child issue meets this check.

## Apply the shared Definition of Done

Issue-specific criteria define what result must be delivered. The shared Definition of Done defines the quality expected of completed implementation across issues. Apply it in proportion to the affected behavior:

- The issue's acceptance or completion criteria are satisfied without unrelated scope changes.
- Relevant automated and manual verification is complete. Bug fixes include regression coverage, and checks required by [AGENTS.md](../AGENTS.md) pass or any blocker is reported accurately.
- The change and full diff receive appropriate review, and required CI checks pass before merge.
- Security and privacy boundaries are preserved, including keeping credentials and backend secrets out of client code, logs, commits, and reports.
- Applicable frontend changes meet the repository's accessibility expectations and include relevant regression coverage.
- Documentation is updated when behavior, setup, operations, contracts, or user guidance changes.
- All parts needed for a coherent delivery—such as contracts, configuration, migrations, tests, and documentation—are included, or an explicit limitation is recorded.

Not every change requires every test suite. Select verification that can establish confidence in the behavior and risks actually affected. Planning and investigation issues satisfy the Definition of Done when their agreed deliverables are complete and reviewed; implementation, application tests, and deployment are not implied.

## Creating issues outside the forms

The forms in [`.github/ISSUE_TEMPLATE`](../.github/ISSUE_TEMPLATE) guide creation in the GitHub UI. API-created and agent-generated issues must independently choose the correct category and comply with this policy. Before creating or rewriting an issue, check for duplicates, overlapping ownership, existing requirements, and native relationships. Changing GitHub issues requires the authorization described in [AGENTS.md](../AGENTS.md).

## References

- [The 2020 Scrum Guide](https://scrumguides.org/scrum-guide.html)
- [Agile Alliance Agile Playbook: INVEST](https://www.agilealliance.org/wp-content/uploads/2018/12/08.031.17-Agile-Playbook-2.1-v12-One-Per-Student.pdf)
- [Atlassian: User stories](https://www.atlassian.com/agile/project-management/user-stories)
- [Atlassian: Acceptance criteria](https://www.atlassian.com/work-management/project-management/acceptance-criteria)
- [GitHub Docs: About issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/about-issues)
- [GitHub Docs: Adding sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues)
- [GitHub Docs: Creating issue dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies)
- [GitHub Docs: Issue form syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [Cucumber: Gherkin reference](https://cucumber.io/docs/gherkin/reference/)
