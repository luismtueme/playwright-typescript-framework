import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSummary, missingTests, COMMENT_MARKER, type JsonReport } from '../utils/prSummary';

function report(
    tests: Array<{ title: string; status: 'expected' | 'unexpected' | 'flaky' | 'skipped'; error?: string }>,
): JsonReport {
    const count = (s: string) => tests.filter((t) => t.status === s).length;
    return {
        stats: {
            expected: count('expected'),
            unexpected: count('unexpected'),
            flaky: count('flaky'),
            skipped: count('skipped'),
            duration: 12_345,
        },
        suites: [
            {
                title: 'ui/items.spec.ts',
                file: 'ui/items.spec.ts',
                suites: [
                    {
                        title: 'Items page',
                        file: 'ui/items.spec.ts',
                        specs: tests.map((t, i) => ({
                            title: t.title,
                            file: 'ui/items.spec.ts',
                            line: 10 + i,
                            tests: [
                                {
                                    projectName: 'chromium',
                                    status: t.status,
                                    results: [{ status: 'failed', error: t.error ? { message: t.error } : undefined }],
                                },
                            ],
                        })),
                    },
                ],
            },
        ],
    };
}

test('an all-green run is one line with the totals', () => {
    const md = renderSummary(
        report([
            { title: 'opens', status: 'expected' },
            { title: 'db', status: 'skipped' },
        ]),
    );
    assert.ok(md.startsWith(COMMENT_MARKER));
    assert.match(md, /### ✅ Playwright: 1 passed, 0 failed, 0 flaky, 1 skipped \(12\.3s\)/);
    assert.doesNotMatch(md, /Failed|Flaky \(/);
});

test('failures list the test, location, project and first error line, without ANSI colors', () => {
    const md = renderSummary(
        report([
            {
                title: 'adds an item',
                status: 'unexpected',
                error: '\u001b[31mError: expect(locator).toBeVisible() failed\u001b[39m\n\nLocator: ...',
            },
        ]),
    );
    assert.match(md, /### ❌/);
    assert.match(
        md,
        /\| Items page › adds an item<br>`ui\/items\.spec\.ts:10` \| chromium \| Error: expect\(locator\)\.toBeVisible\(\) failed \|/,
    );
    assert.ok(!md.includes('\u001b'), 'no terminal color codes');
});

test('flaky tests are called out, with a warning icon when nothing failed', () => {
    const md = renderSummary(report([{ title: 'sometimes slow', status: 'flaky' }]));
    assert.match(md, /### ⚠️/);
    assert.match(md, /\*\*Flaky\*\*/);
    assert.match(md, /- Items page › sometimes slow \(`ui\/items\.spec\.ts:10`, chromium\)/);
});

test('pipes in titles and errors do not break the table', () => {
    const md = renderSummary(report([{ title: 'a | b', status: 'unexpected', error: 'x | y' }]));
    assert.match(md, /a \\\| b/);
    assert.match(md, /x \\\| y/);
});

test('links to the run when a URL is given', () => {
    assert.match(
        renderSummary(report([]), { runUrl: 'https://example/run/1' }),
        /\[run artifacts\]\(https:\/\/example\/run\/1\)/,
    );
});

test('a merged report with fewer tests than the suite is flagged', () => {
    const r = report([{ title: 'only one', status: 'expected' }]);
    const md = renderSummary(r, { listedTests: 3 });
    assert.match(md, /### ❌/);
    assert.match(md, /\*\*2 test\(s\) missing from the report:\*\* the suite has 3/);
    // More tests than listed is fine: setup tests run once per shard
    assert.doesNotMatch(renderSummary(r, { listedTests: 1 }), /missing/);
});

test('missingTests counts every status and never goes below zero', () => {
    const r = report([
        { title: 'a', status: 'expected' },
        { title: 'b', status: 'unexpected', error: 'x' },
        { title: 'c', status: 'flaky' },
        { title: 'd', status: 'skipped' },
    ]);
    assert.equal(missingTests(r, 6), 2);
    assert.equal(missingTests(r, 4), 0);
    assert.equal(missingTests(r, 2), 0);
});
