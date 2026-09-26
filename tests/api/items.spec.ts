import { test, expect } from '../fixtures';
import type { Item } from '../../pages/ItemsPage';

test.describe('Items API', () => {
    test('creates an item and fetches it by id', { tag: '@smoke' }, async ({ authedApi, trackItem }) => {
        const created = await authedApi.post<Item>('/api/items', { name: 'Manhole 42 inspection' });
        expect(created.status).toBe(201);
        trackItem(created.body);
        expect(created.body).toMatchObject({ id: expect.any(Number), name: 'Manhole 42 inspection' });

        const fetched = await authedApi.get<Item>(`/api/items/${created.body.id}`);
        expect(fetched.status).toBe(200);
        expect(fetched.body).toEqual(created.body);
    });

    test('rejects an item without a name', async ({ authedApi }) => {
        const response = await authedApi.post('/api/items', { name: '' });
        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({ error: { code: 'VALIDATION_ERROR', field: 'name' } });
    });

    test('rejects a body that is not JSON', async ({ authedApi }) => {
        // A Buffer is sent as-is; a string would be serialized as a (valid) JSON string
        const response = await authedApi.post('/api/items', Buffer.from('name=oops'), {
            headers: { 'Content-Type': 'application/json' },
        });
        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({ error: { code: 'INVALID_JSON' } });
    });

    test('rejects a name longer than 255 characters', async ({ authedApi }) => {
        const response = await authedApi.post('/api/items', { name: 'x'.repeat(256) });
        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({ error: { code: 'VALIDATION_ERROR', field: 'name' } });
    });

    test('rejects requests without a token', async ({ api }) => {
        const response = await api.get('/api/items');
        expect(response.status).toBe(401);
    });

    test('deletes an item', async ({ authedApi, createItem }) => {
        const item = await createItem();
        expect((await authedApi.delete(`/api/items/${item.id}`)).status).toBe(204);
        expect((await authedApi.get(`/api/items/${item.id}`)).status).toBe(404);
    });
});
