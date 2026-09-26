# Contributing

Thanks for helping improve the framework. The code is strict TypeScript; `npm run typecheck` must pass. This page covers how to set up, what a good change looks like, and what CI checks before anything reaches `main`.

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env   # optional; the demo app needs no settings
npm test
```

Or run everything in Docker, MySQL included: `docker compose run --build --rm tests`.

## Making a change

1. Branch from `main`. Direct pushes to `main` are blocked.
2. Make the change, with tests. A new utility gets a unit test in `unit/`; a new page gets a page object, an accessibility line and, if its look matters, a visual test (`npm run new:page` creates the first two for you).
3. Before pushing, run the same checks CI runs:
   ```bash
   npm run lint        # ESLint (type-aware) and Prettier
   npm run typecheck   # strict type check
   npm run test:unit   # framework unit tests, with coverage thresholds
   npm run check       # every spec loads; tag and quarantine policy
   npm test            # every spec
   ```
   `npm run format` fixes most lint findings automatically.
4. Open a PR. It merges once the `Checks`, `Burn-in`, `Tests` and `Visual` jobs pass, and is squash-merged so `main` stays linear. A results summary is posted on the PR.

## Conventions

**Tests**
- Import `test` and `expect` from `tests/fixtures.ts`, not from `@playwright/test`.
- Page objects expose locators (prefer `getByRole` and `getByLabel`) and user actions. Assertions live in specs.
- Tags go in the tag option (`{ tag: '@smoke' }`), never in titles, and must be in the allowlist in `utils/lintTests.ts`. Add new tags there so they're documented.
- Pick the user with `test.use({ role: 'viewer' })`; don't log in through the UI unless the test is about logging in.
- No hard-coded waits (`waitForTimeout`) or `networkidle`: Playwright waits automatically, and lint rejects both. Use `expect.poll()` for values that aren't on the page.
- Every test cleans up what it creates: use `createItem` / `trackItem`. CI fails if rows are left behind.
- Skip only with a condition and a reason (`test.skip(!config.db, '...')`); lint rejects bare skips.
- Credentials and other secrets come from environment variables, never from committed files.

**API contract**
- Change the API in `contracts/openapi.yaml` first, then run `npm run generate:api` and commit both files. CI fails if the generated types are stale.
- Tests that fake responses (`page.route`) opt out with `test.use({ contract: false })`; everything else is checked against the contract.

**Test data**
- Use the `random` fixture (or `createItem()`) for generated values, not `Math.random()`, so a failure reproduces with its seed.

**Before pushing a new test**
- Burn it in locally: `npx playwright test --only-changed=main --repeat-each=10 --retries=0`. CI does the same on every PR, and a single failure blocks the merge.

**Flaky tests**
- Don't retry your way past a flaky test. Quarantine it with a ticket, fix the cause, and remove the tag:
  `{ tag: '@quarantine', annotation: { type: 'issue', description: 'ABC-123' } }`.
  Quarantined tests still run and report in CI, without blocking merges.

**Visual baselines**
- Update them only with `npm run test:visual -- --update` (Docker), and review the image diff in the PR. Desktop and phone baselines are separate files; check both.

**AI-generated tests**
- Tests from the Playwright agents or any AI assistant follow [AGENTS.md](AGENTS.md) and are reviewed like hand-written ones. Check that they use page objects and fixtures, and assert something meaningful.

## Versions and changelog

The project follows [semantic versioning](https://semver.org). Add your change under **Unreleased** in [CHANGELOG.md](CHANGELOG.md). When releasing, move those entries under a new version, bump `version` in `package.json`, and tag the merge commit (`git tag vX.Y.Z && git push origin vX.Y.Z`).

When Dependabot bumps `@playwright/test`, update the `FROM` line in the `Dockerfile` to match. A unit test fails with the exact line to use until you do. Visual baselines may also need `npm run test:visual -- --update` after a browser update.
