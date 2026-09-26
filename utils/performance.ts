/**
 * Page performance metrics, measured in the browser with the standard
 * Performance APIs: navigation timing, Largest Contentful Paint and Cumulative
 * Layout Shift (Core Web Vitals). LCP and CLS are Chromium-only, so they're
 * undefined in other browsers.
 *
 * CI machines are noisy, so budgets (config/performanceBudgets.json) should catch
 * regressions, not measure absolute speed.
 */
import type { Page } from '@playwright/test';

export interface PageMetrics {
    /** Time to first byte, ms */
    ttfb: number;
    /** DOMContentLoaded, ms from navigation start */
    domContentLoaded: number;
    /** load event, ms from navigation start */
    load: number;
    /** Largest Contentful Paint, ms (Chromium only) */
    lcp?: number;
    /** Cumulative Layout Shift, unitless (Chromium only) */
    cls?: number;
}

export type Budget = Partial<Record<keyof PageMetrics, number>>;

/** Measures the current page. Call after navigation; waits for the load event. */
export async function measurePage(page: Page): Promise<PageMetrics> {
    await page.waitForLoadState('load');
    return page.evaluate(async () => {
        const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        if (!nav) throw new Error('No navigation timing entry: measure right after page.goto()');

        const observe = <T>(type: string, reduce: (entries: PerformanceEntry[]) => T): Promise<T | undefined> =>
            new Promise((resolve) => {
                if (!PerformanceObserver.supportedEntryTypes.includes(type)) return resolve(undefined);
                const observer = new PerformanceObserver((list) => {
                    observer.disconnect();
                    resolve(reduce(list.getEntries()));
                });
                observer.observe({ type, buffered: true });
                // Nothing buffered (e.g. no layout shifts): report the empty result
                setTimeout(() => {
                    observer.disconnect();
                    resolve(reduce([]));
                }, 250);
            });

        const lcp = await observe('largest-contentful-paint', (entries) => entries.at(-1)?.startTime ?? 0);
        const cls = await observe('layout-shift', (entries) =>
            entries.reduce((sum, e) => {
                const shift = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
                return shift.hadRecentInput ? sum : sum + shift.value;
            }, 0),
        );

        return {
            ttfb: Math.round(nav.responseStart - nav.startTime),
            domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            load: Math.round(nav.loadEventEnd - nav.startTime),
            ...(lcp === undefined ? {} : { lcp: Math.round(lcp) }),
            ...(cls === undefined ? {} : { cls: Number(cls.toFixed(4)) }),
        };
    });
}

/** Metrics over their budget, as readable lines; empty when within budget. */
export function overBudget(metrics: PageMetrics, budget: Budget): string[] {
    return (Object.entries(budget) as Array<[keyof PageMetrics, number]>)
        .filter(([metric, limit]) => metrics[metric] !== undefined && (metrics[metric] ?? 0) > limit)
        .map(([metric, limit]) => `${metric} ${metrics[metric]} > budget ${limit}`);
}
