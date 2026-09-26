/**
 * Checks what the API wrote, directly in MySQL. Runs only when a database is
 * configured (DB_HOST); CI provides one. expect.poll retries, so this also works
 * for apps that write to the database asynchronously.
 */
import { test, expect } from '../fixtures';
import { config } from '../../config';

test.describe('Items are persisted in the database', { tag: ['@api', '@db'] }, () => {
    test.skip(!config.db, 'No database configured: set DB_HOST (see .env.example)');

    test('a created item is stored', async ({ authedApi, trackItem, db }) => {
        const created = await authedApi.post<{ id: number; name: string }>('/api/items', {
            name: 'Lateral 7 inspection',
        });
        expect(created.status).toBe(201);
        trackItem(created.body);

        await expect
            .poll(() => db.one('SELECT id, name FROM items WHERE id = ?', [created.body.id]), {
                message: `row for item ${created.body.id}`,
            })
            .toEqual({ id: created.body.id, name: 'Lateral 7 inspection' });
    });

    test('a deleted item is removed', async ({ authedApi, createItem, db }) => {
        const item = await createItem({ name: 'Temporary item' });

        expect((await authedApi.delete(`/api/items/${item.id}`)).status).toBe(204);

        await expect
            .poll(() => db.count('items', 'id = ?', [item.id]), { message: `rows for item ${item.id}` })
            .toBe(0);
    });
});
