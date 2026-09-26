# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com), and the project uses [semantic versioning](https://semver.org).

## [Unreleased]

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

[Unreleased]: https://github.com/luismtueme/playwright-typescript-framework/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/luismtueme/playwright-typescript-framework/releases/tag/v1.0.0
