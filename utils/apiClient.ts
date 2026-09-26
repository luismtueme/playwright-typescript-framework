/**
 * HTTP client for API tests, built on Playwright's APIRequestContext.
 *
 * Pass a request context (the fixtures do), or let `ApiClient.create()` make one
 * (the unit tests do). Responses are returned as plain
 * objects so assertions stay simple: `expect(res.status).toBe(201)`.
 *
 * @example
 * const api = await ApiClient.create({ baseURL: config.apiBaseUrl });
 * await api.login(username, password);
 * const res = await api.post<Item>('/api/items', { name: 'Pipe inspection' });
 * await api.dispose();
 */
import { request, type APIRequestContext } from '@playwright/test';
import { createLogger } from './logger';

const log = createLogger('api');

const SENSITIVE_KEYS = /pass(word)?|secret|token|authorization|api[-_]?key/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- response bodies are unvalidated JSON
export interface ApiResponse<T = any> {
    status: number;
    headers: Record<string, string>;
    body: T;
}

export interface RequestOptions {
    data?: unknown;
    params?: Record<string, string | number | boolean>;
    headers?: Record<string, string>;
}

export interface Exchange {
    request: { method: string; path: string; params?: unknown; headers: Record<string, string>; body?: unknown };
    response: ApiResponse;
}

export interface ClientOptions {
    /** Checks every response before anything else sees it; throw to fail the call (e.g. a contract check) */
    validate?: ((response: { method: string; path: string; status: number; body: unknown }) => void) | undefined;
    /** Prefixes relative paths when it differs from the context's own baseURL */
    baseURL?: string | undefined;
    /** Receives every request/response pair (already redacted), e.g. to attach it to a report */
    onExchange?: ((exchange: Exchange) => void | Promise<void>) | undefined;
}

/** Masks sensitive fields so credentials never reach logs or reports. */
export function redact<T>(value: T): T {
    if (Array.isArray(value)) return value.map(redact) as T;
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, v]) => [key, SENSITIVE_KEYS.test(key) ? '***' : redact(v)]),
        ) as T;
    }
    return value;
}

export class ApiClient {
    readonly context: APIRequestContext;
    readonly baseURL: string | undefined;
    private readonly onExchange: ClientOptions['onExchange'];
    private readonly validate: ClientOptions['validate'];
    token: string | null = null;
    /** True when this client created the context and must dispose it */
    private ownsContext = false;

    constructor(context: APIRequestContext, { baseURL, onExchange, validate }: ClientOptions = {}) {
        this.context = context;
        this.baseURL = baseURL;
        this.onExchange = onExchange;
        this.validate = validate;
    }

    static async create({ baseURL, ...options }: ClientOptions & { baseURL: string }): Promise<ApiClient> {
        const context = await request.newContext({ baseURL });
        const client = new ApiClient(context, options);
        client.ownsContext = true;
        return client;
    }

    /** Logs in via POST /api/login and uses the returned token for later requests. */
    async login(username: string, password: string): Promise<ApiResponse<{ token: string }>> {
        const response = await this.post<{ token: string }>('/api/login', { username, password });
        if (response.status !== 200) {
            throw new Error(`Login failed with HTTP ${response.status}: ${JSON.stringify(response.body)}`);
        }
        this.token = response.body.token;
        return response;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers choose the body type
    get<T = any>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
        return this.send<T>('GET', path, options);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers choose the body type
    post<T = any>(path: string, data?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
        return this.send<T>('POST', path, { ...options, data });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers choose the body type
    put<T = any>(path: string, data?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
        return this.send<T>('PUT', path, { ...options, data });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers choose the body type
    delete<T = any>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
        return this.send<T>('DELETE', path, options);
    }

    async send<T>(
        method: string,
        path: string,
        { data, params, headers = {} }: RequestOptions = {},
    ): Promise<ApiResponse<T>> {
        const allHeaders: Record<string, string> = { ...headers };
        if (this.token) allHeaders.Authorization = `Bearer ${this.token}`;

        const url = this.baseURL && path.startsWith('/') ? `${this.baseURL}${path}` : path;
        const response = await this.context.fetch(url, { method, data, params, headers: allHeaders });
        const text = await response.text();
        let body: unknown = text;
        try {
            body = text ? JSON.parse(text) : null;
        } catch {
            // Non-JSON responses are returned as text
        }

        const result: ApiResponse<T> = { status: response.status(), headers: response.headers(), body: body as T };
        log.debug(`${method} ${path} -> ${result.status}`);
        this.validate?.({ method, path, status: result.status, body: result.body });
        if (this.onExchange) {
            await this.onExchange(
                redact({ request: { method, path, params, headers: allHeaders, body: data }, response: result }),
            );
        }
        return result;
    }

    async dispose(): Promise<void> {
        if (this.ownsContext) await this.context.dispose();
    }
}
