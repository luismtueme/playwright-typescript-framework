/**
 * Opens Playwright's code generator already logged in, so you record from the page
 * you want to test instead of recording the login every time.
 *
 *   npm run codegen                         the home page, as admin
 *   npm run codegen -- /items --role viewer
 *   npm run codegen -- --print              log in and print the command, without opening a browser
 *
 * Starts the demo app if it's the target and isn't running. Paste the recorded steps
 * into a spec and move the locators into a page object (see AGENTS.md).
 */
import { spawn, type ChildProcess } from 'child_process';
import { request } from '@playwright/test';
import { appUrl, config, requireCredentials, ROLES, type Role } from '../config';
import { authFile } from './authState';
import { parseArgs } from './scaffold';

async function isUp(url: string): Promise<boolean> {
    try {
        await fetch(url);
        return true;
    } catch {
        return false;
    }
}

async function startDemoApp(url: string): Promise<ChildProcess> {
    // Node directly (no shell), so kill() stops the server itself rather than a wrapper
    const server = spawn(process.execPath, ['--import', 'tsx', 'demo-app/server.ts'], { stdio: 'ignore' });
    for (let i = 0; i < 60; i++) {
        if (await isUp(url)) return server;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    server.kill();
    throw new Error(`The demo app did not start at ${url}`);
}

/** Logs in through the API, as tests/auth.setup.ts does, and saves the session */
async function saveSession(baseURL: string, role: Role): Promise<{ file: string; user: string }> {
    const { username, password } = requireCredentials(config, role);
    const context = await request.newContext({ baseURL });
    try {
        const login = await context.post('/api/login', { data: { username, password } });
        if (!login.ok()) throw new Error(`Login as ${role} failed (${login.status()}): ${await login.text()}`);
        const me = await context.get('/api/me');
        const { username: user } = (await me.json()) as { username: string };
        const file = authFile(role);
        await context.storageState({ path: file });
        return { file, user };
    } finally {
        await context.dispose();
    }
}

async function main(): Promise<void> {
    const { name: urlPath = '/', options } = parseArgs(process.argv.slice(2));
    const role = (typeof options.role === 'string' ? options.role : 'admin') as Role;
    if (!ROLES.includes(role)) throw new Error(`--role must be one of: ${ROLES.join(', ')}`);

    const baseURL = appUrl(config);
    const server = config.useDemoApp && !(await isUp(baseURL)) ? await startDemoApp(baseURL) : undefined;
    try {
        const { file, user } = await saveSession(baseURL, role);
        const args = ['codegen', `--load-storage=${file}`, new URL(urlPath, baseURL).href];
        console.log(`Logged in as ${user} (${role})`);
        if (options.print) {
            console.log(`npx playwright ${args.join(' ')}`);
            return;
        }
        // Keep the demo app running until the codegen window is closed
        await new Promise<void>((resolve, reject) => {
            const codegen = spawn(process.execPath, [require.resolve('@playwright/test/cli'), ...args], {
                stdio: 'inherit',
            });
            codegen.on('exit', () => resolve());
            codegen.on('error', reject);
        });
    } finally {
        server?.kill();
    }
}

main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
});
