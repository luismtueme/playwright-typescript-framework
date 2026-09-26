import type { Locator, Page } from '@playwright/test';
import type { components } from '../contracts/openapi';
import { BasePage } from './BasePage';

/** An item as the API returns it; generated from the OpenAPI contract */
export type Item = components['schemas']['Item'];

/** Demo app items page ("/items"). Requires a logged-in session. */
export class ItemsPage extends BasePage {
    static override path = '/items';

    readonly heading: Locator;
    readonly nameInput: Locator;
    readonly addButton: Locator;
    readonly error: Locator;
    readonly list: Locator;
    /** Shown after 15 minutes without a click or keypress */
    readonly sessionExpired: Locator;
    readonly logInAgainLink: Locator;
    /** Shown instead of the add form to users without permission to change items */
    readonly readOnlyNotice: Locator;
    /** Shown while the list is loading */
    readonly loading: Locator;
    /** Shown when the list couldn't be loaded, with a retry button */
    readonly loadError: Locator;
    readonly retryButton: Locator;

    /** Idle time after which the page shows the session-expired notice */
    static readonly IDLE_TIMEOUT = '15:00';

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', { name: 'Items' });
        this.nameInput = page.getByLabel('New item name');
        this.addButton = page.getByRole('button', { name: 'Add item' });
        this.error = page.getByRole('alert');
        this.list = page.getByRole('list', { name: 'Items' });
        this.sessionExpired = page.getByText('Your session has expired');
        this.logInAgainLink = page.getByRole('link', { name: 'Log in again' });
        this.readOnlyNotice = page.getByText('You have read-only access');
        this.loading = page.getByText('Loading items…');
        this.loadError = page.getByText('Could not load the items.');
        this.retryButton = page.getByRole('button', { name: 'Try again' });
    }

    /** List entry for an item, located by its visible name. */
    item(name: string): Locator {
        return this.list.getByRole('listitem').filter({ hasText: name });
    }

    /**
     * Adds an item through the UI.
     * @returns The created item (from the app's API response, so tests can clean it
     *   up), or null if the app rejected it.
     */
    async addItem(name: string): Promise<Item | null> {
        await this.nameInput.fill(name);
        const [response] = await Promise.all([
            this.page.waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'POST'),
            this.addButton.click(),
        ]);
        return response.ok() ? ((await response.json()) as Item) : null;
    }
}
