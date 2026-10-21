---
name: regression-testing
description: Design, review, or add automated regression tests and assess missing behavioral coverage in Sari. Use when test quality or defect reproduction is the task, not merely to run an unchanged suite.
---

# Regression testing

Follow the testing, authorization, and database-isolation rules in [AGENTS.md](../../../AGENTS.md). Use [CONTRIBUTION.md](../../../CONTRIBUTION.md) for commands and fixture conventions. A review-only request produces coverage findings and proposed cases without edits.

## Workflow

1. Establish the intended behavior from public contracts, requirements, and acceptance criteria. Examine existing coverage and identify plausible defects and missing scenarios; do not use the implementation or passing tests as the sole oracle. Surface ambiguous expectations rather than encoding an assumption as a requirement.
2. Select the narrowest existing test level that can expose the defect or prove the behavior:
   - Vitest for shared schemas and pure logic; React Testing Library with Vitest for component behavior.
   - Supertest with existing API fixtures for endpoint validation, status codes, error payloads, and session boundaries.
   - Existing database integration suites for persistence and owner isolation; reuse [API database helpers](../../../api/test/database.ts).
   - Playwright for real browser interactions and integration; reuse [browser fixtures](../../../e2e/fixtures/pantry.ts). Use axe-core for relevant automated accessibility checks, alongside keyboard and focus assertions. Scans do not establish complete WCAG compliance.
3. Design assertions around observable outcomes and externally verifiable contracts. Include relevant invalid inputs, boundaries, failure recovery, retries, cancellation, asynchronous races, authentication, or cross-user access. Choose scenarios based on the affected behavior, not a universal checklist.
4. Validate fixtures, mocks, and assertions: use schema-valid success data, isolate failure causes, reset shared state, and confirm mocks do not bypass the behavior being tested. Use controlled promises, clocks, or events for asynchronous unit tests and browser readiness assertions instead of arbitrary delays or incidental DOM structure.
5. For a bug fix, reproduce the original defect with a failing regression test before changing the implementation when practical. Confirm the failure exposes the intended defect, then verify the corrected behavior and related cases. If the defective behavior cannot be exercised safely, explain the limitation; do not fabricate a red/green result or reset unrelated work.
6. When test execution is authorized, execute the applicable documented tests, inspect failures, and distinguish product defects from fixture or environment failures before revising expectations. Follow AGENTS.md for broader validation and rerun decisions. Do not change implementation during a test-review task unless authorized.

## Report

Describe the independent behavioral expectation, scenarios covered or missing, test levels chosen, actual execution results, any observed pre-fix failure, and unverified behavior. Separate proposed cases from executed coverage and automated checks from manual acceptance work.
