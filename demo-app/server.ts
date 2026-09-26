/**
 * Demo application under test.
 *
 * A small web app + JSON API so the example tests have a deterministic target.
 * Point BASE_URL at your real application and delete this folder when you adopt
 * the framework.
 *
 *   Pages:  /            form page
 *           /login       login page (?next=/items returns there after login)
 *           /items       items page, requires a session (redirects to /login)
 *   API:    POST   /api/login        { username, password } -> { token, user }, also sets a session cookie
 *           GET    /api/me           (auth) { username, role }
 *           GET    /api/items        (auth) list items
 *           POST   /api/items        (admin) { name } -> item
 *           GET    /api/items/:id    (auth)
 *           DELETE /api/items/:id    (admin)
 *
 * Roles: admin (demo / demo-password) can do everything; viewer (viewer /
 * viewer-password) can read, and gets 403 on changes.
 * API routes accept either "Authorization: Bearer <token>" or the session cookie.
 * Items are kept in memory, or in MySQL when DB_HOST is set (table `items`).
 *
 * Run standalone: npm run demo  (port: DEMO_APP_PORT, default 4173)
 */
import http, { type IncomingMessage, type ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config, DEMO_USERS, ROLES, type DbConfig, type Role } from '../config';
import { DbClient, type Row } from '../utils/dbClient';

const PUBLIC_DIR = path.join(__dirname, 'public');
const PAGES: Record<string, string> = { '/': 'index.html', '/login': 'login.html', '/items': 'items.html' };
const PROTECTED_PAGES = new Set(['/items']);
const SESSION_COOKIE = 'session';

export interface Item {
    id: number;
    name: string;
    createdAt: string;
}

/** A row of the `items` table as mysql2 returns it (TIMESTAMP columns become Date) */
interface ItemRow extends Row {
    id: number;
    name: string;
    created_at: Date;
}

interface Store {
    list(): Promise<Item[]>;
    create(name: string): Promise<Item>;
    get(id: number): Promise<Item | null>;
    remove(id: number): Promise<boolean>;
    close(): Promise<void>;
}

export interface DemoApp {
    url: string;
    close(): Promise<void>;
}

class HttpError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}

function sessionToken(req: IncomingMessage): string {
    const bearer = (req.headers.authorization || '').match(/^Bearer (.+)$/);
    if (bearer?.[1]) return bearer[1];
    const cookie = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    return cookie ? cookie.slice(SESSION_COOKIE.length + 1) : '';
}

function createMemoryStore(): Store {
    const items = new Map<number, Item>();
    let nextId = 1;
    // Synchronous under the hood; Promise.resolve keeps the same interface as the MySQL store
    return {
        list: () => Promise.resolve([...items.values()]),
        create: (name) => {
            const item = { id: nextId++, name, createdAt: new Date().toISOString() };
            items.set(item.id, item);
            return Promise.resolve(item);
        },
        get: (id) => Promise.resolve(items.get(id) ?? null),
        remove: (id) => Promise.resolve(items.delete(id)),
        close: () => Promise.resolve(),
    };
}

async function createMySqlStore(dbConfig: Readonly<DbConfig>): Promise<Store> {
    const db = new DbClient(dbConfig);
    await db.execute(
        `CREATE TABLE IF NOT EXISTS items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        )`,
    );
    const toItem = (row: ItemRow): Item => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at.toISOString(),
    });
    return {
        async list() {
            return (await db.query<ItemRow>('SELECT * FROM items ORDER BY id')).map(toItem);
        },
        async create(name) {
            const result = await db.execute('INSERT INTO items (name) VALUES (?)', [name]);
            const row = await db.one<ItemRow>('SELECT * FROM items WHERE id = ?', [result.insertId]);
            if (!row) throw new Error(`Item ${result.insertId} was not saved`);
            return toItem(row);
        },
        async get(id) {
            const row = await db.one<ItemRow>('SELECT * FROM items WHERE id = ?', [id]);
            return row ? toItem(row) : null;
        },
        async remove(id) {
            const result = await db.execute('DELETE FROM items WHERE id = ?', [id]);
            return result.affectedRows > 0;
        },
        close: () => db.close(),
    };
}

/** Objects are sent as JSON, strings as HTML */
function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
    const isJson = body !== undefined && typeof body !== 'string';
    res.writeHead(status, {
        'Content-Type': isJson ? 'application/json' : 'text/html; charset=utf-8',
        ...headers,
    });
    res.end(isJson ? JSON.stringify(body) : String(body ?? ''));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk: Buffer) => (raw += chunk.toString('utf8')));
        req.on('end', () => {
            try {
                resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
            } catch {
                reject(new HttpError(400, 'Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}

interface Session {
    username: string;
    role: Role;
}

const FORBIDDEN = { error: { code: 'FORBIDDEN', message: 'Your role cannot do this' } };

function createApp(store: Store) {
    const sessions = new Map<string, Session>();

    return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const { pathname } = url;
        const session = sessions.get(sessionToken(req));

        try {
            const page = PAGES[pathname];
            if (req.method === 'GET' && page) {
                if (PROTECTED_PAGES.has(pathname) && !session) {
                    return send(res, 302, '', { Location: `/login?next=${encodeURIComponent(pathname)}` });
                }
                return send(res, 200, fs.readFileSync(path.join(PUBLIC_DIR, page), 'utf8'));
            }

            if (req.method === 'POST' && pathname === '/api/login') {
                const { username, password } = await readJson(req);
                const role = ROLES.find(
                    (r) => DEMO_USERS[r].username === username && DEMO_USERS[r].password === password,
                );
                if (!role || typeof username !== 'string') {
                    return send(res, 401, {
                        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
                    });
                }
                const token = crypto.randomUUID();
                sessions.set(token, { username, role });
                return send(
                    res,
                    200,
                    { token, user: { username, role } },
                    { 'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/` },
                );
            }

            if (pathname === '/api/me' || pathname.startsWith('/api/items')) {
                if (!session) {
                    return send(res, 401, { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
                }
                if (pathname === '/api/me' && req.method === 'GET') {
                    return send(res, 200, session);
                }

                const id = Number(pathname.match(/^\/api\/items\/(\d+)$/)?.[1] ?? NaN);
                const isChange = req.method === 'POST' || req.method === 'DELETE';
                if (isChange && session.role !== 'admin') {
                    return send(res, 403, FORBIDDEN);
                }
                if (pathname === '/api/items' && req.method === 'GET') {
                    return send(res, 200, { items: await store.list() });
                }
                if (pathname === '/api/items' && req.method === 'POST') {
                    const { name } = await readJson(req);
                    if (typeof name !== 'string' || name.trim() === '') {
                        return send(res, 400, {
                            error: { code: 'VALIDATION_ERROR', field: 'name', message: 'Name is required' },
                        });
                    }
                    return send(res, 201, await store.create(name.trim()));
                }
                if (!Number.isNaN(id) && req.method === 'GET') {
                    const item = await store.get(id);
                    return item ? send(res, 200, item) : send(res, 404, { error: { code: 'NOT_FOUND' } });
                }
                if (!Number.isNaN(id) && req.method === 'DELETE') {
                    const removed = await store.remove(id);
                    return removed ? send(res, 204, '') : send(res, 404, { error: { code: 'NOT_FOUND' } });
                }
            }

            return send(res, 404, { error: { code: 'NOT_FOUND' } });
        } catch (caught) {
            const status = caught instanceof HttpError ? caught.status : 500;
            const message = caught instanceof Error ? caught.message : String(caught);
            return send(res, status, { error: { code: 'SERVER_ERROR', message } });
        }
    };
}

/** Starts the demo app. Port 0 picks a free port (used by the unit tests). */
export async function startDemoApp({
    port = config.demoAppPort,
    host = '127.0.0.1',
}: { port?: number; host?: string } = {}): Promise<DemoApp> {
    const store = config.db ? await createMySqlStore(config.db) : createMemoryStore();
    // One app per server: it holds the login sessions
    const app = createApp(store);
    const server = http.createServer((req, res) => void app(req, res));
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve());
    });
    const address = server.address() as AddressInfo;
    return {
        url: `http://${host}:${address.port}`,
        close: async () => {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await store.close();
        },
    };
}

if (require.main === module) {
    void startDemoApp().then(({ url }) => console.log(`Demo app running at ${url}`));
}
