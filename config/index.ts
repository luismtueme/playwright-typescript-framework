/**
 * Single source of test configuration for Playwright Test, the demo app and the scripts.
 *
 * Precedence: environment variables > .env file > config/testConfig.json defaults.
 * Secrets (credentials, tokens, DB passwords) come only from the environment, never
 * from committed files. See .env.example for every supported variable.
 */
import fs from 'fs';
import path from 'path';

export const ROOT = path.resolve(__dirname, '..');

const BROWSERS = ['chromium', 'firefox', 'webkit'] as const;
const ARTIFACT_MODES = ['off', 'on', 'retain-on-failure'] as const;

export type BrowserName = (typeof BROWSERS)[number];
export type ArtifactMode = (typeof ARTIFACT_MODES)[number];

export interface DbConfig {
    host: string;
    port: number;
    user?: string | undefined;
    password?: string | undefined;
    database?: string | undefined;
}

/** Shape of config/testConfig.json */
export interface Defaults {
    baseUrl: string;
    environment: string;
    browser: BrowserName;
    headless: boolean;
    viewport: { width: number; height: number };
    timeouts: { action: number; navigation: number; expect: number; test: number };
    video: ArtifactMode;
    trace: ArtifactMode;
}

export interface Credentials {
    username: string;
    password: string;
}

/** Users the tests can act as. Add a role here, in ROLE_ENV and in the app's test accounts. */
export const ROLES = ['admin', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

/** Environment variables holding each role's credentials */
export const ROLE_ENV: Readonly<Record<Role, { username: string; password: string }>> = {
    admin: { username: 'APP_USERNAME', password: 'APP_PASSWORD' },
    viewer: { username: 'VIEWER_USERNAME', password: 'VIEWER_PASSWORD' },
};

// Demo app credentials are public on purpose: they only unlock the bundled demo app
export const DEMO_USERS: Readonly<Record<Role, Readonly<Credentials>>> = {
    admin: { username: 'demo', password: 'demo-password' },
    viewer: { username: 'viewer', password: 'viewer-password' },
};

type Env = Record<string, string | undefined>;

function loadEnvFile(file = path.join(ROOT, '.env')): void {
    if (fs.existsSync(file)) {
        process.loadEnvFile(file);
    }
}

function parseBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value === '') return fallback;
    if (/^(1|true|yes)$/i.test(value)) return true;
    if (/^(0|false|no)$/i.test(value)) return false;
    throw new Error(`${name} must be true or false, got "${value}"`);
}

function parseInteger(name: string, value: string | undefined, fallback: number): number {
    if (value === undefined || value === '') return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) {
        throw new Error(`${name} must be a non-negative integer, got "${value}"`);
    }
    return number;
}

function oneOf<T extends string>(name: string, value: string, allowed: readonly T[]): T {
    if (!(allowed as readonly string[]).includes(value)) {
        throw new Error(`${name} must be one of ${allowed.join(', ')}, got "${value}"`);
    }
    return value as T;
}

const trimSlash = (url: string) => url.replace(/\/+$/, '');

/**
 * Builds the configuration object from defaults and an environment.
 * Exported separately from the cached config so it can be unit tested.
 */
export function buildConfig(env: Env, defaults: Defaults) {
    const isCI = parseBoolean('CI', env.CI, false);
    const baseUrl = trimSlash(env.BASE_URL || defaults.baseUrl || '');
    const useDemoApp = baseUrl === '';

    // Demo credentials apply only to the demo app; a real app must provide its own
    const users = Object.freeze(
        Object.fromEntries(
            ROLES.map((role) => [
                role,
                Object.freeze({
                    username: env[ROLE_ENV[role].username] || (useDemoApp ? DEMO_USERS[role].username : undefined),
                    password: env[ROLE_ENV[role].password] || (useDemoApp ? DEMO_USERS[role].password : undefined),
                }),
            ]),
        ) as Record<Role, { readonly username: string | undefined; readonly password: string | undefined }>,
    );

    const db: Readonly<DbConfig> | null = env.DB_HOST
        ? Object.freeze({
              host: env.DB_HOST,
              port: parseInteger('DB_PORT', env.DB_PORT, 3306),
              user: env.DB_USER,
              password: env.DB_PASSWORD,
              database: env.DB_NAME,
          })
        : null;

    return Object.freeze({
        isCI,
        environment: env.TEST_ENV || defaults.environment,
        useDemoApp,
        baseUrl,
        demoAppPort: parseInteger('DEMO_APP_PORT', env.DEMO_APP_PORT, 4173),
        apiBaseUrl: trimSlash(env.API_BASE_URL || baseUrl),
        browser: oneOf('TEST_BROWSER', env.TEST_BROWSER || defaults.browser, BROWSERS),
        /** A Playwright device name ("Pixel 7", "iPhone 15") to emulate instead of a desktop browser */
        device: env.TEST_DEVICE?.trim() || undefined,
        headless: parseBoolean('HEADLESS', env.HEADLESS, isCI ? true : defaults.headless),
        viewport: Object.freeze({ ...defaults.viewport }),
        timeouts: Object.freeze({
            action: parseInteger('ACTION_TIMEOUT', env.ACTION_TIMEOUT, defaults.timeouts.action),
            navigation: parseInteger('NAVIGATION_TIMEOUT', env.NAVIGATION_TIMEOUT, defaults.timeouts.navigation),
            expect: parseInteger('EXPECT_TIMEOUT', env.EXPECT_TIMEOUT, defaults.timeouts.expect),
            test: parseInteger('TEST_TIMEOUT', env.TEST_TIMEOUT, defaults.timeouts.test),
        }),
        retries: parseInteger('RETRIES', env.RETRIES, isCI ? 1 : 0),
        workers: parseInteger('WORKERS', env.WORKERS, isCI ? 2 : 4),
        video: oneOf('VIDEO', env.VIDEO || defaults.video, ARTIFACT_MODES),
        trace: oneOf('TRACE', env.TRACE || defaults.trace, ARTIFACT_MODES),
        users,
        db,
        jiraBaseUrl: trimSlash(env.JIRA_BASE_URL || ''),
        logLevel: env.LOG_LEVEL || (isCI ? 'info' : 'warn'),
        // Run only @quarantine tests (flaky tests that report but don't block merges)
        quarantine: parseBoolean('QUARANTINE', env.QUARANTINE, false),
        // Run only visual tests; they must run in Docker (npm run test:visual) for stable pixels
        visual: parseBoolean('VISUAL', env.VISUAL, false),
        inDocker: parseBoolean('IN_DOCKER', env.IN_DOCKER, false),
        // OpenAPI document every API response is checked against: OPENAPI_SPEC, else the demo
        // app's contract when testing the demo app, else none (checks off)
        openApiSpec: env.OPENAPI_SPEC || (useDemoApp ? path.join(ROOT, 'contracts', 'openapi.yaml') : ''),
        // Write a mergeable blob report (CI shards) instead of the HTML report
        blobReport: parseBoolean('BLOB_REPORT', env.BLOB_REPORT, false),
        // List every test, ignoring the visual and quarantine filters (used by npm run lint:tests)
        allTests: parseBoolean('ALL_TESTS', env.ALL_TESTS, false),
    });
}

export type Config = ReturnType<typeof buildConfig>;

/** URL of the app under test: BASE_URL, or the bundled demo app */
export function appUrl(c: Pick<Config, 'baseUrl' | 'demoAppPort'>): string {
    return c.baseUrl || `http://127.0.0.1:${c.demoAppPort}`;
}

/** Returns a role's credentials, or throws naming the variables to set. */
export function requireCredentials(
    config: { users: Record<Role, { username?: string | undefined; password?: string | undefined }> },
    role: Role = 'admin',
): Credentials {
    const { username, password } = config.users[role];
    if (!username || !password) {
        const vars = ROLE_ENV[role];
        throw new Error(
            `${vars.username} and ${vars.password} must be set for the ${role} role. Copy .env.example to .env.`,
        );
    }
    return { username, password };
}

loadEnvFile();
const defaults = JSON.parse(fs.readFileSync(path.join(__dirname, 'testConfig.json'), 'utf8')) as Defaults;

export const config: Config = buildConfig(process.env, defaults);
