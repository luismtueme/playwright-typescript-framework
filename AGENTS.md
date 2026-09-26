# Conventions for AI assistants

Instructions for AI coding assistants (Claude Code, Copilot, Cursor, Codex) and for
Playwright's test agents in `.claude/agents/`. Humans: the same rules are in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Writing tests

- Import `test` and `expect` from `tests/fixtures.ts`, never from `@playwright/test`.
- Put browser tests in `tests/ui/`, API tests in `tests/api/`, database checks in `tests/db/`.
- Use page objects from `pages/`. If a test needs a locator that isn't there, add it to the
  page object (prefer `getByRole`, `getByLabel`, `getByText`), then use it from the test.
  Keep `expect` out of page objects.
- New page? Scaffold it: `npm run new:page -- <Name> --path /<url>` creates the page object,
  a spec and an accessibility check that already pass lint.
- Tests start logged in as `admin`. For another user: `test.use({ role: 'viewer' })` or
  `test.use({ role: 'anonymous' })`. Don't log in through the UI unless the test is about logging in.
- Create data with `createItem()`, or register anything you create with `trackItem()`, so it's
  deleted after the test. CI fails if rows are left behind.
- Tags go in the tag option, from the allowlist in `utils/lintTests.ts`:
  `test('...', { tag: '@smoke' }, async ({ ... }) => { ... })`. Never put `@tags` in titles.
- Use `test.step()` for multi-step tests so reports read like a scenario.
- Never use `page.waitForTimeout()` or `waitForLoadState('networkidle')`; web-first assertions
  wait automatically, and `expect.poll()` handles values that aren't on the page.
- Every API response is checked against `contracts/openapi.yaml`. Only tests that fake responses
  with `page.route` may use `test.use({ contract: false })`.

## When a test fails and you can't fix it

Don't use `test.fixme()`, `test.skip()` without a condition, or retries to hide it. Quarantine it
with a ticket, which keeps it running and reporting without blocking merges:

```typescript
test('...', { tag: '@quarantine', annotation: { type: 'issue', description: 'ABC-123' } }, async () => { ... });
```

If there's no ticket yet, leave the test failing and explain the cause instead.

## Before you finish

Run these; all must pass:

```bash
npm run lint && npm run typecheck && npm run check
npx playwright test <the files you changed>
npx playwright test --only-changed=main --repeat-each=10 --retries=0   # what CI's burn-in will run
```
