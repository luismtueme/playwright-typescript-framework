/**
 * Minimal leveled logger. Set LOG_LEVEL to error, warn, info or debug.
 * Framework internals log at debug so test output stays readable by default.
 */
import { config } from '../config';

export type Level = 'error' | 'warn' | 'info' | 'debug';
export type LogFn = (message: string, ...details: unknown[]) => void;
export type Logger = Record<Level, LogFn>;

export const LEVELS: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };

const isLevel = (value: string): value is Level => value in LEVELS;

/**
 * @param scope Shown in every line, e.g. "[INFO] [api] ..."
 * @param level Defaults to LOG_LEVEL
 */
export function createLogger(scope: string, level: string = config.logLevel): Logger {
    const threshold = isLevel(level) ? LEVELS[level] : LEVELS.warn;
    const write =
        (name: Level, method: 'error' | 'warn' | 'log'): LogFn =>
        (message, ...details) => {
            if (LEVELS[name] <= threshold) {
                console[method](`[${name.toUpperCase()}] [${scope}] ${message}`, ...details);
            }
        };
    return {
        error: write('error', 'error'),
        warn: write('warn', 'warn'),
        info: write('info', 'log'),
        debug: write('debug', 'log'),
    };
}
