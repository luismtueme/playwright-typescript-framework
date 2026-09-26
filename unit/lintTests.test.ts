import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintTestList, type ListReport } from '../utils/lintTests';

/** A one-test report in the shape of `playwright test --list --reporter=json` */
function report(spec: {
    title: string;
    tags?: string[];
    annotations?: Array<{ type: string; description?: string }>;
    projectName?: string;
}): ListReport {
    return {
        suites: [
            {
                title: 'ui/example.spec.ts',
                file: 'ui/example.spec.ts',
                suites: [
                    {
                        title: 'Example',
                        file: 'ui/example.spec.ts',
                        specs: [
                            {
                                title: spec.title,
                                file: 'ui/example.spec.ts',
                                line: 7,
                                tags: spec.tags ?? [],
                                tests: [
                                    {
                                        projectName: spec.projectName ?? 'chromium',
                                        annotations: spec.annotations ?? [],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

const rules = (r: ListReport) => lintTestList(r).map((p) => p.rule);

test('a test with allowed tags and no title tags passes', () => {
    assert.deepEqual(rules(report({ title: 'logs in', tags: ['@smoke', '@api'] })), []);
});

test('unknown-tag: tags outside the allowlist', () => {
    const problems = lintTestList(report({ title: 'logs in', tags: ['@smoke', '@wip'] }));
    assert.deepEqual(
        problems.map((p) => p.rule),
        ['unknown-tag'],
    );
    assert.match(problems[0]?.message ?? '', /@wip/);
    assert.equal(problems[0]?.location, 'ui/example.spec.ts:7');
    assert.equal(problems[0]?.title, 'Example › logs in');
});

test('tag-in-title: "@tag" in the title instead of the tag option', () => {
    // Playwright also turns title tags into tags, so @smoke here is allowed but misplaced
    assert.deepEqual(rules(report({ title: 'logs in @smoke', tags: ['@smoke'] })), ['tag-in-title']);
});

test('quarantine-ticket: @quarantine needs an issue annotation', () => {
    assert.deepEqual(rules(report({ title: 'flaky', tags: ['@quarantine'] })), ['quarantine-ticket']);
    assert.deepEqual(rules(report({ title: 'flaky', tags: ['@quarantine'], annotations: [{ type: 'issue' }] })), [
        'quarantine-ticket',
    ]);
    assert.deepEqual(
        rules(
            report({ title: 'flaky', tags: ['@quarantine'], annotations: [{ type: 'issue', description: 'QA-12' }] }),
        ),
        [],
    );
});

test('setup projects are not linted', () => {
    assert.deepEqual(rules(report({ title: 'authenticate @wip', tags: ['@wip'], projectName: 'setup' })), []);
});
