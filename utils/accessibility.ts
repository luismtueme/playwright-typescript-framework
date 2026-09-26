/**
 * Accessibility checks with axe-core, shared by both runners.
 *
 * Checks WCAG 2.1 A and AA rules plus axe best practices. Returns violations
 * rather than asserting, so each runner can attach the full report and then fail
 * with a readable summary.
 */
import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';

export type Violation = Result;

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

export interface AccessibilityOptions {
    /** CSS selectors to skip (e.g. third-party widgets you don't control) */
    exclude?: string[];
    /** axe rule ids to skip, each with a comment saying why */
    disableRules?: string[];
}

export async function findAccessibilityViolations(
    page: Page,
    { exclude = [], disableRules = [] }: AccessibilityOptions = {},
): Promise<Violation[]> {
    let builder = new AxeBuilder({ page }).withTags(TAGS);
    for (const selector of exclude) builder = builder.exclude(selector);
    if (disableRules.length > 0) builder = builder.disableRules(disableRules);
    const { violations } = await builder.analyze();
    return violations;
}

/** One line per violation, with the elements involved, for assertion messages. */
export function formatViolations(violations: Violation[]): string {
    return violations
        .map((v) => {
            const targets = v.nodes.map((node) => node.target.join(' ')).join(', ');
            return `[${v.impact}] ${v.id}: ${v.help} (${targets}) ${v.helpUrl}`;
        })
        .join('\n');
}
