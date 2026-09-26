import type { Page } from '@playwright/test';

/**
 * Base class for page objects.
 *
 * Page objects expose Playwright Locators and user-level actions. Keep assertions
 * in steps and specs (with `expect`), so failures point at the test, and rely on
 * Playwright's auto-waiting rather than explicit waits.
 */
export class BasePage {
    /** Path relative to the base URL, overridden by each page. */
    static path = '/';

    constructor(readonly page: Page) {}

    async open(): Promise<void> {
        await this.page.goto((this.constructor as typeof BasePage).path);
    }
}
