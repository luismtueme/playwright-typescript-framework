/**
 * Playwright Test configuration. All values come from config/index.ts, shared with
 * the demo app and the scripts.
 * @see https://playwright.dev/docs/test-configuration
 */
import { defineConfig, devices } from '@playwright/test';
import { config } from './config';

// One seed per run, set before workers start so they all inherit it (see utils/testData.ts)
process.env.TEST_SEED ??= String(Math.floor(Math.random() * 2 ** 31));

const DEVICES = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' } as const;
const baseURL = config.baseUrl || `http://127.0.0.1:${config.demoAppPort}`;

if (config.visual && !config.inDocker && !config.allTests) {
    // Fonts and anti-aliasing differ by OS; baselines are only valid from the Docker image
    throw new Error('Visual tests must run in Docker for stable screenshots: npm run test:visual');
}
const VISUAL_TESTS = /[\\/]visual[\\/]/;

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: config.isCI,
    retries: config.retries,
    workers: config.workers,
    timeout: config.timeouts.test,
    expect: {
        timeout: config.timeouts.expect,
        // Docker renders identically every run, so the tolerance can be near zero
        toHaveScreenshot: { maxDiffPixels: 10, animations: 'disabled' },
    },
    snapshotPathTemplate: '{testDir}/visual/__screenshots__/{testFileName}/{arg}{ext}',
    // CI shards write blob reports that the merge job combines into one HTML and JSON report
    reporter: [
        ['list'],
        ['allure-playwright'],
        config.blobReport
            ? ['blob', { outputDir: 'blob-report' }]
            : ['html', { outputFolder: 'html-report', open: 'never' }],
    ],
    use: {
        ...devices[DEVICES[config.browser]],
        baseURL,
        headless: config.headless,
        viewport: config.viewport,
        actionTimeout: config.timeouts.action,
        navigationTimeout: config.timeouts.navigation,
        trace: config.trace,
        video: config.video,
        screenshot: 'only-on-failure',
    },
    globalSetup: require.resolve('./utils/global-setup'),
    projects: [
        // Logs in once per role and saves the sessions; the `role` fixture picks one
        { name: 'setup', testMatch: /auth\.setup\.ts$/ },
        {
            name: config.browser,
            dependencies: ['setup'],
            // Visual tests run only with VISUAL=true (npm run test:visual)
            ...(config.allTests ? {} : config.visual ? { testMatch: VISUAL_TESTS } : { testIgnore: VISUAL_TESTS }),
            // @quarantine tests run only with QUARANTINE=true (npm run test:quarantine)
            ...(config.allTests ? {} : config.quarantine ? { grep: /@quarantine/ } : { grepInvert: /@quarantine/ }),
        },
    ],
    // Starts the bundled demo app unless BASE_URL points at a real application
    webServer: config.useDemoApp
        ? {
              command: 'npx tsx demo-app/server.ts',
              url: `${baseURL}/`,
              reuseExistingServer: !config.isCI,
              timeout: 30_000,
          }
        : undefined,
});
