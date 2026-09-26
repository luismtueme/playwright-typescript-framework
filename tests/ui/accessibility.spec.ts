import { test, expect } from '../fixtures';

// WCAG 2.1 A/AA and axe best practices on every page of the app.
// Add a line here for each new page object.
test.describe('Accessibility', { tag: '@a11y' }, () => {
    test('form page', async ({ formPage, checkAccessibility }) => {
        await formPage.open();
        await checkAccessibility();
    });

    test('items page', async ({ itemsPage, checkAccessibility }) => {
        await itemsPage.open();
        await expect(itemsPage.heading).toBeVisible();
        await checkAccessibility();
    });

    test.describe('logged out', () => {
        test.use({ role: 'anonymous' });

        test('login page', async ({ loginPage, checkAccessibility }) => {
            await loginPage.open();
            await checkAccessibility();
        });
    });
});
