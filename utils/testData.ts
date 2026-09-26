/**
 * Reproducible test data. Every run has a seed (TEST_SEED, or a new one per run);
 * each test gets its own generator derived from that seed and its title, so data
 * is realistic, different between runs, and exactly the same when you re-run with
 * the seed from a failed test's report:
 *
 *   TEST_SEED=1234567 npx playwright test tests/ui/items.spec.ts
 */

/** The run's seed: TEST_SEED if set, otherwise one fixed for this process */
export const RUN_SEED: number = process.env.TEST_SEED
    ? Number(process.env.TEST_SEED)
    : Math.floor(Math.random() * 2 ** 31);
if (!Number.isInteger(RUN_SEED)) throw new Error(`TEST_SEED must be an integer, got "${process.env.TEST_SEED}"`);

/** A small, fast seeded generator (mulberry32). Same seed, same sequence. */
export class Random {
    private state: number;

    constructor(readonly seed: number) {
        this.state = seed >>> 0;
    }

    /** Float in [0, 1) */
    next(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
    }

    /** Integer in [min, max] */
    int(min: number, max: number): number {
        return min + Math.floor(this.next() * (max - min + 1));
    }

    pick<T>(values: readonly T[]): T {
        const value = values[this.int(0, values.length - 1)];
        if (value === undefined) throw new Error('pick() needs a non-empty list');
        return value;
    }
}

/** Seed for one test: stable for a given run seed and test title */
export function seedFor(title: string, runSeed: number = RUN_SEED): number {
    let hash = runSeed >>> 0;
    for (let i = 0; i < title.length; i++) hash = Math.imul(hash ^ title.charCodeAt(i), 0x01000193) >>> 0;
    return hash;
}

const ASSETS = ['Manhole', 'Sewer main', 'Lateral', 'Catch basin', 'Outfall', 'Culvert', 'Lift station'] as const;
const WORK = ['inspection', 'cleaning', 'repair', 'CCTV survey', 'rehabilitation', 'condition review'] as const;

/** A realistic item name, e.g. "Lateral 214 CCTV survey" */
export function itemName(random: Random): string {
    return `${random.pick(ASSETS)} ${random.int(1, 999)} ${random.pick(WORK)}`;
}
