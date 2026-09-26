# Playwright TypeScript Framework

UI, API, database, accessibility and visual test automation with [Playwright Test](https://playwright.dev), in strict TypeScript, reported in [Allure](https://allurereport.org).

Tests are plain Playwright specs (`*.spec.ts`). Page objects, API clients, test data and logged-in users are injected as fixtures, so a test reads as the behavior it checks.

[![Playwright Tests](https://github.com/luismtueme/playwright-typescript-framework/actions/workflows/playwright.yml/badge.svg)](https://github.com/luismtueme/playwright-typescript-framework/actions/workflows/playwright.yml) · [Latest Allure report](https://luismtueme.github.io/playwright-typescript-framework/allure-report/)

## Which repo should I use?

This is one of three versions of the same framework. They share the design, the demo app and the CI gates.

| Repository | Tests are written as | Language | Choose it when |
|---|---|---|---|
| **playwright-typescript-framework** (this one) | Playwright specs | TypeScript | Engineers write and read the tests. The most features and the simplest toolchain |
| [playwright-cucumber-typescript-framework](https://github.com/luismtueme/playwright-cucumber-typescript-framework) | Gherkin scenarios and Playwright specs | TypeScript | Product owners, analysts or manual QA read or write scenarios in Given/When/Then |
| [playwright-cucumber-automation-framework](https://github.com/luismtueme/playwright-cucumber-automation-framework) | Gherkin scenarios and Playwright specs | JavaScript (type-checked with JSDoc) | You want Cucumber without a TypeScript toolchain |

## What's included

| Area | How it works |
|---|---|
| UI tests | Page objects with role and label locators (`pages/`), Playwright auto-waiting, no hard-coded waits (enforced by lint) |
| Roles | `test.use({ role: 'viewer' })` runs a test as that user. Each role logs in once per run; a permissions matrix checks every role against every API action |
| API tests | Typed `ApiClient` on Playwright's request API: `api.post<Item>(...)` |
| API contract | An OpenAPI document (`contracts/openapi.yaml`) is the source of truth. TypeScript types are generated from it, so an API change breaks compilation, and **every API response in every test**, from API clients and from the browser page, is checked against it at runtime |
| Resilience | Network fault tests with `page.route`: server errors, dropped connections, slow responses, failed saves |
| Generated inputs | Property-based tests (fast-check) state a rule and check it against many generated inputs, including unicode, emoji and edge lengths. They found a real bug in the demo app |
| Reproducible data | Seeded, realistic test data. A failed test's report shows the seed; `TEST_SEED=...` reproduces it exactly |
| Performance budgets | Each page's load metrics (navigation timing, LCP, CLS) must stay within `config/performanceBudgets.json`; the measured numbers are attached to every test |
| Phones | Nightly runs repeat the suite on Pixel 7 and iPhone 15 profiles (viewport, touch, mobile user agent), and visual baselines exist per viewport. A PR test checks every page lays out at phone width |
| Productivity | `npm run new:page` scaffolds a page object, fixture, spec and accessibility check that pass lint; `npm run codegen` records from a logged-in session; Playwright's AI test agents (planner, generator, healer) are set up to follow this framework's conventions |
| Fast, trustworthy CI | New and changed tests run 10 times before merging (burn-in); the suite is sharded across machines with one merged report; every PR gets a results summary comment |
| Database checks | `DbClient` (MySQL, pooled, parameterized). `@db` tests verify what the API wrote; CI runs them against a real MySQL |
| Test data | Factories with automatic cleanup (`createItem`, `trackItem`). CI fails if any rows are left behind |
| Accessibility | axe-core checks every page against WCAG 2.1 A/AA, plus aria snapshots of each page's structure |
| Visual comparison | Screenshots compared with committed baselines, rendered in Playwright's Docker image so every machine matches |
| Time | `page.clock` makes time-dependent behavior (a 15-minute session timeout) testable in milliseconds |
| Failure evidence | Screenshot, trace and video for every failed test |
| Reporting | Playwright HTML report and Allure with steps, attachments, trend history and failure categories |
| Flaky tests | Tag `@quarantine` with a ticket: the test still runs and reports, but doesn't block merges |
| Quality gates | Type-aware ESLint (catches unawaited promises), Prettier, strict type check, test policy lint, framework unit tests with coverage thresholds, `npm audit`, all required to merge |
| Cross-browser | Every PR runs on Chromium. A nightly job runs everything on Chromium, Firefox and WebKit |
| Docker | `docker compose run --build --rm tests` runs everything, MySQL included |
| Demo app | `demo-app/`: a small web app and JSON API the examples run against, so everything passes out of the box |

## Quick start

Requires Node.js 22.8 or newer. Or skip the local setup entirely: `docker compose run --build --rm tests`.

```bash
npm install
npx playwright install chromium
npm test
```

`npm test` starts the demo app automatically and runs every spec. To see the report:

```bash
npx playwright show-report html-report   # Playwright's report
npm run report                           # Allure
```

## Testing your own application

1. Copy `.env.example` to `.env` and set at least:
   ```bash
   BASE_URL=https://your-app.example.com
   APP_USERNAME=your-admin-test-user
   APP_PASSWORD=...
   VIEWER_USERNAME=your-read-only-test-user
   VIEWER_PASSWORD=...
   ```
2. Update the login in `tests/auth.setup.ts` for your app, and the roles in `config/index.ts` (`ROLES`, `ROLE_ENV`).
3. Replace the page objects in `pages/` and the specs in `tests/` with your own, and write factories like `createItem` for your data.
4. Delete `demo-app/` once nothing points at it.

When `BASE_URL` is set, the demo app isn't started and the demo credentials are never used.

## Configuration

Settings are read in this order, first match wins: **environment variables**, then **`.env`**, then **`config/testConfig.json`** (non-secret defaults). Every variable is listed in [`.env.example`](.env.example).

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | empty (demo app) | Application under test |
| `API_BASE_URL` | `BASE_URL` | API host, if different |
| `APP_USERNAME` / `APP_PASSWORD` | demo credentials for the demo app only | The `admin` role |
| `VIEWER_USERNAME` / `VIEWER_PASSWORD` | demo credentials for the demo app only | The `viewer` role |
| `TEST_BROWSER` | `chromium` | `chromium`, `firefox` or `webkit` |
| `TEST_DEVICE` | unset (desktop) | A [Playwright device](https://playwright.dev/docs/emulation#devices) such as `Pixel 7` or `iPhone 15`; runs in that device's browser |
| `HEADLESS` | `true` in CI | Show the browser locally with `HEADLESS=false` |
| `WORKERS` / `RETRIES` | CI: 2 / 1, local: 4 / 0 | Parallelism and retries |
| `VIDEO` / `TRACE` | `retain-on-failure` | `off`, `on` or `retain-on-failure` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | unset | Enables the `@db` tests |
| `TEST_ENV` | `local` | Environment label in the report |
| `LOG_LEVEL` | `warn` locally, `info` in CI | `error`, `warn`, `info` or `debug` |
| `OPENAPI_SPEC` | the demo app's contract | OpenAPI document (path or URL) that responses are checked against. For a real app, checks stay off until you set it |
| `TEST_SEED` | new per run | Seed for generated data and property tests; copy it from a failed test's report to reproduce |

Invalid values fail at startup with the variable name, for example `TEST_BROWSER must be one of chromium, firefox, webkit, got "ie11"`.

## Running tests

| Command | What it runs |
|---|---|
| `npm test` | Clean results, then every spec |
| `npx playwright test --grep @smoke` | Tests by tag (`{ tag: '@smoke' }`). Allowed tags: `@smoke`, `@api`, `@db`, `@a11y`, `@visual`, `@perf`, `@quarantine` |
| `npx playwright test --only-changed=main` | Only the tests affected by your changes (what CI burns in) |
| `npx playwright test --only-changed=main --repeat-each=10 --retries=0` | Burn-in locally: catch a flaky test before CI does |
| `npx playwright test tests/ui/login.spec.ts` | One file |
| `npx playwright test --ui` | Playwright's UI mode: watch, pick and debug tests |
| `TEST_BROWSER=webkit npm test` | Everything in another browser |
| `TEST_DEVICE="iPhone 15" npm test` | Everything on a phone profile |
| `npm run new:page -- Settings --path /settings` | Scaffolds a page object, its fixture, a spec and an accessibility check |
| `npm run new:spec -- checkout --page items` | Scaffolds a UI spec for an existing page object (`--api --path /api/x` for an API spec) |
| `npm run codegen -- /items` | Playwright's code generator, already logged in (`--role viewer` for another user) |
| `npm run test:visual` | Visual comparison in Docker. Add `-- --update` to accept new baselines |
| `npm run test:quarantine` | Only `@quarantine` tests |
| `npm run test:unit` | Unit tests for the framework code (`unit/`), failing below 90% line coverage |
| `npm run check` | Lists every test (catches load errors) and runs the test policy lint |
| `npm run generate:api` | Regenerates `contracts/openapi.d.ts` from the contract |
| `npm run check:api` | Fails if the generated types are out of date (CI runs it) |
| `npm run lint` / `npm run format` | ESLint and Prettier check / auto-fix |
| `npm run typecheck` | Strict type check (no build step) |
| `npm run demo` | Starts the demo app on http://127.0.0.1:4173 |
| `docker compose run --build --rm tests` | Everything in Docker with MySQL |

The `@db` tests skip themselves when `DB_HOST` isn't set. To run them locally:

```bash
docker run -d --name test-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=testdb -e MYSQL_USER=tester -e MYSQL_PASSWORD=tester mysql:8.4
DB_HOST=127.0.0.1 DB_USER=tester DB_PASSWORD=tester DB_NAME=testdb npm test
```

## Project structure

```
├── config/
│   ├── index.ts              # Loads and validates configuration, roles and credentials
│   ├── testConfig.json       # Non-secret defaults
│   └── performanceBudgets.json # Load-time budgets per page
├── contracts/
│   ├── openapi.yaml          # API contract: source of truth for types and response checks
│   └── openapi.d.ts          # Generated types (npm run generate:api)
├── demo-app/                 # Example app under test (delete when you adopt the framework)
├── pages/                    # Page objects (BasePage, FormPage, LoginPage, ItemsPage)
├── tests/
│   ├── fixtures.ts           # Custom fixtures: roles, page objects, API clients, test data
│   ├── auth.setup.ts         # Logs in once per role and saves the sessions
│   ├── seed.spec.ts          # Starting point for the AI test agents
│   ├── ui/                   # Browser tests: accessibility, roles, session timeout, network faults
│   ├── api/                  # API tests, permissions matrix, generated-input tests
│   ├── db/                   # Database checks (skip without DB_HOST)
│   ├── perf/                 # Performance budgets
│   └── visual/               # Screenshot tests and committed baselines (__screenshots__/)
├── specs/                    # Test plans written by the AI planner agent
├── unit/                     # Unit tests for the framework itself (node:test)
├── utils/
│   ├── apiClient.ts          # HTTP client (Playwright request API)
│   ├── contract.ts           # Validates responses against the OpenAPI contract
│   ├── generateApiTypes.ts   # Generates and checks contracts/openapi.d.ts
│   ├── testData.ts           # Seeded random data (TEST_SEED)
│   ├── performance.ts        # Page load metrics (navigation timing, LCP, CLS)
│   ├── prSummary.ts          # Results summary for the PR comment and job summary
│   ├── scaffold.ts           # npm run new:page / new:spec
│   ├── codegen.ts            # npm run codegen, logged in
│   ├── dbClient.ts           # MySQL client
│   ├── authState.ts          # Where each role's saved session lives
│   ├── accessibility.ts      # axe-core WCAG checks
│   ├── lintTests.ts          # Test policy lint: allowed tags, quarantine tickets
│   ├── checkLeftoverData.ts  # Fails CI if tests left rows in the database
│   ├── visual.ts             # Runs visual tests in the Playwright Docker image
│   ├── runQuarantine.ts      # Runs @quarantine tests
│   ├── logger.ts             # Leveled logger (LOG_LEVEL)
│   ├── allureMetadata.ts     # Report environment, executor and categories
│   └── allureCategories.ts   # Failure categories
├── playwright.config.ts
├── tsconfig.json
├── eslint.config.ts
├── Dockerfile, docker-compose.yml
├── .claude/agents/, .mcp.json # Playwright AI test agents and their MCP server
├── AGENTS.md                 # Conventions for AI coding assistants (CLAUDE.md points here)
└── .env.example              # Every supported variable
```

## How TypeScript runs here

There is no build step. Playwright runs the specs and `playwright.config.ts` with its built-in TypeScript support; the demo app, scripts and unit tests run through `tsx`. Type errors never stop a test run, so `npm run typecheck` (`tsc --noEmit` over everything) is a separate required CI check.

## Writing tests

### A spec

Import `test` from `tests/fixtures.ts` to get page objects, API clients and test data injected. Browser tests start logged in as `admin`:

```typescript
import { test, expect } from '../fixtures';

test('lists items created through the API', async ({ itemsPage, createItem }) => {
    const item = await createItem(); // deleted automatically after the test
    await itemsPage.open(); // already logged in
    await expect(itemsPage.item(item.name)).toBeVisible();
});

test.describe('as a visitor', () => {
    test.use({ role: 'anonymous' }); // no session

    // Tags are structured (filter with --grep @smoke); steps show up in both reports
    test('logs in', { tag: '@smoke' }, async ({ loginPage, credentials }) => {
        await test.step('submit the configured credentials', async () => {
            await loginPage.open();
            await loginPage.login(credentials.username, credentials.password);
        });

        await test.step('the welcome message names the user', async () => {
            await expect(loginPage.welcome).toHaveText(`Welcome, ${credentials.username}`);
        });
    });
});
```

| Fixture | Gives you |
|---|---|
| `role` (option) | `'admin'` (default), `'viewer'` or `'anonymous'`; set with `test.use({ role })` |
| `formPage`, `loginPage`, `itemsPage` | Page objects on the test's page |
| `api` | `ApiClient` without a token (never carries the browser session) |
| `authedApi` | `ApiClient` logged in as admin, for setup and cleanup |
| `apiAs(role)` | `ApiClient` logged in as any role |
| `createItem(overrides?)` | Creates an item via the API and deletes it after the test |
| `trackItem(item)` | Deletes an item you created another way (e.g. through the UI) after the test |
| `credentials` | `{ username, password }` of the test's role |
| `checkAccessibility(options?)` | Runs axe on the page, attaches the results, fails on any violation |
| `db` | `DbClient` (worker-scoped); use only in tests that skip without a database |
| `random` | This test's seeded generator; its seed is recorded in the report |
| `checkProperty(inputs, rule)` | Runs a property-based check, seeded from the test |
| `contract` (option) | Contract checks on every response (default); `test.use({ contract: false })` for tests that fake responses |

### Roles and permissions

`tests/api/permissions.spec.ts` holds the permissions as a table, one test per role and action, so a failure names the exact cell:

```typescript
const MATRIX = {
    admin:     { 'list items': 200, 'create an item': 201, 'delete an item': 204, ... },
    viewer:    { 'list items': 200, 'create an item': 403, 'delete an item': 403, ... },
    anonymous: { 'list items': 401, 'create an item': 401, 'delete an item': 401, ... },
};
```

`tests/ui/roles.spec.ts` checks the page matches: the viewer sees the list, a read-only notice, and no add form.

### A page object

```typescript
import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
    static override path = '/login';

    readonly username: Locator;
    readonly password: Locator;
    readonly submitButton: Locator;

    constructor(page: Page) {
        super(page);
        this.username = page.getByLabel('Username');
        this.password = page.getByLabel('Password');
        this.submitButton = page.getByRole('button', { name: 'Log in' });
    }

    async login(username: string, password: string): Promise<void> {
        await this.username.fill(username);
        await this.password.fill(password);
        await this.submitButton.click();
    }
}
```

Expose locators and user actions, and keep `expect` out of page objects so a failure points at the test that made the claim.

### Scaffolding and recording

`npm run new:page -- Settings --path /settings` creates `pages/SettingsPage.ts`, registers a `settingsPage` fixture, and adds `tests/ui/settings.spec.ts` and an accessibility check. Everything it writes passes lint and typecheck, so you start from green and fill in locators. `npm run new:spec` adds a spec for an existing page object, or an API spec with `--api`. (In Git Bash, prefix commands that take `--path /x` with `MSYS_NO_PATHCONV=1`, or use PowerShell; Git Bash rewrites arguments that start with `/`.)

`npm run codegen -- /items` logs in through the API, as the setup project does, and opens Playwright's code generator on that page with the session loaded, starting the demo app if needed. Record the steps, then move the locators into a page object.

### AI test agents

Playwright's [test agents](https://playwright.dev/docs/test-agents) are set up for Claude Code (`.claude/agents/`, `.mcp.json`). The planner explores the app and writes a plan to `specs/`, the generator turns a plan into a spec by driving a real browser, and the healer debugs failing tests. They start from `tests/seed.spec.ts` (logged in, using this framework's fixtures) and follow [AGENTS.md](AGENTS.md): page objects, roles, cleanup and tags. The healer is told to quarantine with a ticket instead of marking tests `fixme`. Generated tests go through the same CI gates as any other PR. See [specs/README.md](specs/README.md) for a walkthrough.

### Accessibility and page structure

`tests/ui/accessibility.spec.ts` runs axe on every page; add a line for each new page, or call `checkAccessibility()` in any test. Aria snapshots check a page's structure (headings, roles, labels) and ignore styling, so they're steadier than screenshots for what a page contains:

```typescript
await expect(page.getByRole('main')).toMatchAriaSnapshot(`
  - main:
    - heading "Log in" [level=1]
    - textbox "Username"
    - button "Log in"
`);
```

List only the parts you care about: omitted nodes are allowed. Get the current structure with `await page.getByRole('main').ariaSnapshot()`.

### Time-dependent behavior (page.clock)

```typescript
await page.clock.install({ time: new Date('2026-01-05T09:00:00') }); // before the page loads
await itemsPage.open();
await page.clock.fastForward('14:59'); // not expired yet
await page.clock.fastForward('00:01'); // exactly 15 minutes: expired
```

### Waiting for things that aren't on the page (expect.poll)

Locator assertions retry on their own. For API or database values, `expect.poll()` retries until the assertion passes, so tests stay correct when the app saves asynchronously:

```typescript
await expect.poll(() => db.count('items', 'id = ?', [item.id])).toBe(0);
```

### API contract

`contracts/openapi.yaml` describes every endpoint, status and response body, and its response schemas forbid undocumented fields. Two things follow from it:

- **Types.** `npm run generate:api` writes `contracts/openapi.d.ts`, and the tests and the demo app use those types (`components['schemas']['Item']`). Renaming a field in the contract breaks compilation wherever the old name is used. CI fails if the generated file is stale.
- **Runtime checks.** The fixtures validate every API response against the contract: from `api`, `authedApi` and `apiAs()`, and from the browser page's own requests. An undocumented status, a missing or extra field, or a wrong type fails the test that received it, naming the exact problem:

```
ContractViolation: API response does not match the contract:
  - GET /api/items/{id} -> 200: body must NOT have additional properties (secret)
```

For your app, set `OPENAPI_SPEC` to its OpenAPI document (file or URL); `npm run generate:api` reads the same variable.

### Network faults

`page.route` intercepts the page's requests, so failures are exact and repeatable. `tests/ui/network-faults.spec.ts` covers a server error with retry, a dropped connection, a slow response (held until the test releases it) and a failed save. Faked responses aren't in the contract, so those tests use `test.use({ contract: false })`.

### Generated inputs (property-based tests)

Instead of a few chosen examples, state the rule and let fast-check generate the inputs:

```typescript
test('any name is either saved trimmed or rejected with 400, never a server error', async ({ authedApi, trackItem, checkProperty }) => {
    await checkProperty(names, (name) => checkName(authedApi, trackItem, name));
});
```

A failure is shrunk to the smallest input that still fails, and reproduces with the test's seed. On its first run, this test found that the demo app accepted names over 255 characters: the contract check flagged it with the in-memory store, and with MySQL the same input caused a 500.

### Reproducible test data

Every run has one seed (`TEST_SEED`, or a new one per run), and each test gets its own generator from it through the `random` fixture. `createItem()` uses it for realistic names like "Lateral 214 CCTV survey". The seed is in every test's report annotations; re-run with it to get exactly the same data:

```bash
TEST_SEED=28259670 npx playwright test tests/ui/items.spec.ts
```

### Performance budgets

`tests/perf/budgets.spec.ts` loads each page and checks its metrics against `config/performanceBudgets.json` (a `default` budget, with per-page overrides). The numbers are attached to every test, so the report shows them even when they pass. LCP and CLS are measured in Chromium only. CI machines are noisy, so keep budgets loose enough to avoid false alarms and tight enough to catch a real regression: an 800ms slowdown on the login page fails with `ttfb 814 > budget 500`.

### Visual comparison

Specs in `tests/visual/` compare screenshots with baselines in `tests/visual/__screenshots__/`. They run only through `npm run test:visual`, which uses the Playwright Docker image so fonts and anti-aliasing match everywhere (running them outside Docker is refused). After an intended UI change, run `npm run test:visual -- --update` and review the new images in the PR. Mask anything that changes between runs with `mask: [locator]`. Each page is compared at desktop size and on Pixel 7 and iPhone 15 (in their own browsers), with baselines per viewport (`__screenshots__/<spec>/pixel-7/`, `.../iphone-15/`). `TEST_DEVICE="Pixel 7" npm run test:visual` checks one device.

### Quarantining a flaky test

1. Open a ticket, then tag the test and link the ticket:
   ```typescript
   test('...', { tag: '@quarantine', annotation: { type: 'issue', description: 'QA-123' } }, async () => { ... });
   ```
2. It no longer runs in the normal suite. CI runs it in a separate, non-blocking step, so its results still appear in the report.
3. Fix it and remove the tag. `npm run check` rejects `@quarantine` without an issue annotation, unknown tags, and tags written in titles.

## Reporting

- **Playwright HTML report** (`html-report/`): every test with its steps, errors, screenshots, videos and traces. Open traces with `npx playwright show-trace <file>.zip`, or at [trace.playwright.dev](https://trace.playwright.dev).
- **Allure** (`npm run report`): the same, plus trend history and failure categories (Application Bug, Flaky Test, Test Defect, Infrastructure).

In CI, the Allure report for every push to `main` is published to GitHub Pages. For PRs, download the `allure-results` and `test-artifacts` artifacts from the run.

## CI

`.github/workflows/playwright.yml` runs on every PR and push to `main`:

| Job | Runs |
|---|---|
| Checks | Lint and format, type check, API types match the contract, `npm audit` (high and critical), unit tests with coverage thresholds, test list and policy lint |
| Burn-in | PRs only. The tests affected by the PR (`--only-changed`, which follows imports) run once for fast feedback, then 10 more times without retries. A test that fails once is flaky, and doesn't merge |
| Tests (shard 1/2, 2/2) | The full suite split across two machines, each with its own MySQL. Then quarantined tests (non-blocking) and a check that no test data was left behind |
| Tests | Merges the shard reports into one HTML report, writes the results summary to the job and as a PR comment (updated on each push), and fails if any shard failed |
| Visual | Screenshot comparison in the Playwright Docker image. Uploads expected/actual/diff images on failure |
| Publish Allure Report | On `main` only: builds the report and deploys it to GitHub Pages |
| Nightly Cross-Browser | Daily at 06:00 UTC (and on demand): everything on Chromium, Firefox and WebKit, and on Pixel 7 and iPhone 15 profiles. Not required to merge |

`main` is protected: changes need a PR with Checks, Burn-in, Tests and Visual passing. Dependabot opens weekly update PRs. See [.github/GITHUB_ACTIONS_GUIDE.md](.github/GITHUB_ACTIONS_GUIDE.md) for setup in your own repository.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to make changes, and [CHANGELOG.md](CHANGELOG.md) for what changed in each version.

## License

MIT. See [LICENSE](LICENSE).
