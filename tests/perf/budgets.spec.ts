/**
 * Performance budgets: each page's load metrics (navigation timing, LCP, CLS) must
 * stay within config/performanceBudgets.json. The measured values are attached to
 * every test, so the report shows the numbers even when they pass.
 */
import { test, expect } from '../fixtures';
import budgets from '../../config/performanceBudgets.json';
import { measurePage, overBudget, type Budget } from '../../utils/performance';

const PAGES = ['/', '/login', '/items'] as const;

function budgetFor(path: string): Budget {
    const pages = budgets.pages as Record<string, Budget>;
    return { ...budgets.default, ...pages[path] };
}

test.describe('Performance budgets', { tag: '@perf' }, () => {
    for (const path of PAGES) {
        test(`${path} loads within budget`, async ({ page, browserName }, testInfo) => {
            test.skip(browserName !== 'chromium', 'LCP and CLS are only measured in Chromium');

            await page.goto(path);
            const metrics = await measurePage(page);
            const budget = budgetFor(path);
            await testInfo.attach('performance.json', {
                body: JSON.stringify({ path, metrics, budget }, null, 2),
                contentType: 'application/json',
            });

            expect(overBudget(metrics, budget), `metrics: ${JSON.stringify(metrics)}`).toEqual([]);
        });
    }
});
