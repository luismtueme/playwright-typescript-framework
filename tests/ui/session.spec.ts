/**
 * Time-dependent behavior, tested without waiting: page.clock replaces the
 * browser's timers, so 15 minutes pass in milliseconds and the result is exact.
 */
import { test, expect } from '../fixtures';
import { ItemsPage } from '../../pages/ItemsPage';

test.describe('Session idle timeout', () => {
    test.beforeEach(async ({ page, itemsPage }) => {
        // Install before the page loads, so the page's own timers use the fake clock
        await page.clock.install({ time: new Date('2026-01-05T09:00:00') });
        await itemsPage.open();
        await expect(itemsPage.heading).toBeVisible();
    });

    test('expires after 15 minutes without activity', async ({ page, itemsPage }) => {
        await test.step('one second before the timeout, the form is still usable', async () => {
            await page.clock.fastForward('14:59');
            await expect(itemsPage.sessionExpired).toBeHidden();
            await expect(itemsPage.nameInput).toBeVisible();
        });

        await test.step('at 15 minutes, the page asks to log in again', async () => {
            await page.clock.fastForward('00:01');
            await expect(itemsPage.sessionExpired).toBeVisible();
            await expect(itemsPage.nameInput).toBeHidden();
            await expect(itemsPage.logInAgainLink).toHaveAttribute('href', '/login?next=/items');
        });
    });

    test('activity restarts the timer', async ({ page, itemsPage }) => {
        await test.step('10 minutes pass, then the user types', async () => {
            await page.clock.fastForward('10:00');
            await itemsPage.nameInput.press('a');
        });

        await test.step('10 more minutes: 20 in total, but only 10 idle', async () => {
            await page.clock.fastForward('10:00');
            await expect(itemsPage.sessionExpired).toBeHidden();
        });

        await test.step(`${ItemsPage.IDLE_TIMEOUT} after the last keypress, it expires`, async () => {
            await page.clock.fastForward('05:00');
            await expect(itemsPage.sessionExpired).toBeVisible();
        });
    });
});
