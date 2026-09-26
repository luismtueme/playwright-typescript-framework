/**
 * Playwright Test global setup: writes Allure environment, executor and categories.
 * Cleaning old results is done by `npm run clean` (part of `npm test`), so running
 * one suite never deletes the other suite's results.
 */
import { writeAllureMetadata } from './allureMetadata';

export default function globalSetup(): void {
    writeAllureMetadata();
}
