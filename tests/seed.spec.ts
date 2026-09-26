/**
 * Seed for Playwright's AI test agents (.claude/agents/). The planner and generator
 * start every scenario from this test's state: this framework's fixtures, logged in
 * as admin, on the items page. It also runs as a normal smoke test.
 *
 * To seed a different starting point, change the page it opens or add
 * `test.use({ role: 'viewer' })`.
 */
import { test, expect } from './fixtures';

test.describe('Seed', () => {
    test('seed', async ({ itemsPage }) => {
        await itemsPage.open();
        await expect(itemsPage.heading).toBeVisible();
    });
});
