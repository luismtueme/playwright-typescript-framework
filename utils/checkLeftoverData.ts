/**
 * Fails if tests left data behind in the database. Run after the suites in CI:
 * every test is expected to delete what it creates (see createItem / addCleanup).
 *
 * Usage: npm run check:leftovers   (no-op when DB_HOST is not set)
 */
import { config } from '../config';
import { DbClient, type Row } from './dbClient';

// Tables the tests write to
const TABLES = ['items'];

async function main(): Promise<void> {
    if (!config.db) {
        console.log('No database configured; skipping leftover data check.');
        return;
    }
    const db = new DbClient(config.db);
    try {
        const leftovers: Array<{ table: string; rows: Row[] }> = [];
        for (const table of TABLES) {
            const rows = await db.query(`SELECT * FROM \`${table}\` LIMIT 10`);
            if (rows.length > 0) leftovers.push({ table, rows });
        }
        if (leftovers.length > 0) {
            console.error('Tests left data behind. Register cleanup for anything a test creates:');
            for (const { table, rows } of leftovers) {
                console.error(`  ${table}: ${rows.map((row) => JSON.stringify(row)).join('\n    ')}`);
            }
            process.exitCode = 1;
            return;
        }
        console.log(`No leftover test data in: ${TABLES.join(', ')}`);
    } finally {
        await db.close();
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
