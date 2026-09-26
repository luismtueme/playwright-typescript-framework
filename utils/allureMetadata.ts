/**
 * Writes Allure report metadata (environment, executor, failure categories) to
 * allure-results/. Called by both runners so the report describes the run the
 * same way no matter which suite ran.
 */
import fs from 'fs';
import path from 'path';
import { config, ROOT } from '../config';
import { allureCategories } from './allureCategories';

export const RESULTS_DIR = path.join(ROOT, 'allure-results');

function environmentProperties(baseUrl?: string): string {
    const entries: Record<string, string | boolean> = {
        Environment: config.environment,
        'Base URL': baseUrl || config.baseUrl || '(demo app)',
        Browser: config.browser,
        Headless: config.headless,
        Database: config.db ? `${config.db.host}:${config.db.port}/${config.db.database}` : '(none)',
        Node: process.version,
        OS: `${process.platform} ${process.arch}`,
    };
    // Allure's .properties format needs ":" and "=" escaped in keys
    return Object.entries(entries)
        .map(([key, value]) => `${key.replace(/([ :=])/g, '\\$1')}=${value}`)
        .join('\n');
}

function executor(): Record<string, string | number> {
    const { GITHUB_ACTIONS, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_NUMBER } = process.env;
    if (GITHUB_ACTIONS !== 'true') {
        return { name: 'Local', type: 'local', buildName: `Local run ${new Date().toISOString()}` };
    }
    const [owner, repo] = (GITHUB_REPOSITORY ?? '/').split('/');
    return {
        name: 'GitHub Actions',
        type: 'github',
        url: `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions`,
        buildOrder: Number(GITHUB_RUN_NUMBER),
        buildName: `Run #${GITHUB_RUN_NUMBER}`,
        buildUrl: `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`,
        reportUrl: `https://${owner}.github.io/${repo}/allure-report/`,
    };
}

/** @param options.baseUrl The URL actually used, when it differs from config */
export function writeAllureMetadata({ baseUrl }: { baseUrl?: string } = {}): void {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(RESULTS_DIR, 'environment.properties'), environmentProperties(baseUrl));
    fs.writeFileSync(path.join(RESULTS_DIR, 'executor.json'), JSON.stringify(executor(), null, 2));
    fs.writeFileSync(path.join(RESULTS_DIR, 'categories.json'), JSON.stringify(allureCategories, null, 2));
}

/** Empties allure-results/ but keeps history/ so report trends survive. */
export function cleanAllureResults(): void {
    if (!fs.existsSync(RESULTS_DIR)) return;
    for (const entry of fs.readdirSync(RESULTS_DIR)) {
        if (entry !== 'history') fs.rmSync(path.join(RESULTS_DIR, entry), { recursive: true, force: true });
    }
}

if (require.main === module && process.argv[2] === 'clean') {
    cleanAllureResults();
}
