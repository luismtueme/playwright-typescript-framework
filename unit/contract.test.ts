import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { Contract, ContractViolation } from '../utils/contract';

const contract = new Contract(path.join(__dirname, '..', 'contracts', 'openapi.yaml'));
const item = { id: 1, name: 'Manhole 42 inspection', createdAt: '2026-01-05T09:00:00.000Z' };

test('matches concrete paths to their templates, ignoring query strings', () => {
    assert.equal(contract.templateFor('/api/items/42'), '/api/items/{id}');
    assert.equal(contract.templateFor('/api/items?page=2'), '/api/items');
    assert.equal(contract.templateFor('/api/nope'), undefined);
});

test('documented responses with matching bodies pass', () => {
    assert.deepEqual(contract.check({ method: 'GET', path: '/api/items/1', status: 200, body: item }), []);
    assert.deepEqual(contract.check({ method: 'GET', path: '/api/items', status: 200, body: { items: [item] } }), []);
    assert.deepEqual(contract.check({ method: 'DELETE', path: '/api/items/1', status: 204, body: null }), []);
    assert.deepEqual(
        contract.check({ method: 'GET', path: '/api/me', status: 401, body: { error: { code: 'UNAUTHORIZED' } } }),
        [],
    );
});

test('undocumented operations and statuses are violations', () => {
    assert.match(
        contract.check({ method: 'PUT', path: '/api/items/1', status: 200, body: {} })[0] ?? '',
        /not in the contract/,
    );
    assert.match(
        contract.check({ method: 'GET', path: '/api/unknown', status: 200, body: {} })[0] ?? '',
        /not in the contract/,
    );
    assert.match(
        contract.check({ method: 'GET', path: '/api/items', status: 500, body: {} })[0] ?? '',
        /status 500 is not documented \(documented: 200, 401\)/,
    );
});

test('bodies that break the schema are violations, with the field named', () => {
    const cases: Array<[unknown, RegExp]> = [
        [{ ...item, secret: 'x' }, /must NOT have additional properties \(secret\)/],
        [{ ...item, id: 'one' }, /body\/id must be integer/],
        [{ ...item, createdAt: 'yesterday' }, /body\/createdAt must match format "date-time"/],
        [{ ...item, name: 'x'.repeat(256) }, /body\/name must NOT have more than 255 characters/],
        [{ id: 1, name: 'n' }, /must have required property 'createdAt'/],
    ];
    for (const [body, expected] of cases) {
        const problems = contract.check({ method: 'GET', path: '/api/items/1', status: 200, body });
        assert.ok(
            problems.some((p) => expected.test(p)),
            `${JSON.stringify(problems)} should match ${expected}`,
        );
    }
});

test('a body on a response documented without one is a violation', () => {
    assert.match(
        contract.check({ method: 'DELETE', path: '/api/items/1', status: 204, body: { deleted: true } })[0] ?? '',
        /documented without a body/,
    );
});

test('when the body could not be read, only the status is checked', () => {
    assert.deepEqual(
        contract.check({ method: 'POST', path: '/api/login', status: 200, body: null, bodyUnavailable: true }),
        [],
    );
    assert.equal(
        contract.check({ method: 'POST', path: '/api/login', status: 418, body: null, bodyUnavailable: true }).length,
        1,
    );
});

test('ContractViolation lists every problem', () => {
    const error = new ContractViolation(['first', 'second']);
    assert.equal(error.name, 'ContractViolation');
    assert.match(error.message, /- first\n {2}- second/);
});
