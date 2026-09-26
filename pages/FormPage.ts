import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Demo app form page ("/"). */
export class FormPage extends BasePage {
    static override path = '/';

    readonly heading: Locator;
    readonly exampleButton: Locator;
    readonly result: Locator;
    readonly input: Locator;
    readonly submitButton: Locator;
    readonly message: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', { level: 1 });
        this.exampleButton = page.getByRole('button', { name: 'Run example action' });
        this.result = page.getByText('Example action completed');
        this.input = page.getByLabel('Example input');
        this.submitButton = page.getByRole('button', { name: 'Submit' });
        this.message = page.getByRole('status');
    }

    async runExampleAction(): Promise<void> {
        await this.exampleButton.click();
    }

    async submit(value: string): Promise<void> {
        await this.input.fill(value);
        await this.submitButton.click();
    }
}
