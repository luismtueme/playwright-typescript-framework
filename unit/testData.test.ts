import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Random, itemName, seedFor } from '../utils/testData';

const sequence = (random: Random, n: number) => Array.from({ length: n }, () => random.next());

test('the same seed gives the same sequence; different seeds differ', () => {
    assert.deepEqual(sequence(new Random(42), 5), sequence(new Random(42), 5));
    assert.notDeepEqual(sequence(new Random(42), 5), sequence(new Random(43), 5));
});

test('values stay in range', () => {
    const random = new Random(7);
    for (let i = 0; i < 1000; i++) {
        const value = random.next();
        assert.ok(value >= 0 && value < 1);
        const n = random.int(3, 5);
        assert.ok(n >= 3 && n <= 5 && Number.isInteger(n));
    }
});

test('each test gets a stable seed of its own', () => {
    assert.equal(seedFor('Items › adds an item', 1), seedFor('Items › adds an item', 1));
    assert.notEqual(seedFor('Items › adds an item', 1), seedFor('Items › deletes an item', 1));
    assert.notEqual(seedFor('Items › adds an item', 1), seedFor('Items › adds an item', 2));
});

test('item names are realistic and reproducible', () => {
    const name = itemName(new Random(99));
    assert.match(name, /^[A-Z][a-z ]+ \d{1,3} [A-Za-z ]+$/);
    assert.equal(itemName(new Random(99)), name);
});

test('pick() rejects an empty list', () => {
    assert.throws(() => new Random(1).pick([]), /non-empty/);
});
