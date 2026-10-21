# Deferred work

Track detailed acceptance criteria in [#101](https://github.com/mcebaniqued/sari-app/issues/101) and the linked feature issues.

- [ ] Deliver a phone-friendly pantry list alongside the desktop grid in [#68](https://github.com/mcebaniqued/sari-app/issues/68), sharing server-backed search, filters, sorting, pagination, selection, and bulk actions. Coordinate sort controls with [#91](https://github.com/mcebaniqued/sari-app/issues/91).
- [ ] Set route-specific pantry document titles after login, registration, and direct navigation.
- [ ] Verify the frontend-to-API client-IP chain and define a trusted-proxy policy that preserves spoofing protections and independent authentication rate-limit buckets.
- [ ] Verify production authentication indexes, including email and session-token uniqueness, and add migrations and concurrency checks where needed.
- [ ] Coordinate API/frontend release gates so independent builds cannot expose incompatible contracts before validation completes.
- [ ] Align the API function region with Atlas and measure authentication and pantry latency.
- [ ] Choose private off-machine backup storage, retention, and scheduling for the workflow in [database operations](docs/database-operations.md).
- [ ] Add measurement preferences for barcode suggestions in [#58](https://github.com/mcebaniqued/sari-app/issues/58), preserving entered pantry values and defining conversion and rounding behavior.
- [ ] Define per-container versus total multipack suggestions in [#26](https://github.com/mcebaniqued/sari-app/issues/26), including cache compatibility and representative fixtures.
- [ ] Reduce the frontend bundle size through measured route or dependency splitting.
- [ ] Investigate Playwright API availability at the default worker count using server lifecycle and readiness diagnostics.
- [ ] Make barcode-form focus checks await focus readiness independently of product-result visibility in [#24](https://github.com/mcebaniqued/sari-app/issues/24).
- [ ] Apply explicit MongoDB scheme/host/database validation to the standalone Playwright URI guard and browser-auth cleanup, rejecting test-like hostnames without a named test database.
