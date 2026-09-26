/**
 * Generated-input (property-based) tests with fast-check: instead of a few chosen
 * examples, each test states a rule and checks it against many generated inputs,
 * including unicode, emoji, control characters and edge lengths. A failure is
 * shrunk to the smallest input that still fails, and the seed in the report
 * reproduces it exactly (TEST_SEED=...).
 */
import fc from 'fast-check';
import { test, expect } from '../fixtures';
import type { ApiClient } from '../../utils/apiClient';
import type { Item } from '../../pages/ItemsPage';

/** The API's rule: names are trimmed and must be 1-255 characters (code points, as MySQL counts them) */
const MAX_NAME_LENGTH = 255;
const isValidName = (name: string) => {
    const length = [...name.trim()].length;
    return length >= 1 && length <= MAX_NAME_LENGTH;
};

/** Names that stress the rule: any unicode, whitespace-padded, blank, and around the length limit */
const names = fc.oneof(
    fc.string({ unit: 'grapheme', maxLength: 40 }),
    fc.string({ unit: 'binary', maxLength: 40 }),
    fc
        .tuple(fc.constantFrom(' ', '\t', '\n', ' ', '　'), fc.string({ maxLength: 20 }))
        .map(([pad, s]) => pad + s + pad),
    fc.constantFrom('', ' ', '\t\n'),
    fc.integer({ min: MAX_NAME_LENGTH - 2, max: MAX_NAME_LENGTH + 3 }).map((n) => 'é'.repeat(n)),
    fc.integer({ min: MAX_NAME_LENGTH - 2, max: MAX_NAME_LENGTH + 3 }).map((n) => '🧪'.repeat(n)),
);

/** Checks one name against the rule; creates and cleans up an item when it's valid */
async function checkName(api: ApiClient, trackItem: (item: { id: number }) => void, name: string): Promise<void> {
    const response = await api.post<Item>('/api/items', { name });
    if (!isValidName(name)) {
        expect(response.status, `invalid name ${JSON.stringify(name)} should be rejected`).toBe(400);
        return;
    }
    expect(response.status, `valid name ${JSON.stringify(name)} should be accepted`).toBe(201);
    trackItem(response.body);
    expect(response.body.name).toBe(name.trim());
    const fetched = await api.get<Item>(`/api/items/${response.body.id}`);
    expect(fetched.body.name).toBe(name.trim());
}

test.describe('Item names (generated inputs)', { tag: '@api' }, () => {
    test('any name is either saved trimmed or rejected with 400, never a server error', async ({
        authedApi,
        trackItem,
        checkProperty,
    }) => {
        await checkProperty(names, (name) => checkName(authedApi, trackItem, name));
    });
});
