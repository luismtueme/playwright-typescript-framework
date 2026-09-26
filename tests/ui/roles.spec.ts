/**
 * What each role sees in the UI. The API side is covered by
 * tests/api/permissions.spec.ts; this checks the page matches it.
 */
import { test, expect } from '../fixtures';

test.describe('Items page as admin', () => {
    test.use({ role: 'admin' });

    test('shows the add form', async ({ itemsPage }) => {
        await itemsPage.open();
        await expect(itemsPage.nameInput).toBeVisible();
        await expect(itemsPage.readOnlyNotice).toBeHidden();
    });
});

test.describe('Items page as viewer', () => {
    test.use({ role: 'viewer' });

    test('lists items but hides the add form', async ({ itemsPage, createItem }) => {
        const item = await createItem(); // created by admin; the viewer should still see it

        await itemsPage.open();

        await expect(itemsPage.readOnlyNotice).toBeVisible();
        await expect(itemsPage.nameInput).toBeHidden();
        await expect(itemsPage.item(item.name)).toBeVisible();
    });
});
