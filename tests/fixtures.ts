/**
 * Custom Playwright Test fixtures. Import `test` and `expect` from here instead of
 * '@playwright/test' to get page objects, API clients and test data injected:
 *
 *   test('...', async ({ itemsPage, createItem }) => { ... })
 *
 * Browser tests start logged in as `admin` (sessions saved once by tests/auth.setup.ts).
 * Pick another role per file or describe block:
 *
 *   test.use({ role: 'viewer' });     // read-only user
 *   test.use({ role: 'anonymous' });  // a visitor with no session
 *
 * Every API response (from the API clients and from the browser page) is checked
 * against the OpenAPI contract. Turn that off only for tests that fake responses:
 *
 *   test.use({ contract: false });
 */
import { test as base, expect, type Response } from '@playwright/test';
import fc from 'fast-check';
import { config, requireCredentials, type Credentials, type Role } from '../config';
import { ApiClient, type ClientOptions } from '../utils/apiClient';
import { Contract, ContractViolation } from '../utils/contract';
import { DbClient } from '../utils/dbClient';
import { authFile } from '../utils/authState';
import { Random, RUN_SEED, itemName, seedFor } from '../utils/testData';
import { FormPage } from '../pages/FormPage';
import { LoginPage } from '../pages/LoginPage';
import { ItemsPage, type Item } from '../pages/ItemsPage';
import { findAccessibilityViolations, formatViolations, type AccessibilityOptions } from '../utils/accessibility';

/** storageState for a visitor with no session */
export const LOGGED_OUT = { cookies: [], origins: [] };

export interface Options {
    /** Who the browser is logged in as. `anonymous` means no session. */
    role: Role | 'anonymous';
    /** Check every API response against the OpenAPI contract (default: true when a contract is configured) */
    contract: boolean;
}

export interface WorkerFixtures {
    /** MySQL client, one pool per worker. Only for tests that skip without a database (see tests/db). */
    db: DbClient;
    /** The parsed OpenAPI contract, or null when none is configured */
    apiContract: Contract | null;
}

export interface Fixtures {
    /** Credentials of the test's role (admin's for `anonymous`, e.g. to log in through the UI) */
    credentials: Credentials;
    formPage: FormPage;
    loginPage: LoginPage;
    itemsPage: ItemsPage;
    /** Unauthenticated API client; never carries the saved browser session */
    api: ApiClient;
    /** API client logged in as admin, for test data setup and cleanup */
    authedApi: ApiClient;
    /** API client logged in as any role; clients are disposed after the test */
    apiAs: (role: Role) => Promise<ApiClient>;
    /** This test's seeded random generator; its seed is recorded in the report */
    random: Random;
    /** Deletes an item after the test (pass or fail); for items created outside createItem */
    trackItem: (item: { id: number }) => void;
    /** Creates an item through the API (realistic seeded name by default) and deletes it after the test */
    createItem: (overrides?: { name?: string }) => Promise<Item>;
    /** Runs axe on the current page, attaches the results, and fails on any violation */
    checkAccessibility: (options?: AccessibilityOptions) => Promise<void>;
    /**
     * Checks a rule against generated inputs (fast-check), seeded from the test's seed so
     * failures reproduce with TEST_SEED. A failure reports the smallest failing input.
     */
    checkProperty: <T>(
        inputs: fc.Arbitrary<T>,
        rule: (input: T) => Promise<void>,
        options?: { runs?: number },
    ) => Promise<void>;
    /** Internal: checks the browser page's API responses against the contract */
    pageContractCheck: void;
}

export const test = base.extend<Fixtures & Options, WorkerFixtures>({
    db: [
        async ({}, use) => {
            const db = new DbClient(config.db);
            await use(db);
            await db.close();
        },
        { scope: 'worker' },
    ],

    apiContract: [
        async ({}, use) => {
            await use(config.openApiSpec ? new Contract(config.openApiSpec) : null);
        },
        { scope: 'worker' },
    ],

    role: ['admin', { option: true }],
    contract: [true, { option: true }],

    // Load the saved session for the test's role
    storageState: async ({ role }, use) => {
        await use(role === 'anonymous' ? LOGGED_OUT : authFile(role));
    },

    credentials: async ({ role }, use) => {
        await use(requireCredentials(config, role === 'anonymous' ? 'admin' : role));
    },

    random: async ({}, use, testInfo) => {
        const seed = seedFor(testInfo.titlePath.join(' › '));
        testInfo.annotations.push({ type: 'seed', description: `TEST_SEED=${RUN_SEED} (test seed ${seed})` });
        await use(new Random(seed));
    },

    formPage: async ({ page }, use) => {
        await use(new FormPage(page));
    },
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },
    itemsPage: async ({ page }, use) => {
        await use(new ItemsPage(page));
    },

    checkAccessibility: async ({ page }, use, testInfo) => {
        await use(async (options) => {
            const violations = await findAccessibilityViolations(page, options);
            await testInfo.attach('accessibility-violations.json', {
                body: JSON.stringify(violations, null, 2),
                contentType: 'application/json',
            });
            expect(violations, formatViolations(violations)).toEqual([]);
        });
    },

    checkProperty: async ({ random }, use) => {
        await use(async (inputs, rule, { runs = 80 } = {}) => {
            await fc.assert(fc.asyncProperty(inputs, rule), { numRuns: runs, seed: random.seed });
        });
    },

    // Checks the browser page's own API calls too; a violation fails the test at the end
    pageContractCheck: [
        async ({ page, apiContract, contract, baseURL }, use, testInfo) => {
            if (!apiContract || !contract) return use();
            const problems: string[] = [];
            const pending: Array<Promise<void>> = [];
            const origin = new URL(config.apiBaseUrl || baseURL || 'http://localhost').origin;
            const onResponse = (response: Response) => {
                const url = new URL(response.url());
                if (url.origin !== origin || !url.pathname.startsWith('/api/')) return;
                pending.push(
                    (async () => {
                        // The body is gone if the page navigated away first; the status is still checked
                        const text = await response.text().catch(() => undefined);
                        let body: unknown = text || null;
                        try {
                            body = text ? JSON.parse(text) : null;
                        } catch {
                            // not JSON: validated as text
                        }
                        const method = response.request().method();
                        problems.push(
                            ...apiContract.check({
                                method,
                                path: url.pathname,
                                status: response.status(),
                                body,
                                bodyUnavailable: text === undefined,
                            }),
                        );
                    })(),
                );
            };
            page.on('response', onResponse);
            await use();
            page.off('response', onResponse);
            await Promise.all(pending);
            if (problems.length > 0) {
                await testInfo.attach('contract-violations.txt', {
                    body: problems.join('\n'),
                    contentType: 'text/plain',
                });
                throw new ContractViolation(problems);
            }
        },
        { auto: true },
    ],

    api: async ({ playwright, baseURL, apiContract, contract }, use) => {
        const context = await playwright.request.newContext({
            baseURL: config.apiBaseUrl || baseURL,
            // Playwright applies the test's storageState to new request contexts too
            storageState: LOGGED_OUT,
        });
        await use(new ApiClient(context, contractOptions(apiContract, contract)));
        await context.dispose();
    },

    apiAs: async ({ playwright, baseURL, apiContract, contract }, use) => {
        const contexts: Array<{ dispose: () => Promise<void> }> = [];
        await use(async (role) => {
            const context = await playwright.request.newContext({
                baseURL: config.apiBaseUrl || baseURL,
                storageState: LOGGED_OUT,
            });
            contexts.push(context);
            const api = new ApiClient(context, contractOptions(apiContract, contract));
            const { username, password } = requireCredentials(config, role);
            await api.login(username, password);
            return api;
        });
        await Promise.all(contexts.map((context) => context.dispose()));
    },

    authedApi: async ({ apiAs }, use) => {
        await use(await apiAs('admin'));
    },

    trackItem: async ({ authedApi }, use) => {
        const ids: number[] = [];
        await use((item) => {
            ids.push(item.id);
        });
        for (const id of ids.reverse()) {
            const { status } = await authedApi.delete(`/api/items/${id}`);
            // 404: the test already deleted it
            if (status !== 204 && status !== 404) throw new Error(`Cleanup of item ${id} failed: HTTP ${status}`);
        }
    },

    createItem: async ({ authedApi, trackItem, random }, use) => {
        await use(async (overrides = {}) => {
            const response = await authedApi.post<Item>('/api/items', { name: itemName(random), ...overrides });
            if (response.status !== 201) throw new Error(`createItem failed: HTTP ${response.status}`);
            trackItem(response.body);
            return response.body;
        });
    },
});

/** ApiClient options that validate every response against the contract */
function contractOptions(apiContract: Contract | null, enabled: boolean): ClientOptions {
    if (!apiContract || !enabled) return {};
    return {
        validate: (response) => {
            const problems = apiContract.check(response);
            if (problems.length > 0) throw new ContractViolation(problems);
        },
    };
}

export { expect };

/**
 * Returns `value`, or throws `message` if it's null or undefined. Narrows the type
 * for the code after it, without an `if` in the test body.
 */
export function defined<T>(value: T | null | undefined, message: string): T {
    if (value === null || value === undefined) throw new Error(message);
    return value;
}
