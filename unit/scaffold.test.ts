import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    pageNames,
    specName,
    pageObjectSource,
    apiSpecSource,
    registerFixture,
    addAccessibilityCheck,
    parseArgs,
    scaffold,
} from '../utils/scaffold';

const root = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

test('page names accept PascalCase, kebab-case and an optional "Page" suffix', () => {
    const expected = {
        className: 'UserProfilePage',
        fixture: 'userProfilePage',
        kebab: 'user-profile',
        words: 'user profile page',
    };
    assert.deepEqual(pageNames('UserProfile'), expected);
    assert.deepEqual(pageNames('user-profile'), expected);
    assert.deepEqual(pageNames('UserProfilePage'), expected);
    assert.deepEqual(pageNames('user_profile page'), expected);
    assert.equal(specName('CheckoutFlow'), 'checkout-flow');
});

test('invalid names and paths are rejected with a reason', () => {
    assert.throws(() => pageNames('9lives'), /not a valid name/);
    assert.throws(() => pageNames('bad!name'), /not a valid name/);
    assert.throws(() => pageObjectSource(pageNames('Settings'), 'settings'), /must start with "\/"/);
    assert.throws(() => apiSpecSource('orders', 'C:/Program Files/Git/api'), /Git Bash rewrites/);
});

// Guards the scaffold against refactors of the files it edits
test('registers a fixture in the real tests/fixtures.ts', () => {
    const out = registerFixture(read('tests/fixtures.ts'), pageNames('Settings'));
    assert.match(out, /import \{ SettingsPage \} from '\.\.\/pages\/SettingsPage';\n/);
    assert.match(out, /^ {4}settingsPage: SettingsPage;$/m);
    assert.match(out, /settingsPage: async \(\{ page \}, use\) => \{\n {8}await use\(new SettingsPage\(page\)\);/);
    assert.throws(() => registerFixture(out, pageNames('Settings')), /already has a settingsPage fixture/);
});

test('adds an accessibility check to the real accessibility spec, inside the logged-in block', () => {
    const out = addAccessibilityCheck(read('tests/ui/accessibility.spec.ts'), pageNames('Settings'));
    const check = out.indexOf("test('settings page', async ({ settingsPage, checkAccessibility })");
    assert.ok(check > 0 && check < out.indexOf("test.describe('logged out'"));
});

test('parses a name, flags with values and bare flags', () => {
    assert.deepEqual(parseArgs(['orders', '--api', '--path', '/api/orders']), {
        name: 'orders',
        options: { api: true, path: '/api/orders' },
    });
});

test('new:page writes every file, and refuses to overwrite or half-finish', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-'));
    try {
        for (const file of ['tests/fixtures.ts', 'tests/ui/accessibility.spec.ts']) {
            fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
            fs.copyFileSync(path.join(root, file), path.join(dir, file));
        }
        assert.deepEqual(scaffold(dir, 'page', ['Settings', '--path', '/settings']), [
            'pages/SettingsPage.ts',
            'tests/ui/settings.spec.ts',
            'tests/fixtures.ts',
            'tests/ui/accessibility.spec.ts',
        ]);
        assert.match(fs.readFileSync(path.join(dir, 'pages/SettingsPage.ts'), 'utf8'), /path = '\/settings'/);
        assert.throws(() => scaffold(dir, 'page', ['Settings']), /already exists/);

        assert.deepEqual(scaffold(dir, 'spec', ['preferences', '--page', 'settings']), [
            'tests/ui/preferences.spec.ts',
        ]);
        assert.match(
            fs.readFileSync(path.join(dir, 'tests/ui/preferences.spec.ts'), 'utf8'),
            /test\.describe\('Preferences'[\s\S]*await settingsPage\.open\(\)/,
        );
        assert.deepEqual(scaffold(dir, 'spec', ['orders', '--api']), ['tests/api/orders.spec.ts']);
        assert.match(fs.readFileSync(path.join(dir, 'tests/api/orders.spec.ts'), 'utf8'), /get\('\/api\/orders'\)/);

        assert.throws(() => scaffold(dir, 'spec', ['x']), /need a page object/);
        assert.throws(() => scaffold(dir, 'spec', ['x', '--page', 'missing']), /MissingPage\.ts not found/);
        assert.throws(() => scaffold(dir, 'spec', ['x', '--page']), /--page needs a value/);
        assert.throws(() => scaffold(dir, 'nope', []), /Usage/);

        // A file it can't edit stops it before anything is written
        fs.writeFileSync(path.join(dir, 'tests/ui/accessibility.spec.ts'), '// no anchor\n');
        assert.throws(() => scaffold(dir, 'page', ['Reports']), /accessibility check/);
        assert.equal(fs.existsSync(path.join(dir, 'pages/ReportsPage.ts')), false);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
