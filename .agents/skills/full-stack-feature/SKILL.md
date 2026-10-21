---
name: full-stack-feature
description: Plan or implement Sari features requiring coordinated shared-contract, API, and frontend integration work. Use when work crosses layers, not for isolated UI styling or unrelated cleanup.
---

# Full-stack feature

Follow the mandatory architecture and authorization rules in [AGENTS.md](../../../AGENTS.md). Consult [CONTRIBUTION.md](../../../CONTRIBUTION.md) for API conventions, frontend organization, and development commands. For planning-only requests, return a plan without editing files or executing implementation checks.

## Workflow

1. Translate the request into acceptance criteria and identify affected layers and existing patterns. Trace an existing flow through the affected layers before proposing new abstractions. Name the layers that can remain unchanged; a feature need not modify every workspace.
2. Decide whether public request or response schemas change. When needed, update Zod schemas and exported API types in `packages/contracts/`, including validation rules and compatibility expectations. Keep persistence models and internal database details in `api/`.
3. Implement the necessary backend validation, service behavior, and route integration using existing error conventions. Check session, authorization, owner-scoped access, and mutation/idempotency behavior where affected. Keep internal fields out of public DTOs.
4. Connect the frontend through the existing [HTTP transport](../../../web/src/api/apiFetch.ts) and feature API helpers. Parse successful responses with the relevant shared schema. Preserve cancellation and error handling; do not add automatic mutation retries. Keep feature state and UI within its feature, and shared components independent of feature implementations.
5. Implement the required loading, empty, success, and failure behavior, preserving drafts and preventing stale results where applicable. Review keyboard access and focus behavior for changed interactions. Introduce endpoints, hooks, or abstractions only when the acceptance criteria need them.
6. Add relevant contract, API, component, persistence, or browser coverage for the changed behavior. Choose levels that can prove each criterion; do not mechanically add every test type or modify unrelated workspaces. Exercise the affected request/response path and failure recovery using repository fixtures.
7. When implementing, run the applicable validation documented in AGENTS.md and CONTRIBUTION.md. Check that contracts, backend responses, frontend parsing, and observable UI behavior agree.

## Report

Map acceptance criteria to the behavior delivered or planned and the layers affected. State validation actually performed, any compatibility or setup requirements, remaining limitations, and manual acceptance checks.
