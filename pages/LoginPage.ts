import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Demo app login page ("/login"). */
export class LoginPage extends BasePage {
    static override path = '/login';

    readonly username: Locator;
    readonly password: Locator;
    readonly submitButton: Locator;
    readonly error: Locator;
    readonly welcome: Locator;

    constructor(page: Page) {
        super(page);
        this.username = page.getByLabel('Username');
        this.password = page.getByLabel('Password');
        this.submitButton = page.getByRole('button', { name: 'Log in' });
        this.error = page.getByRole('alert');
        this.welcome = page.getByText(/^Welcome, /);
    }

    async login(username: string, password: string): Promise<void> {
        await this.username.fill(username);
        await this.password.fill(password);
        await this.submitButton.click();
    }
}
