/**
 * How the UI behaves when the network or the server fails. page.route intercepts
 * the page's API calls, so each failure is exact and repeatable: no flaky
 * environments needed.
 */
import { test, expect } from '../fixtures';

test.describe('Items page when the API fails', () => {
    // These tests fake responses on purpose, so the contract check would flag them
    test.use({ contract: false });

    test('a server error shows a message, and retry recovers', async ({ page, itemsPage, createItem }) => {
        const item = await createItem();
        await page.route('**/api/items', (route) =>
            route.fulfill({ status: 500, json: { error: { code: 'SERVER_ERROR' } } }),
        );

        await test.step('the failed load shows an error with a retry button', async () => {
            await itemsPage.open();
            await expect(itemsPage.loadError).toBeVisible();
            await expect(itemsPage.retryButton).toBeVisible();
        });

        await test.step('once the API is back, retry shows the list', async () => {
            await page.unroute('**/api/items');
            await itemsPage.retryButton.click();
            await expect(itemsPage.loadError).toBeHidden();
            await expect(itemsPage.item(item.name)).toBeVisible();
        });
    });

    test('a dropped connection shows the same message', async ({ page, itemsPage }) => {
        await page.route('**/api/items', (route) => route.abort('connectionreset'));
        await itemsPage.open();
        await expect(itemsPage.loadError).toBeVisible();
    });

    test('a slow response shows a loading indicator until it arrives', async ({ page, itemsPage, createItem }) => {
        const item = await createItem();
        let release: () => void = () => {};
        const released = new Promise<void>((resolve) => (release = resolve));
        await page.route('**/api/items', async (route) => {
            await released; // hold the response until the test lets it through
            await route.continue();
        });

        await itemsPage.open();
        await expect(itemsPage.loading).toBeVisible();

        release();
        await expect(itemsPage.loading).toBeHidden();
        await expect(itemsPage.item(item.name)).toBeVisible();
    });

    test('a failed save keeps the text and shows a message', async ({ page, itemsPage }) => {
        await itemsPage.open();
        await expect(itemsPage.loading).toBeHidden();
        await page.route('**/api/items', (route) =>
            route.request().method() === 'POST'
                ? route.fulfill({
                      status: 503,
                      json: { error: { code: 'SERVER_ERROR', message: 'db pool exhausted' } },
                  })
                : route.continue(),
        );

        await itemsPage.nameInput.fill('Culvert 9 cleaning');
        await itemsPage.addButton.click();

        // The user sees a plain message, not the server's internal detail
        await expect(itemsPage.error).toHaveText('Could not save the item. Try again.');
        await expect(itemsPage.nameInput).toHaveValue('Culvert 9 cleaning');
        await expect(itemsPage.item('Culvert 9 cleaning')).toHaveCount(0);
    });
});
