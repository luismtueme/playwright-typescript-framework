import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '@playwright/test';
import { ApiClient, type Exchange } from '../utils/apiClient';
import { startDemoApp, type DemoApp, type Item } from '../demo-app/server';
import { DEMO_USERS } from '../config';

const ADMIN = DEMO_USERS.admin;

let app: DemoApp;

before(async () => {
    app = await startDemoApp({ port: 0 });
});

after(async () => {
    await app.close();
});

test('login stores the token and sends it on later requests', async () => {
    const api = await ApiClient.create({ baseURL: app.url });
    try {
        await api.login(ADMIN.username, ADMIN.password);
        assert.equal(typeof api.token, 'string');
        const response = await api.get<{ items: Item[] }>('/api/items');
        assert.equal(response.status, 200);
        assert.deepEqual(Object.keys(response.body), ['items']);
    } finally {
        await api.dispose();
    }
});

test('login with wrong credentials throws with the status and body', async () => {
    const api = await ApiClient.create({ baseURL: app.url });
    try {
        await assert.rejects(api.login('demo', 'wrong'), /Login failed with HTTP 401: .*INVALID_CREDENTIALS/);
        assert.equal(api.token, null);
    } finally {
        await api.dispose();
    }
});

test('post, get and delete round-trip, with JSON parsed and empty bodies as null', async () => {
    const api = await ApiClient.create({ baseURL: app.url });
    try {
        await api.login(ADMIN.username, ADMIN.password);
        const created = await api.post<Item>('/api/items', { name: 'Unit test item' });
        assert.equal(created.status, 201);
        assert.equal(created.body.name, 'Unit test item');
        assert.match(created.headers['content-type'] ?? '', /application\/json/);

        const removed = await api.delete(`/api/items/${created.body.id}`);
        assert.equal(removed.status, 204);
        assert.equal(removed.body, null);
        assert.equal((await api.get(`/api/items/${created.body.id}`)).status, 404);
    } finally {
        await api.dispose();
    }
});

test('non-JSON responses come back as text', async () => {
    const api = await ApiClient.create({ baseURL: app.url });
    try {
        const page = await api.get<string>('/login');
        assert.equal(page.status, 200);
        assert.match(page.body, /<title>Log in/);
    } finally {
        await api.dispose();
    }
});

test('onExchange receives every call with credentials masked', async () => {
    const exchanges: Exchange[] = [];
    const api = await ApiClient.create({
        baseURL: app.url,
        onExchange: (exchange) => {
            exchanges.push(exchange);
        },
    });
    try {
        await api.login(ADMIN.username, ADMIN.password);
        await api.get('/api/items', { params: { page: 1 } });
    } finally {
        await api.dispose();
    }
    const [login, list] = exchanges;
    assert.equal(exchanges.length, 2);
    assert.ok(login && list);
    assert.deepEqual(login.request.body, { username: 'demo', password: '***' });
    assert.equal((login.response.body as { token: string }).token, '***');
    assert.equal(list.request.headers.Authorization, '***');
    assert.deepEqual(list.request.params, { page: 1 });
});

test('baseURL option prefixes relative paths for a context without one', async () => {
    const context = await request.newContext();
    try {
        const api = new ApiClient(context, { baseURL: app.url });
        assert.equal((await api.get('/login')).status, 200);
        await api.dispose(); // does not dispose a context it didn't create
        assert.equal((await api.get('/login')).status, 200);
    } finally {
        await context.dispose();
    }
});
