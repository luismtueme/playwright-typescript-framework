/**
 * Runs only @quarantine tests. CI runs this without blocking merges, so flaky
 * tests keep reporting (in Allure and the run log) while they're being fixed.
 *
 * Quarantine a flaky test with a ticket; `npm run lint:tests` enforces the ticket:
 *   test('...', { tag: '@quarantine', annotation: { type: 'issue', description: 'ABC-123' } }, ...)
 *
 * Usage: npm run test:quarantine
 */
import { spawnSync } from 'child_process';

const result = spawnSync('npx playwright test --pass-with-no-tests', {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, QUARANTINE: 'true' },
});
process.exit(result.status ?? 1);
