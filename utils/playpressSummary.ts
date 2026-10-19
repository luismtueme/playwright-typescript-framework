/**
 * Markdown for the playpress run document: totals, failed titles, and a comparison
 * with the published default-branch run when that catalog can be read.
 *
 * Error text stays out of this summary. The Actions artifact keeps it.
 *
 * Usage:
 *   tsx utils/playpressSummary.ts <report.json> [--base file] [--branch name] [--deploys]
 *   tsx utils/playpressSummary.ts --print-base <catalog.json> <report.json> [--branch name]
 */
import fs from 'fs';

const FAILURES = new Set(['failed', 'timedOut', 'interrupted']);
const TOTAL_KEYS = ['total', 'passed', 'failed', 'skipped', 'timedOut', 'interrupted'] as const;
/** Publisher paths only: `runs/<run id>/report.json`. Anything else is ignored. */
const REPORT_PATH = /^runs\/\d{8}T\d{6}Z-[0-9a-f]{8}\/report\.json$/;

export interface PlaypressTest {
    id: string;
    file: string;
    titlePath: string[];
    status: string;
}

export interface PlaypressReport {
    run: { id: string; language: string; suite?: string };
    totals: {
        total: number;
        passed: number;
        failed: number;
        skipped: number;
        timedOut?: number;
        interrupted?: number;
    };
    tests: PlaypressTest[];
}

export interface CatalogRun {
    branch?: string;
    suite?: string;
    current?: boolean;
    report?: string;
}

interface Comparison {
    newFailures: PlaypressTest[];
    stillFailing: PlaypressTest[];
    fixed: PlaypressTest[];
    absent: PlaypressTest[];
}

/** Site-relative path of the current published run for this branch and suite. */
export function currentReportPath(
    catalog: { runs?: CatalogRun[] },
    branch: string,
    suite?: string,
): string | undefined {
    const wantedSuite = suite || undefined;
    const runs = (catalog.runs ?? []).filter((run) => {
        const sameSuite = (run.suite || undefined) === wantedSuite;
        return run.branch === branch && sameSuite && typeof run.report === 'string' && REPORT_PATH.test(run.report);
    });
    const selected = runs.find((run) => run.current === true) ?? runs[0];
    return selected?.report;
}

export function renderPlaypressSummary(
    report: PlaypressReport,
    options: { base?: PlaypressReport | undefined; branch?: string; deploys?: boolean } = {},
): string {
    const branch = options.branch ?? 'main';
    const lines = ['## Playpress', '', '| | |', '| --- | ---: |'];
    for (const key of TOTAL_KEYS) {
        const value = report.totals[key];
        if (value !== undefined) lines.push(`| ${key} | ${value} |`);
    }
    lines.push('', `Run \`${report.run.id}\` (${report.run.language}).`, '');

    const failed = report.tests.filter((test) => FAILURES.has(test.status));
    if (failed.length > 0) {
        lines.push('### Failed tests', '');
        lines.push(...bulletList(failed));
        lines.push('');
    }

    if (options.base) lines.push(comparisonSection(compareReports(options.base, report), branch), '');
    else lines.push(`No published \`${branch}\` run was readable from this job.`, '');

    const publishing = options.deploys
        ? 'The deploy job publishes the redacted profile to GitHub Pages.'
        : 'This run does not deploy GitHub Pages.';
    lines.push(`The artifact \`playpress-report\` keeps error text and media for 14 days. ${publishing}`);
    return `${lines.join('\n')}\n`;
}

/** Prints the summary, or the catalog path of the published run when `--print-base` is set. */
export function main(argv: string[]): string {
    if (argv[0] === '--print-base') {
        const catalogPath = argv[1];
        const headPath = argv[2];
        if (!catalogPath || !headPath) {
            throw new Error(
                'Usage: tsx utils/playpressSummary.ts --print-base <catalog.json> <report.json> [--branch name]',
            );
        }
        const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as { runs?: CatalogRun[] };
        const head = JSON.parse(fs.readFileSync(headPath, 'utf8')) as PlaypressReport;
        return currentReportPath(catalog, flag(argv, '--branch') ?? 'main', head.run.suite) ?? '';
    }

    const reportPath = argv.find((arg) => !arg.startsWith('--'));
    if (!reportPath) {
        throw new Error('Usage: tsx utils/playpressSummary.ts <report.json> [--base file] [--branch name] [--deploys]');
    }
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as PlaypressReport;
    const basePath = flag(argv, '--base');
    const base = basePath ? (JSON.parse(fs.readFileSync(basePath, 'utf8')) as PlaypressReport) : undefined;
    return renderPlaypressSummary(report, {
        base,
        branch: flag(argv, '--branch') ?? 'main',
        deploys: argv.includes('--deploys'),
    });
}

function flag(argv: string[], name: string): string | undefined {
    const index = argv.indexOf(name);
    const value = index === -1 ? undefined : argv[index + 1];
    if (value === undefined || value.startsWith('--')) return undefined;
    return value;
}

function compareReports(base: PlaypressReport, head: PlaypressReport): Comparison {
    const baseById = new Map(base.tests.map((test) => [test.id, test]));
    const headById = new Map(head.tests.map((test) => [test.id, test]));
    const comparison: Comparison = { newFailures: [], stillFailing: [], fixed: [], absent: [] };
    for (const test of head.tests) {
        if (!FAILURES.has(test.status)) continue;
        const previous = baseById.get(test.id);
        if (previous && FAILURES.has(previous.status)) comparison.stillFailing.push(test);
        else comparison.newFailures.push(test);
    }
    for (const test of base.tests) {
        if (!FAILURES.has(test.status)) continue;
        const next = headById.get(test.id);
        if (!next) comparison.absent.push(test);
        else if (!FAILURES.has(next.status)) comparison.fixed.push(next);
    }
    for (const list of [comparison.newFailures, comparison.stillFailing, comparison.fixed, comparison.absent]) {
        list.sort(byName);
    }
    return comparison;
}

function comparisonSection(comparison: Comparison, branch: string): string {
    const lines = [
        `### Compared with \`${branch}\``,
        '',
        '| | |',
        '| --- | ---: |',
        `| new failures | ${comparison.newFailures.length} |`,
        `| still failing | ${comparison.stillFailing.length} |`,
        `| fixed | ${comparison.fixed.length} |`,
        `| not in this run | ${comparison.absent.length} |`,
    ];
    const sections: Array<[string, PlaypressTest[]]> = [
        ['New failures', comparison.newFailures],
        ['Still failing', comparison.stillFailing],
        ['Fixed', comparison.fixed],
        ['Failing on the published run and not in this run', comparison.absent],
    ];
    for (const [heading, tests] of sections) {
        if (tests.length === 0) continue;
        lines.push('', `#### ${heading}`, '', ...bulletList(tests));
    }
    return lines.join('\n');
}

function bulletList(tests: PlaypressTest[]): string[] {
    const lines = tests
        .slice(0, 20)
        .map((test) => `- ${test.status}: ${test.titlePath.join(' / ')} (\`${test.file}\`)`);
    if (tests.length > 20) lines.push(`- ${tests.length - 20} more`);
    return lines;
}

function byName(left: PlaypressTest, right: PlaypressTest): number {
    const file = left.file.localeCompare(right.file);
    if (file !== 0) return file;
    return left.titlePath.join(' / ').localeCompare(right.titlePath.join(' / '));
}

if (require.main === module) {
    process.stdout.write(main(process.argv.slice(2)));
}
