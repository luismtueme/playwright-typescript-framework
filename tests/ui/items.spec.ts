import { test, expect, defined } from '../fixtures';
import type { Item } from '../../pages/ItemsPage';

test.describe('Items page (logged in via saved session)', () => {
    test('opens without logging in again', { tag: '@smoke' }, async ({ itemsPage, page }) => {
        await itemsPage.open();
        await expect(page).toHaveURL(/\/items$/);
        await expect(itemsPage.heading).toBeVisible();
    });

    // Partial match: the list's content depends on other tests running in parallel,
    // so only the stable parts are listed. Omitted nodes are allowed.
    test('has the expected structure', async ({ itemsPage, page }) => {
        await itemsPage.open();
        await expect(page.getByRole('main')).toMatchAriaSnapshot(`
          - main:
            - heading "Items" [level=1]
            - textbox "New item name"
            - button "Add item"
            - list "Items"
        `);
    });

    test('lists items created through the API', async ({ itemsPage, createItem }) => {
        const item = await createItem();
        await itemsPage.open();
        await expect(itemsPage.item(item.name)).toBeVisible();
    });

    test('adds an item through the UI', async ({ itemsPage, authedApi, trackItem }) => {
        const name = `UI item ${Date.now()}`;

        const created = await test.step('add the item on the page', async () => {
            await itemsPage.open();
            const item = defined(await itemsPage.addItem(name), `The app rejected "${name}"`);
            trackItem(item);
            return item;
        });

        await test.step('the list shows it', async () => {
            await expect(itemsPage.item(name)).toBeVisible();
        });

        await test.step('the API returns it', async () => {
            // Retries until the API agrees, for apps that save asynchronously
            await expect
                .poll(async () => (await authedApi.get<Item>(`/api/items/${created.id}`)).body, {
                    message: `item ${created.id} should be readable through the API`,
                })
                .toMatchObject({ name });
        });
    });

    test('rejects an empty name', async ({ itemsPage }) => {
        await itemsPage.open();
        expect(await itemsPage.addItem('')).toBeNull();
        await expect(itemsPage.error).toHaveText('Name is required');
    });
});

test.describe('Items page (logged out)', () => {
    test.use({ role: 'anonymous' });

    test('redirects to login and returns after logging in', async ({ itemsPage, loginPage, page, credentials }) => {
        await itemsPage.open();
        await expect(page).toHaveURL(/\/login\?next=%2Fitems$/);

        await loginPage.login(credentials.username, credentials.password);
        await expect(page).toHaveURL(/\/items$/);
        await expect(itemsPage.heading).toBeVisible();
    });
});
