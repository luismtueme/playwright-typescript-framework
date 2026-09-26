# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com), and the project uses [semantic versioning](https://semver.org).

## [Unreleased]

## [1.2.0] - 2026-09-26

### Added
- Burn-in CI job (PRs): tests affected by the PR (`--only-changed`, which follows imports) run once for fast feedback, then 10 times with no retries; a single failure blocks the merge.
- Sharded test suite (two shards, each with its own MySQL) with blob reports merged into one HTML and JSON report. The `Tests` required check is now the merge job and fails if any shard failed.
- Results summary (`utils/prSummary.ts`): totals, failures with error and location, and flaky tests, written to the Actions job summary and posted as a PR comment that updates on each push.
- Missing-tests guard: the merge job fails if the merged report has fewer tests than `playwright test --list` counts, so a lost or overwritten shard report can't pass silently. (Found on this PR's own first run: the quarantine step overwrote shard 1's blob report, and the merged report had 28 of 51 tests while every check was green.)
- Performance budgets (`tests/perf/budgets.spec.ts`, `config/performanceBudgets.json`): navigation timing, LCP and CLS per page, with the measured numbers attached to every test. New `@perf` tag.
- `BLOB_REPORT` setting for sharded runs.

### Fixed
- The test lint and the summary treated Windows file-suite titles (backslashes) as describe blocks.

## [1.1.0] - 2026-09-26

### Added
- API contract: `contracts/openapi.yaml` (OpenAPI 3.1) for the demo app, with strict response schemas.
- Generated API types (`npm run generate:api`, `contracts/openapi.d.ts`), used by the tests and the demo app; `npm run check:api` in CI fails when they're stale.
- Runtime contract checks on every API response, from the API clients and from the browser page (`utils/contract.ts`). `test.use({ contract: false })` opts out for faked responses; `OPENAPI_SPEC` points the checks at your own app's contract.
- Network fault tests (`tests/ui/network-faults.spec.ts`): server error with retry, dropped connection, slow response, failed save.
- Property-based tests with fast-check (`tests/api/items.properties.spec.ts`) and a `checkProperty` fixture seeded from the test.
- Seeded, realistic test data (`utils/testData.ts`, `random` fixture); one `TEST_SEED` per run, recorded on every test.
- Unit tests for the contract validator and the seeded generator.

### Fixed (demo app, found by the new tests)
- Names longer than 255 characters were accepted (and made MySQL return a 500); they now get a 400. Found by the property-based test.
- An invalid JSON body returned `SERVER_ERROR`; it now returns `INVALID_JSON`. Found while writing the contract.
- The items page broke on network or server errors; it now shows a loading state, an error with retry, and a plain save-failed message.

## [1.0.0] - 2026-09-26

Spec-only version of [playwright-cucumber-typescript-framework v1.1.0](https://github.com/luismtueme/playwright-cucumber-typescript-framework/releases/tag/v1.1.0): the same design, demo app and CI gates, with Playwright specs as the only way to write tests. The history of the shared features is in that repository's changelog.

### Added
- Role-based users: `test.use({ role: 'admin' | 'viewer' | 'anonymous' })`. Each role logs in once per run (one setup test per role) and has its own saved session; `apiAs(role)` gives an API client for any role. Credentials per role from `APP_*` and `VIEWER_*`.
- Demo app roles: the viewer can read but gets 403 on changes, and the items page shows a read-only notice instead of the add form. New `GET /api/me`.
- Permissions matrix (`tests/api/permissions.spec.ts`): every role against every API action, one test per cell. `tests/ui/roles.spec.ts` checks the page matches.
- Test policy lint (`npm run lint:tests`, part of `npm run check`), replacing the Gherkin linter: allowed tags, no tags in titles, and `@quarantine` requires an issue annotation. It reads Playwright's own `--list` JSON, so it sees tests exactly as Playwright does.
- Database checks as specs (`tests/db/`) with a worker-scoped `db` fixture; they skip with a reason when no database is configured.
- Lint: conditional `test.skip()` with a reason is allowed, bare skips are errors.

### Removed
- Cucumber: feature files, step definitions, hooks, the World, `cucumber.mts`, the step validator, the Gherkin linter and the pinned `@cucumber/*` packages. Every scenario already had a matching spec except the two database scenarios, which are now specs.

[Unreleased]: https://github.com/luismtueme/playwright-typescript-framework/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/luismtueme/playwright-typescript-framework/releases/tag/v1.2.0
[1.1.0]: https://github.com/luismtueme/playwright-typescript-framework/releases/tag/v1.1.0
[1.0.0]: https://github.com/luismtueme/playwright-typescript-framework/releases/tag/v1.0.0
