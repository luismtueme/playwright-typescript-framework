/**
 * Permissions matrix: every role against every API action. The table is the
 * specification; one test per cell, so a failure names the exact role and action.
 */
import { test, expect, type Fixtures } from '../fixtures';
import type { ApiClient } from '../../utils/apiClient';
import type { Role } from '../../config';

type Action = 'list items' | 'read an item' | 'create an item' | 'delete an item';
type Actor = Role | 'anonymous';

/** Expected HTTP status for each role and action */
const MATRIX: Record<Actor, Record<Action, number>> = {
    admin: { 'list items': 200, 'read an item': 200, 'create an item': 201, 'delete an item': 204 },
    viewer: { 'list items': 200, 'read an item': 200, 'create an item': 403, 'delete an item': 403 },
    anonymous: { 'list items': 401, 'read an item': 401, 'create an item': 401, 'delete an item': 401 },
};

interface ActionContext {
    api: ApiClient;
    itemId: number;
    trackItem: Fixtures['trackItem'];
}

const ACTIONS: Record<Action, (ctx: ActionContext) => Promise<{ status: number }>> = {
    'list items': ({ api }) => api.get('/api/items'),
    'read an item': ({ api, itemId }) => api.get(`/api/items/${itemId}`),
    'create an item': async ({ api, trackItem }) => {
        const response = await api.post<{ id: number }>('/api/items', { name: `Permission check ${Date.now()}` });
        // An allowed create makes a second item; clean it up too
        if (response.status === 201) trackItem(response.body);
        return response;
    },
    'delete an item': ({ api, itemId }) => api.delete(`/api/items/${itemId}`),
};

/** The API client for an actor: logged in as the role, or without a token */
function clientFor(actor: Actor, { api, apiAs }: Pick<Fixtures, 'api' | 'apiAs'>): Promise<ApiClient> {
    return actor === 'anonymous' ? Promise.resolve(api) : apiAs(actor);
}

test.describe('API permissions', { tag: '@api' }, () => {
    for (const [actor, expectations] of Object.entries(MATRIX) as Array<[Actor, Record<Action, number>]>) {
        for (const [action, status] of Object.entries(expectations) as Array<[Action, number]>) {
            const verb = status < 300 ? 'can' : 'cannot';

            test(`${actor} ${verb} ${action} (${status})`, async ({ api, apiAs, createItem, trackItem }) => {
                const item = await createItem();
                const client = await clientFor(actor, { api, apiAs });

                const response = await ACTIONS[action]({ api: client, itemId: item.id, trackItem });

                expect(response.status).toBe(status);
            });
        }
    }
});
