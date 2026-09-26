/**
 * Allure failure categories, written to allure-results/categories.json by the
 * Playwright global setup.
 *
 * Allure checks categories in order and uses the first match. Regexes must
 * match the whole message, so they start with (?s).* to span multiple lines.
 *
 * "failed" = an assertion did not hold (likely an application bug).
 * "broken" = the test itself errored (bad selector, timeout, crash).
 */
export interface Category {
    name: string;
    description: string;
    matchedStatuses: Array<'failed' | 'broken' | 'passed' | 'skipped'>;
    messageRegex?: string;
    traceRegex?: string;
}

export const allureCategories: readonly Category[] = [
    {
        name: 'Infrastructure Problem',
        description: 'Network or environment failures, not the application under test.',
        matchedStatuses: ['failed', 'broken'],
        messageRegex: '(?s).*(ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|net::ERR_).*',
    },
    {
        name: 'Application Bug',
        description: 'An assertion failed: the application did not behave as expected.',
        matchedStatuses: ['failed'],
    },
    {
        name: 'Flaky Test',
        description: 'Timed out waiting for an element or action. Often intermittent.',
        matchedStatuses: ['broken'],
        messageRegex: '(?s).*Timeout.*exceeded.*',
    },
    {
        name: 'Test Defect',
        description: 'The test code errored (bad selector, missing data, script error).',
        matchedStatuses: ['broken'],
    },
];
