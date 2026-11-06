import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    currentReportPath,
    main,
    renderPlaypressSummary,
    type PlaypressReport,
    type PlaypressTest,
} from '../utils/playpressSummary';

function entry(partial: Partial<PlaypressTest> & Pick<PlaypressTest, 'id' | 'status'>): PlaypressTest {
    return {
        file: partial.file ?? 'tests/login.spec.ts',
        titlePath: partial.titlePath ?? [partial.id],
        ...partial,
    };
}

function report(tests: PlaypressTest[], extras: Partial<PlaypressReport['totals']> = {}): PlaypressReport {
    const count = (status: string) => tests.filter((item) => item.status === status).length;
    return {
        run: { id: '20261019T211200Z-a1b2c3d4', language: 'node' },
        totals: {
            total: tests.length,
            passed: count('passed'),
            failed: count('failed'),
            skipped: count('skipped'),
            ...extras,
        },
        tests,
    };
}

test('a green run lists totals and does not deploy', () => {
    const markdown = renderPlaypressSummary(report([entry({ id: 'a', status: 'passed' })]));
    assert.match(markdown, /\| total \| 1 \|/);
    assert.match(markdown, /\| passed \| 1 \|/);
    assert.match(markdown, /Run `20261019T211200Z-a1b2c3d4` \(node\)/);
    assert.doesNotMatch(markdown, /### Failed tests/);
    assert.match(markdown, /No published `main` run was readable/);
    assert.match(markdown, /keeps error text and media for 14 days/);
    assert.match(markdown, /This run does not deploy GitHub Pages/);
    assert.doesNotMatch(markdown, /timedOut/);
});

test('failures are titles and files, and a push says the deploy job publishes', () => {
    const markdown = renderPlaypressSummary(
        report(
            [
                entry({
                    id: 'a',
                    status: 'failed',
                    titlePath: ['sign in', 'rejects a bad password'],
                    file: 'tests/b.spec.ts',
                }),
                entry({ id: 'b', status: 'timedOut', file: 'tests/a.spec.ts' }),
                entry({ id: 'c', status: 'interrupted' }),
                entry({ id: 'd', status: 'passed' }),
            ],
            { timedOut: 1, interrupted: 1 },
        ),
        { deploys: true, branch: 'main' },
    );
    assert.match(markdown, /\| timedOut \| 1 \|/);
    assert.match(markdown, /\| interrupted \| 1 \|/);
    assert.match(markdown, /- timedOut: b \(`tests\/a\.spec\.ts`\)/);
    assert.match(markdown, /- failed: sign in \/ rejects a bad password \(`tests\/b\.spec\.ts`\)/);
    assert.doesNotMatch(markdown, /Invalid username/);
    assert.match(markdown, /publishes the redacted profile/);
});

test('comparison counts new, still failing, fixed, and absent tests', () => {
    const base = report([
        entry({ id: 'still', status: 'failed', titlePath: ['still'] }),
        entry({ id: 'fixed', status: 'timedOut', titlePath: ['fixed'] }),
        entry({ id: 'gone', status: 'interrupted', titlePath: ['gone'], file: 'tests/z.spec.ts' }),
    ]);
    const head = report([
        entry({ id: 'still', status: 'failed', titlePath: ['still'] }),
        entry({ id: 'fixed', status: 'passed', titlePath: ['fixed'] }),
        entry({ id: 'fresh', status: 'failed', titlePath: ['fresh'], file: 'tests/m.spec.ts' }),
        entry({ id: 'earlier', status: 'failed', titlePath: ['earlier'], file: 'tests/a.spec.ts' }),
        entry({ id: 'ok', status: 'passed', titlePath: ['ok'] }),
    ]);
    const markdown = renderPlaypressSummary(head, { base, branch: 'main' });
    assert.match(markdown, /\| new failures \| 2 \|/);
    assert.match(markdown, /\| still failing \| 1 \|/);
    assert.match(markdown, /\| fixed \| 1 \|/);
    assert.match(markdown, /\| not in this run \| 1 \|/);
    assert.match(markdown, /#### New failures[\s\S]*tests\/a\.spec\.ts[\s\S]*tests\/m\.spec\.ts/);
    assert.match(markdown, /#### Fixed[\s\S]*passed: fixed/);
    assert.match(markdown, /#### Failing on the published run and not in this run[\s\S]*gone/);
});

test('long failure lists stop after 20', () => {
    const tests = Array.from({ length: 21 }, (_, index) =>
        entry({
            id: `f${index}`,
            status: 'failed',
            titlePath: [`t${String(index).padStart(2, '0')}`],
            file: 'tests/f.spec.ts',
        }),
    );
    const markdown = renderPlaypressSummary(report(tests), { base: report(tests) });
    assert.match(markdown, /- 1 more/);
    assert.doesNotMatch(markdown, /t20/);
});

test('currentReportPath prefers the current row for the same branch and suite', () => {
    const catalog = {
        runs: [
            { branch: 'main', current: false, report: 'runs/20261019T211200Z-bbbbbbbb/report.json' },
            { branch: 'main', current: true, report: 'runs/20261019T211300Z-aaaaaaaa/report.json' },
            { branch: 'other', current: true, report: 'runs/20261019T211400Z-cccccccc/report.json' },
            { branch: 'main', suite: 'visual', current: true, report: 'runs/20261019T211500Z-dddddddd/report.json' },
            { branch: 'main', current: true, report: '../secret.json' },
        ],
    };
    assert.equal(currentReportPath(catalog, 'main'), 'runs/20261019T211300Z-aaaaaaaa/report.json');
    assert.equal(currentReportPath(catalog, 'main', 'visual'), 'runs/20261019T211500Z-dddddddd/report.json');
    assert.equal(currentReportPath({ runs: [] }, 'main'), undefined);
    assert.equal(
        currentReportPath({ runs: [{ branch: 'main', report: 'runs/20261019T211200Z-bbbbbbbb/report.json' }] }, 'main'),
        'runs/20261019T211200Z-bbbbbbbb/report.json',
    );
});

test('the CLI prints a summary and the published report path', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'playpress-summary-'));
    const head = report([entry({ id: 'a', status: 'failed' })]);
    head.run.suite = 'suite';
    const headPath = path.join(directory, 'head.json');
    const basePath = path.join(directory, 'base.json');
    const catalogPath = path.join(directory, 'catalog.json');
    fs.writeFileSync(headPath, JSON.stringify(head));
    fs.writeFileSync(basePath, JSON.stringify(report([entry({ id: 'a', status: 'passed' })])));
    fs.writeFileSync(
        catalogPath,
        JSON.stringify({
            runs: [
                { branch: 'main', suite: 'suite', current: true, report: 'runs/20261019T211200Z-a1b2c3d4/report.json' },
            ],
        }),
    );

    const summary = main([headPath, '--base', basePath, '--branch', 'main', '--deploys']);
    assert.match(summary, /#### New failures/);
    assert.match(summary, /publishes the redacted profile/);
    assert.equal(
        main(['--print-base', catalogPath, headPath, '--branch', 'main']),
        'runs/20261019T211200Z-a1b2c3d4/report.json',
    );
    assert.equal(
        main(['--print-base', catalogPath, headPath, '--branch']),
        'runs/20261019T211200Z-a1b2c3d4/report.json',
    );
    assert.equal(main(['--print-base', catalogPath, headPath, '--branch', 'other']), '');
    assert.match(main([headPath]), /does not deploy GitHub Pages/);
    assert.throws(() => main(['--print-base', catalogPath]), /--print-base/);
    assert.throws(() => main(['--base']), /Usage/);
});
