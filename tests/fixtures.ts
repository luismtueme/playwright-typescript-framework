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
 */
import { test as base, expect } from '@playwright/test';
import { config, requireCredentials, type Credentials, type Role } from '../config';
import { ApiClient } from '../utils/apiClient';
import { DbClient } from '../utils/dbClient';
import { authFile } from '../utils/authState';
import { FormPage } from '../pages/FormPage';
import { LoginPage } from '../pages/LoginPage';
import { ItemsPage, type Item } from '../pages/ItemsPage';
import { findAccessibilityViolations, formatViolations, type AccessibilityOptions } from '../utils/accessibility';

/** storageState for a visitor with no session */
export const LOGGED_OUT = { cookies: [], origins: [] };

export interface Options {
    /** Who the browser is logged in as. `anonymous` means no session. */
    role: Role | 'anonymous';
}

export interface WorkerFixtures {
    /** MySQL client, one pool per worker. Only for tests that skip without a database (see tests/db). */
    db: DbClient;
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
    /** Deletes an item after the test (pass or fail); for items created outside createItem */
    trackItem: (item: { id: number }) => void;
    /** Creates an item through the API and deletes it after the test */
    createItem: (overrides?: { name?: string }) => Promise<Item>;
    /** Runs axe on the current page, attaches the results, and fails on any violation */
    checkAccessibility: (options?: AccessibilityOptions) => Promise<void>;
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

    role: ['admin', { option: true }],

    // Load the saved session for the test's role
    storageState: async ({ role }, use) => {
        await use(role === 'anonymous' ? LOGGED_OUT : authFile(role));
    },

    credentials: async ({ role }, use) => {
        await use(requireCredentials(config, role === 'anonymous' ? 'admin' : role));
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

    api: async ({ playwright, baseURL }, use) => {
        const context = await playwright.request.newContext({
            baseURL: config.apiBaseUrl || baseURL,
            // Playwright applies the test's storageState to new request contexts too
            storageState: LOGGED_OUT,
        });
        await use(new ApiClient(context));
        await context.dispose();
    },

    apiAs: async ({ playwright, baseURL }, use) => {
        const contexts: Array<{ dispose: () => Promise<void> }> = [];
        await use(async (role) => {
            const context = await playwright.request.newContext({
                baseURL: config.apiBaseUrl || baseURL,
                storageState: LOGGED_OUT,
            });
            contexts.push(context);
            const api = new ApiClient(context);
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

    createItem: async ({ authedApi, trackItem }, use) => {
        await use(async (overrides = {}) => {
            const name = overrides.name ?? `Test item ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const response = await authedApi.post<Item>('/api/items', { name, ...overrides });
            if (response.status !== 201) throw new Error(`createItem failed: HTTP ${response.status}`);
            trackItem(response.body);
            return response.body;
        });
    },
});

export { expect };

/**
 * Returns `value`, or throws `message` if it's null or undefined. Narrows the type
 * for the code after it, without an `if` in the test body.
 */
export function defined<T>(value: T | null | undefined, message: string): T {
    if (value === null || value === undefined) throw new Error(message);
    return value;
}
