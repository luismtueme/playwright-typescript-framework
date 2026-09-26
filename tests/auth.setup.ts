/**
 * Logs in once per role and saves each session (cookies + local storage).
 * Browser tests then start already logged in as their role, instead of going
 * through the login page every time. Runs as the "setup" project first.
 *
 * Logging in via the API is faster than the UI; the login page itself is covered
 * by tests/ui/login.spec.ts. For your app, change the endpoint and payload below
 * (or log in through the UI with a page object).
 */
import { test as setup, expect } from '@playwright/test';
import { config, requireCredentials, ROLES } from '../config';
import { authFile } from '../utils/authState';

for (const role of ROLES) {
    setup(`authenticate as ${role}`, async ({ request }) => {
        const { username, password } = requireCredentials(config, role);
        const response = await request.post('/api/login', { data: { username, password } });
        expect(response.status(), await response.text()).toBe(200);
        await request.storageState({ path: authFile(role) });
    });
}
