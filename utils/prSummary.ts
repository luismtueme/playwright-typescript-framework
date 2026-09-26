/**
 * Turns a Playwright JSON report into a short Markdown summary for the PR comment
 * and the Actions job summary: totals, every failure with its error and location,
 * and flaky tests (passed only on retry).
 *
 * Usage: tsx utils/prSummary.ts <report.json>   (prints Markdown)
 */
import fs from 'fs';
import { stripVTControlCharacters } from 'util';

export interface JsonReport {
    stats: { expected: number; unexpected: number; flaky: number; skipped: number; duration: number };
    suites: Suite[];
}
interface Suite {
    title: string;
    file: string;
    specs?: Spec[];
    suites?: Suite[];
}
interface Spec {
    title: string;
    file: string;
    line: number;
    tests: Array<{
        projectName: string;
        status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
        results: Array<{ status: string; error?: { message?: string } }>;
    }>;
}

interface Entry {
    title: string;
    location: string;
    project: string;
    error?: string;
}

/** Marker so the workflow updates its own comment instead of adding a new one each push */
export const COMMENT_MARKER = '<!-- playwright-summary -->';

/** Playwright error messages carry terminal colors; comments need plain text */
const stripAnsi = (text: string) => stripVTControlCharacters(text);

function collect(report: JsonReport) {
    const failed: Entry[] = [];
    const flaky: Entry[] = [];
    const walk = (suites: Suite[], parents: string[]) => {
        for (const suite of suites) {
            // File-level suites are titled with the file path (with backslashes on Windows); skip them
            const isFile = suite.title.replaceAll('\\', '/') === suite.file.replaceAll('\\', '/');
            const path = suite.title && !isFile ? [...parents, suite.title] : parents;
            for (const spec of suite.specs ?? []) {
                for (const test of spec.tests) {
                    const entry = {
                        title: [...path, spec.title].join(' › '),
                        location: `${spec.file}:${spec.line}`,
                        project: test.projectName,
                    };
                    if (test.status === 'unexpected') {
                        const message = test.results.map((r) => r.error?.message).find(Boolean) ?? 'no error message';
                        failed.push({
                            ...entry,
                            error:
                                stripAnsi(message)
                                    .split('\n')
                                    .find((l) => l.trim()) ?? '',
                        });
                    } else if (test.status === 'flaky') {
                        flaky.push(entry);
                    }
                }
            }
            walk(suite.suites ?? [], path);
        }
    };
    walk(report.suites, []);
    return { failed, flaky };
}

export function renderSummary(report: JsonReport, { runUrl }: { runUrl?: string } = {}): string {
    const { expected, unexpected, flaky, skipped, duration } = report.stats;
    const { failed, flaky: flakyTests } = collect(report);
    const icon = unexpected > 0 ? '❌' : flaky > 0 ? '⚠️' : '✅';
    const lines = [
        COMMENT_MARKER,
        `### ${icon} Playwright: ${expected} passed, ${unexpected} failed, ${flaky} flaky, ${skipped} skipped (${(duration / 1000).toFixed(1)}s)`,
        '',
    ];
    if (failed.length > 0) {
        lines.push('**Failed**', '', '| Test | Project | Error |', '|---|---|---|');
        for (const f of failed) {
            lines.push(
                `| ${f.title.replace(/\|/g, '\\|')}<br>\`${f.location}\` | ${f.project} | ${(f.error ?? '').replace(/\|/g, '\\|').slice(0, 160)} |`,
            );
        }
        lines.push('');
    }
    if (flakyTests.length > 0) {
        lines.push('**Flaky** (failed, then passed on retry: fix or quarantine them)', '');
        for (const f of flakyTests) lines.push(`- ${f.title} (\`${f.location}\`, ${f.project})`);
        lines.push('');
    }
    if (runUrl) lines.push(`Traces, videos and the HTML report: [run artifacts](${runUrl})`);
    return lines.join('\n').trimEnd() + '\n';
}

if (require.main === module) {
    const file = process.argv[2];
    if (!file) {
        console.error('Usage: tsx utils/prSummary.ts <report.json>');
        process.exit(1);
    }
    const report = JSON.parse(fs.readFileSync(file, 'utf8')) as JsonReport;
    const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
    const runUrl = GITHUB_RUN_ID
        ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
        : undefined;
    process.stdout.write(renderSummary(report, { runUrl }));
}
