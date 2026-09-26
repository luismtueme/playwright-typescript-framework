/**
 * Saved login sessions, one per role. tests/auth.setup.ts writes them once per run;
 * browser tests load the one for their role (see the `role` fixture).
 * The files hold live session cookies, so .auth/ is git-ignored.
 */
import path from 'path';
import { ROOT, type Role } from '../config';

/** Path of the saved session (cookies + local storage) for a role */
export function authFile(role: Role): string {
    return path.join(ROOT, '.auth', `${role}.json`);
}
