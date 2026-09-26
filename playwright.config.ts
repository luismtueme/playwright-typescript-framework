/**
 * Playwright Test configuration. All values come from config/index.ts, shared with
 * the demo app and the scripts.
 * @see https://playwright.dev/docs/test-configuration
 */
import { defineConfig, devices } from '@playwright/test';
import { appUrl, config } from './config';

// One seed per run, set before workers start so they all inherit it (see utils/testData.ts)
process.env.TEST_SEED ??= String(Math.floor(Math.random() * 2 ** 31));

const DEVICES = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' } as const;
const baseURL = appUrl(config);

if (config.visual && !config.inDocker && !config.allTests) {
    // Fonts and anti-aliasing differ by OS; baselines are only valid from the Docker image
    throw new Error('Visual tests must run in Docker for stable screenshots: npm run test:visual');
}
const VISUAL_TESTS = /[\\/]visual[\\/]/;

/** Phones the visual tests also check, each with its own baselines */
const VISUAL_DEVICES = ['Pixel 7', 'iPhone 15'];

interface Target {
    name: string;
    use: (typeof devices)[string];
    /** Baselines subfolder; the desktop browser's baselines sit at the root */
    baselines: string;
}

const desktop: Target = {
    name: config.browser,
    use: { ...devices[DEVICES[config.browser]], viewport: config.viewport },
    baselines: '',
};

/** A Playwright device: viewport, user agent, touch, and the browser it ships with */
function mobile(name: string): Target {
    const descriptor = devices[name];
    if (!descriptor) {
        throw new Error(
            `Unknown TEST_DEVICE "${name}". Use a Playwright device name, such as "Pixel 7" or "iPhone 15"`,
        );
    }
    return { name, use: descriptor, baselines: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/` };
}

// TEST_DEVICE runs the tests on one device; visual runs cover the desktop browser and each phone
const targets = config.device
    ? [mobile(config.device)]
    : config.visual
      ? [desktop, ...VISUAL_DEVICES.map(mobile)]
      : [desktop];

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
    // CI shards write blob reports that the merge job combines into one HTML and JSON report
    reporter: [
        ['list'],
        ['allure-playwright'],
        config.blobReport
            ? ['blob', { outputDir: 'blob-report' }]
            : ['html', { outputFolder: 'html-report', open: 'never' }],
    ],
    use: {
        baseURL,
        headless: config.headless,
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
        ...targets.map((target) => ({
            name: target.name,
            use: target.use,
            snapshotPathTemplate: `{testDir}/visual/__screenshots__/{testFileName}/${target.baselines}{arg}{ext}`,
            dependencies: ['setup'],
            // Visual tests run only with VISUAL=true (npm run test:visual)
            ...(config.allTests ? {} : config.visual ? { testMatch: VISUAL_TESTS } : { testIgnore: VISUAL_TESTS }),
            // @quarantine tests run only with QUARANTINE=true (npm run test:quarantine)
            ...(config.allTests ? {} : config.quarantine ? { grep: /@quarantine/ } : { grepInvert: /@quarantine/ }),
        })),
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
