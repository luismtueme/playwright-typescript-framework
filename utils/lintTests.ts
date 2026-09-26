/**
 * Test policy linter: checks the specs' metadata the way Playwright sees it
 * (`playwright test --list --reporter=json`), so it can't drift from real behavior.
 * Part of `npm run check`.
 *
 * Rules:
 *   unknown-tag          tags must be in ALLOWED_TAGS, so filters like --grep @smoke stay meaningful
 *   tag-in-title         use the tag option ({ tag: '@smoke' }), not "@smoke" in the title
 *   quarantine-ticket    @quarantine needs an issue annotation explaining why:
 *                        { tag: '@quarantine', annotation: { type: 'issue', description: 'ABC-123' } }
 *
 * Usage: npm run lint:tests
 */
import { spawnSync } from 'child_process';

/** Add new tags here so they're documented in one place */
export const ALLOWED_TAGS = new Set(['@smoke', '@api', '@db', '@a11y', '@visual', '@quarantine']);

export type Rule = 'unknown-tag' | 'tag-in-title' | 'quarantine-ticket';

export interface Problem {
    location: string;
    title: string;
    rule: Rule;
    message: string;
}

/** The parts of Playwright's JSON list report this linter reads */
export interface ListReport {
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
    tags: string[];
    tests: Array<{ projectName: string; annotations: Array<{ type: string; description?: string }> }>;
}

function* specsOf(suites: Suite[], parents: string[] = []): Generator<{ spec: Spec; titlePath: string[] }> {
    for (const suite of suites) {
        const path = suite.title && suite.title !== suite.file ? [...parents, suite.title] : parents;
        for (const spec of suite.specs ?? []) yield { spec, titlePath: [...path, spec.title] };
        yield* specsOf(suite.suites ?? [], path);
    }
}

export function lintTestList(report: ListReport): Problem[] {
    const problems: Problem[] = [];
    for (const { spec, titlePath } of specsOf(report.suites)) {
        // Setup projects (logging in) are infrastructure, not tests
        if (spec.tests.every((t) => t.projectName === 'setup')) continue;

        const location = `${spec.file}:${spec.line}`;
        const title = titlePath.join(' › ');
        const report = (rule: Rule, message: string) => problems.push({ location, title, rule, message });

        for (const tag of spec.tags.map((t) => (t.startsWith('@') ? t : `@${t}`))) {
            if (!ALLOWED_TAGS.has(tag)) {
                report(
                    'unknown-tag',
                    `Unknown tag ${tag}. Allowed: ${[...ALLOWED_TAGS].join(', ')} (see utils/lintTests.ts)`,
                );
            }
        }

        const inTitle = titlePath.flatMap((part) => part.match(/(^|\s)@[\w-]+/g) ?? []).map((t) => t.trim());
        for (const tag of inTitle) {
            report('tag-in-title', `"${tag}" is in the title; use the tag option instead: { tag: '${tag}' }`);
        }

        const tags = new Set(spec.tags.map((t) => (t.startsWith('@') ? t : `@${t}`)));
        const hasIssue = spec.tests.some((t) => t.annotations.some((a) => a.type === 'issue' && a.description));
        if (tags.has('@quarantine') && !hasIssue) {
            report(
                'quarantine-ticket',
                "Quarantined test needs a ticket: annotation: { type: 'issue', description: 'ABC-123' }",
            );
        }
    }
    return problems;
}

function main(): void {
    // ALL_TESTS lists quarantined and visual tests too, which normal runs filter out
    const result = spawnSync('npx playwright test --list --reporter=json', {
        shell: true,
        encoding: 'utf8',
        env: { ...process.env, ALL_TESTS: 'true' },
        maxBuffer: 64 * 1024 * 1024,
    });
    if (result.status !== 0) {
        console.error(result.stderr || result.stdout);
        process.exit(result.status ?? 1);
    }
    const report = JSON.parse(result.stdout.slice(result.stdout.indexOf('{'))) as ListReport;
    const problems = lintTestList(report);
    for (const { location, title, rule, message } of problems)
        console.error(`${location}  ${title}\n  ${message}  [${rule}]`);
    if (problems.length > 0) {
        console.error(`\nTest lint: ${problems.length} problem(s)`);
        process.exitCode = 1;
    } else {
        console.log('Test lint: all tests follow the tag and quarantine policy');
    }
}

if (require.main === module) main();
