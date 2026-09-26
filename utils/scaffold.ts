/**
 * Scaffolds page objects and specs that follow this framework's conventions and pass
 * lint and typecheck as generated.
 *
 *   npm run new:page -- Settings --path /settings
 *     pages/SettingsPage.ts, a `settingsPage` fixture, tests/ui/settings.spec.ts
 *     and an accessibility check for the page
 *
 *   npm run new:spec -- checkout --page items      tests/ui/checkout.spec.ts using itemsPage
 *   npm run new:spec -- orders --api --path /api/orders    tests/api/orders.spec.ts
 */
import fs from 'fs';
import path from 'path';

export interface Names {
    /** SettingsPage */
    className: string;
    /** settingsPage */
    fixture: string;
    /** settings (file names) */
    kebab: string;
    /** settings page (test titles) */
    words: string;
}

/** Splits "UserProfile", "user-profile", "user_profile" or "user profile" into lowercase words */
function splitWords(input: string): string[] {
    const words = input
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((w) => w.toLowerCase());
    if (words.length === 0 || !words.every((w) => /^[a-z][a-z0-9]*$/.test(w))) {
        throw new Error(`"${input}" is not a valid name: use letters and digits, starting with a letter`);
    }
    return words;
}

const capitalize = (w: string) => w[0]!.toUpperCase() + w.slice(1);

/** Names for a page object. A trailing "Page" in the input is optional. */
export function pageNames(input: string): Names {
    let words = splitWords(input);
    if (words.length > 1 && words.at(-1) === 'page') words = words.slice(0, -1);
    const pascal = words.map(capitalize).join('');
    return {
        className: `${pascal}Page`,
        fixture: `${pascal[0]!.toLowerCase()}${pascal.slice(1)}Page`,
        kebab: words.join('-'),
        words: `${words.join(' ')} page`,
    };
}

/** Kebab-case file name for a spec */
export function specName(input: string): string {
    return splitWords(input).join('-');
}

function checkPath(urlPath: string): string {
    if (/^[A-Za-z]:[\\/]/.test(urlPath)) {
        throw new Error(
            `--path became "${urlPath}": Git Bash rewrites arguments that start with "/". ` +
                'Run it from PowerShell, or prefix the command with MSYS_NO_PATHCONV=1',
        );
    }
    if (!/^\/[\w\-./]*$/.test(urlPath)) throw new Error(`--path must start with "/", got "${urlPath}"`);
    return urlPath;
}

export function pageObjectSource(names: Names, urlPath: string): string {
    return `import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** ${capitalize(names.words)} ("${checkPath(urlPath)}"). */
export class ${names.className} extends BasePage {
    static override path = '${urlPath}';

    readonly heading: Locator;

    constructor(page: Page) {
        super(page);
        // Prefer role, label and text locators; they match what users see
        this.heading = page.getByRole('heading', { level: 1 });
    }
}
`;
}

/** A UI spec that opens a page object's page. `titleWords` names the describe block. */
export function uiSpecSource(names: Names, titleWords: string = names.words): string {
    return `import { test, expect } from '../fixtures';

test.describe('${capitalize(titleWords)}', () => {
    test('opens', async ({ ${names.fixture} }) => {
        await ${names.fixture}.open();
        await expect(${names.fixture}.heading).toBeVisible();
    });
});
`;
}

export function apiSpecSource(name: string, urlPath: string): string {
    const title = capitalize(splitWords(name).join(' '));
    return `import { test, expect } from '../fixtures';

// Responses are checked against contracts/openapi.yaml: document ${checkPath(urlPath)} there first.
test.describe('${title} API', { tag: '@api' }, () => {
    test('responds', async ({ authedApi }) => {
        const response = await authedApi.get('${urlPath}');
        expect(response.status).toBe(200);
    });
});
`;
}

/** Inserts `text` after the last match of `pattern` in `source` */
function insertAfterLast(source: string, pattern: RegExp, text: string, what: string): string {
    const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.replace('g', '') + 'gm'))];
    const last = matches.at(-1);
    if (last === undefined) throw new Error(`Could not find where to add ${what}; add it by hand`);
    const at = last.index + last[0].length;
    return source.slice(0, at) + text + source.slice(at);
}

/** Adds the page object's import, type and fixture to tests/fixtures.ts */
export function registerFixture(source: string, names: Names): string {
    if (new RegExp(`\\b${names.fixture}:`).test(source)) {
        throw new Error(`tests/fixtures.ts already has a ${names.fixture} fixture`);
    }
    let out = insertAfterLast(
        source,
        /^import \{[^}]*\} from '\.\.\/pages\/\w+';\n/,
        `import { ${names.className} } from '../pages/${names.className}';\n`,
        'the page object import',
    );
    out = insertAfterLast(out, /^ {4}\w+Page: \w+Page;\n/, `    ${names.fixture}: ${names.className};\n`, 'the type');
    out = insertAfterLast(
        out,
        /^ {4}\w+Page: async \(\{ page \}, use\) => \{\n {8}await use\(new \w+Page\(page\)\);\n {4}\},\n/,
        `    ${names.fixture}: async ({ page }, use) => {\n        await use(new ${names.className}(page));\n    },\n`,
        'the fixture',
    );
    return out;
}

/** Adds an accessibility check for the page to tests/ui/accessibility.spec.ts */
export function addAccessibilityCheck(source: string, names: Names): string {
    const anchor = "    test.describe('logged out'";
    if (!source.includes(anchor)) throw new Error('Could not find where to add the accessibility check');
    const check = `    test('${names.words}', async ({ ${names.fixture}, checkAccessibility }) => {
        await ${names.fixture}.open();
        await expect(${names.fixture}.heading).toBeVisible();
        await checkAccessibility();
    });

`;
    return source.replace(anchor, check + anchor);
}

/** Parses `<name> [--flag value] [--flag]` */
export function parseArgs(argv: string[]): { name: string | undefined; options: Record<string, string | true> } {
    const options: Record<string, string | true> = {};
    let name: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg.startsWith('--')) {
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith('--')) {
                options[arg.slice(2)] = next;
                i++;
            } else {
                options[arg.slice(2)] = true;
            }
        } else {
            name ??= arg;
        }
    }
    return { name, options };
}

function optionString(options: Record<string, string | true>, key: string): string | undefined {
    const value = options[key];
    if (value === true) throw new Error(`--${key} needs a value`);
    return value;
}

function main(root: string, command: string | undefined, argv: string[]): string[] {
    const { name, options } = parseArgs(argv);
    const created: string[] = [];
    const write = (file: string, content: string, { overwrite = false } = {}) => {
        const full = path.join(root, file);
        if (!overwrite && fs.existsSync(full)) throw new Error(`${file} already exists`);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
        created.push(file);
    };
    const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

    if (command === 'page') {
        if (!name) throw new Error('Usage: npm run new:page -- <Name> --path /<url>');
        const names = pageNames(name);
        const urlPath = checkPath(optionString(options, 'path') ?? `/${names.kebab}`);
        const pageFile = `pages/${names.className}.ts`;
        const specFile = `tests/ui/${names.kebab}.spec.ts`;
        for (const file of [pageFile, specFile]) {
            if (fs.existsSync(path.join(root, file))) throw new Error(`${file} already exists`);
        }
        // Compute every edit before writing anything, so a failure leaves no half-done scaffold
        const fixtures = registerFixture(read('tests/fixtures.ts'), names);
        const a11y = addAccessibilityCheck(read('tests/ui/accessibility.spec.ts'), names);
        write(pageFile, pageObjectSource(names, urlPath));
        write(specFile, uiSpecSource(names));
        write('tests/fixtures.ts', fixtures, { overwrite: true });
        write('tests/ui/accessibility.spec.ts', a11y, { overwrite: true });
        return created;
    }

    if (command === 'spec') {
        if (!name) throw new Error('Usage: npm run new:spec -- <name> (--page <page> | --api [--path /api/x])');
        const file = specName(name);
        if (options.api) {
            write(`tests/api/${file}.spec.ts`, apiSpecSource(name, optionString(options, 'path') ?? `/api/${file}`));
            return created;
        }
        const page = optionString(options, 'page');
        if (!page) throw new Error('UI specs need a page object: --page <name>, e.g. --page items');
        const names = pageNames(page);
        if (!fs.existsSync(path.join(root, 'pages', `${names.className}.ts`))) {
            throw new Error(`pages/${names.className}.ts not found; create it with npm run new:page`);
        }
        write(`tests/ui/${file}.spec.ts`, uiSpecSource(names, splitWords(name).join(' ')));
        return created;
    }

    throw new Error('Usage: tsx utils/scaffold.ts <page|spec> <name> [options]');
}

if (require.main === module) {
    try {
        const created = main(process.cwd(), process.argv[2], process.argv.slice(3));
        console.log(created.map((f) => `  ${f}`).join('\n'));
        console.log('Next: npm run lint && npm run typecheck');
    } catch (error) {
        console.error((error as Error).message);
        process.exit(1);
    }
}

export { main as scaffold };
