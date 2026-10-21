---
name: refactor-safety
description: Plan, review, or perform behavior-preserving refactors, deduplication, and unused-code cleanup in Sari. Use for structural cleanup rather than feature delivery or test-only work.
---

# Refactor safety

Follow the mandatory rules and authorization boundaries in [AGENTS.md](../../../AGENTS.md). Use the relevant architecture and validation sections of [CONTRIBUTION.md](../../../CONTRIBUTION.md) for repository procedures.

## Workflow

1. Establish the requested scope, whether this is review-only or implementation, and whether any behavior changes are authorized. For review-only work, produce findings without modifying files or tracking records.
2. Inspect the relevant implementations and tests. Identify public contracts, side effects, and invariants before proposing structural changes. Trace affected consumers across `web/`, `api/`, and `packages/contracts/`, including shared package exports.
3. For removal candidates, gather evidence beyond Knip or import searches: check dynamic imports, runtime references, configuration, deployment entry points, and package scripts. For example, `api/src/app.ts` is externally invoked by Vercel. Treat unresolved consumers as a reason to retain the candidate and report the uncertainty.
4. Identify the regression risks of each proposed change. Compare behavior against contracts and requirements, not just passing tests. Where relevant, check session and ownership boundaries, persisted values, cancellation and cleanup, retry timing, error responses, and idempotent writes. Decide which existing checks or additional regression cases can detect a change in these invariants.
5. When implementation is authorized, make focused, independently reviewable modifications. Preserve the identified behavior and avoid unrelated formatting or architecture changes. If cleanup exposes a behavioral defect, separate the finding from the refactor and handle it only within authorized scope.
6. For implemented changes, run the applicable checks required by AGENTS.md, then inspect the complete diff against the invariants and consumer evidence. Passing static analysis alone does not establish safe removal or behavioral equivalence.

## Report

Explain the preserved behavior, the evidence supporting removals or retained candidates, the checks actually run and their results, and any unresolved risks or manual verification. For review-only work, distinguish recommendations from implemented changes.
