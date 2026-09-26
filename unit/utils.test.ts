import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact } from '../utils/apiClient';
import { createLogger } from '../utils/logger';
import { allureCategories as categories } from '../utils/allureCategories';

test('redact masks credentials at any depth and keeps other fields', () => {
    const input = {
        request: { headers: { Authorization: 'Bearer abc', Accept: 'json' }, body: { username: 'qa', password: 'x' } },
        response: { body: { token: 't', items: [{ apiKey: 'k', name: 'n' }] } },
    };
    assert.deepEqual(redact(input), {
        request: { headers: { Authorization: '***', Accept: 'json' }, body: { username: 'qa', password: '***' } },
        response: { body: { token: '***', items: [{ apiKey: '***', name: 'n' }] } },
    });
});

test('logger only prints messages at or above its level', (t) => {
    const printed: string[] = [];
    t.mock.method(console, 'log', (message: string) => printed.push(message));
    t.mock.method(console, 'warn', (message: string) => printed.push(message));
    const log = createLogger('unit', 'warn');
    log.debug('hidden');
    log.info('hidden');
    log.warn('shown');
    assert.deepEqual(printed, ['[WARN] [unit] shown']);
});

test('Allure categories: specific categories come before catch-alls', () => {
    const names = categories.map((c) => c.name);
    assert.ok(names.indexOf('Infrastructure Problem') < names.indexOf('Application Bug'));
    assert.ok(names.indexOf('Flaky Test') < names.indexOf('Test Defect'));
});
