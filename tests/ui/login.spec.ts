import { test, expect } from '../fixtures';

test.describe('Login', () => {
    // The login page needs a visitor without the saved session
    test.use({ role: 'anonymous' });

    test.beforeEach(async ({ loginPage }) => {
        await loginPage.open();
    });

    test('has the expected structure', async ({ page }) => {
        await expect(page.getByRole('main')).toMatchAriaSnapshot(`
          - main:
            - heading "Log in" [level=1]
            - textbox "Username"
            - textbox "Password"
            - button "Log in"
        `);
    });

    test('logs in with the configured credentials', { tag: '@smoke' }, async ({ loginPage, credentials }) => {
        await test.step('submit the configured credentials', async () => {
            await loginPage.login(credentials.username, credentials.password);
        });

        await test.step('the welcome message names the user', async () => {
            await expect(loginPage.welcome).toHaveText(`Welcome, ${credentials.username}`);
        });
    });

    test('rejects a wrong password', async ({ loginPage, credentials }) => {
        await loginPage.login(credentials.username, 'not-the-password');
        await expect(loginPage.error).toHaveText('Invalid username or password');
    });
});
