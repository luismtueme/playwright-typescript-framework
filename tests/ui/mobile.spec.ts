import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

// Without <meta name="viewport">, phones lay pages out 980px wide and shrink them to fit,
// so text is unreadably small. Runs on every PR; the nightly run repeats the whole suite
// on real device profiles (TEST_DEVICE).
const PHONE = { width: 390, height: 844 };

async function expectFitsPhone(page: Page) {
    const layout = await page.evaluate(() => ({
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.width, 'lays out at the device width, not a zoomed-out desktop width').toBe(PHONE.width);
    expect(layout.scrollWidth, 'no horizontal scrolling').toBeLessThanOrEqual(PHONE.width);
}

test.describe('On a phone', () => {
    test.use({ viewport: PHONE, isMobile: true, hasTouch: true });
    test.skip(({ browserName }) => browserName === 'firefox', 'Firefox has no mobile emulation');

    test('the form page fits the screen', async ({ formPage, page }) => {
        await formPage.open();
        await expect(formPage.heading).toBeVisible();
        await expectFitsPhone(page);
    });

    test('the items page fits the screen', async ({ itemsPage, page }) => {
        await itemsPage.open();
        await expect(itemsPage.heading).toBeVisible();
        await expectFitsPhone(page);
    });

    test.describe('logged out', () => {
        test.use({ role: 'anonymous' });

        test('the login page fits the screen', async ({ loginPage, page }) => {
            await loginPage.open();
            await expect(loginPage.submitButton).toBeVisible();
            await expectFitsPhone(page);
        });
    });
});
