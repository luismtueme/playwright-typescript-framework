/**
 * Runs the visual tests inside the official Playwright Docker image that matches
 * the installed @playwright/test version, so screenshots render the same on
 * Windows, macOS, Linux and CI.
 *
 * Usage:
 *   npm run test:visual              compare with committed baselines
 *   npm run test:visual -- --update  write new baselines (review them in the PR)
 *   TEST_DEVICE="Pixel 7" npm run test:visual   one device only
 *
 * Requires Docker. Extra arguments are passed to `playwright test`.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config, ROOT } from '../config';

const { version } = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'node_modules', '@playwright', 'test', 'package.json'), 'utf8'),
) as { version: string };
const image = `mcr.microsoft.com/playwright:v${version}-noble`;

const args = process.argv.slice(2).map((arg) => (arg === '--update' ? '--update-snapshots' : arg));
const quote = (arg: string) => `'${arg.replace(/'/g, `'\\''`)}'`;

// On Windows and macOS the local node_modules holds native binaries for that OS (tsx
// depends on esbuild), which can't run in the Linux container. There, the container
// installs its own node_modules into a Docker volume; your local folder is untouched.
const useContainerModules = process.platform !== 'linux';
const playwrightTest = `node node_modules/@playwright/test/cli.js test ${args.map(quote).join(' ')}`;
const command = useContainerModules
    ? ['sh', '-c', `npm ci --no-audit --no-fund --loglevel=error && ${playwrightTest}`]
    : ['sh', '-c', playwrightTest];

const docker = [
    'run',
    '--rm',
    '--ipc=host', // recommended by Playwright for Chromium in Docker
    '-v',
    `${ROOT}:/work`,
    ...(useContainerModules ? ['-v', 'playwright-ts-visual-node-modules:/work/node_modules'] : []),
    '-w',
    '/work',
    '-e',
    'CI=true',
    '-e',
    'VISUAL=true',
    '-e',
    'IN_DOCKER=true',
    // Inside the container, hosts from your .env (BASE_URL, DB_HOST) are unreachable: use the demo app in memory
    // Visual runs cover the desktop browser and every phone; TEST_DEVICE narrows it to one device
    '-e',
    `TEST_DEVICE=${config.device ?? ''}`,
    '-e',
    'BASE_URL=',
    '-e',
    'DB_HOST=',
    image,
    ...command,
];

console.log(`Running visual tests in ${image}`);
const result = spawnSync('docker', docker, { stdio: 'inherit' });
if (result.error) {
    console.error(`Could not start Docker: ${result.error.message}. Visual tests need Docker installed.`);
    process.exit(1);
}
process.exit(result.status ?? 1);
