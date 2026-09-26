/**
 * MySQL client for database assertions, backed by a connection pool.
 *
 * Connection settings come from config.db (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD,
 * DB_NAME). Always use parameterized queries: pass values in `params`, never
 * interpolate them into the SQL string.
 *
 * @example
 * const db = new DbClient(config.db);
 * const item = await db.one<Item>('SELECT * FROM items WHERE id = ?', [id]);
 * await db.close();
 */
import mysql from 'mysql2/promise';
import type { DbConfig } from '../config';
import { createLogger } from './logger';

const log = createLogger('db');

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows are whatever the query selects
export type Row = Record<string, any>;
export type Param = string | number | boolean | Date | null;
/** insertId, affectedRows, ... */
export type WriteResult = mysql.ResultSetHeader;

export class DbClient {
    private readonly pool: mysql.Pool;

    constructor(dbConfig: Readonly<DbConfig> | null | undefined) {
        if (!dbConfig) {
            throw new Error('Database is not configured. Set DB_HOST, DB_USER, DB_PASSWORD and DB_NAME.');
        }
        this.pool = mysql.createPool({ ...dbConfig, connectionLimit: 5, waitForConnections: true });
    }

    /** Runs a SELECT and returns all rows. */
    async query<T extends Row = Row>(sql: string, params: Param[] = []): Promise<T[]> {
        log.debug(`${sql} ${JSON.stringify(params)}`);
        const [rows] = await this.pool.execute(sql, params);
        return rows as T[];
    }

    /** Runs INSERT, UPDATE, DELETE or DDL and returns the result header. */
    async execute(sql: string, params: Param[] = []): Promise<WriteResult> {
        log.debug(`${sql} ${JSON.stringify(params)}`);
        const [result] = await this.pool.execute(sql, params);
        return result as WriteResult;
    }

    /** Returns the first row, or null when there is none. */
    async one<T extends Row = Row>(sql: string, params: Param[] = []): Promise<T | null> {
        const rows = await this.query<T>(sql, params);
        return rows[0] ?? null;
    }

    /**
     * Returns the number of rows in `table` matching an optional WHERE clause.
     * @param where SQL condition with ? placeholders
     */
    async count(table: string, where = '1 = 1', params: Param[] = []): Promise<number> {
        if (!/^[A-Za-z0-9_]+$/.test(table)) {
            throw new Error(`Invalid table name: ${table}`);
        }
        const row = await this.one<{ total: number | string }>(
            `SELECT COUNT(*) AS total FROM \`${table}\` WHERE ${where}`,
            params,
        );
        return Number(row?.total ?? 0);
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}
