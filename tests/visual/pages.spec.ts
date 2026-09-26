/**
 * Visual comparison: each page is compared pixel by pixel with a committed baseline
 * in tests/visual/__screenshots__/.
 *
 * Run in Docker so every machine renders identically:
 *   npm run test:visual              compare with the baselines
 *   npm run test:visual -- --update  accept the current look as the new baselines
 *
 * Review baseline changes in the PR diff like any other change. Mask content that
 * changes between runs (dates, generated names, lists other tests fill).
 */
import { test, expect } from '../fixtures';

test.describe('Visual', { tag: '@visual' }, () => {
    test('form page', async ({ formPage, page }) => {
        await formPage.open();
        await expect(page).toHaveScreenshot('form-page.png', { fullPage: true });
    });

    test('form page with a validation message', async ({ formPage, page }) => {
        await formPage.open();
        await formPage.submit('');
        await expect(formPage.message).toHaveText('Please enter a value');
        await expect(page).toHaveScreenshot('form-page-validation.png', { fullPage: true });
    });

    test('items page', async ({ itemsPage, page }) => {
        await itemsPage.open();
        await expect(itemsPage.heading).toBeVisible();
        await expect(page).toHaveScreenshot('items-page.png', { fullPage: true, mask: [itemsPage.list] });
    });

    test.describe('logged out', () => {
        test.use({ role: 'anonymous' });

        test('login page with an error', async ({ loginPage, page }) => {
            await loginPage.open();
            await loginPage.login('demo', 'not-the-password');
            await expect(loginPage.error).toHaveText('Invalid username or password');
            await expect(page).toHaveScreenshot('login-page-error.png', { fullPage: true });
        });
    });
});
