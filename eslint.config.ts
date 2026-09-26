import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
    {
        ignores: [
            'node_modules/',
            'allure-results/',
            'allure-report/',
            'html-report/',
            'test-results/',
            '_site/',
            // Plain browser scripts served by the demo app
            'demo-app/public/',
        ],
    },
    js.configs.recommended,
    // Type-aware rules: they see the real types, e.g. a Promise that nobody awaited
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: { projectService: true, tsconfigRootDir: __dirname },
        },
        rules: {
            // A missing `await` on a Playwright call is the classic cause of flaky tests
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
            eqeqeq: ['error', 'always'],
            'prefer-const': 'error',
        },
    },
    {
        // node:test's test() and describe() return promises the runner tracks itself
        files: ['unit/**/*.ts'],
        rules: {
            '@typescript-eslint/no-floating-promises': [
                'error',
                { allowForKnownSafeCalls: [{ from: 'package', package: 'node:test', name: ['test', 'describe'] }] },
            ],
        },
    },
    {
        // Playwright best-practice rules for specs (no hard waits, no focused tests, awaited expects)
        ...playwright.configs['flat/recommended'],
        files: ['tests/**/*.ts'],
        // auth.setup.ts names its test function `setup`
        settings: { playwright: { globalAliases: { test: ['setup'] } } },
        rules: {
            ...playwright.configs['flat/recommended'].rules,
            'playwright/no-wait-for-timeout': 'error',
            // Skipping is fine with a condition and reason (e.g. no database); a bare skip is not
            'playwright/no-skipped-test': ['error', { allowConditional: true }],
            // Fixtures that assert internally count as assertions
            'playwright/expect-expect': ['error', { assertFunctionNames: ['checkAccessibility'] }],
        },
    },
    {
        // Page objects also use Playwright's page API
        files: ['pages/**/*.ts'],
        plugins: { playwright },
        rules: {
            'playwright/missing-playwright-await': 'error',
            'playwright/no-wait-for-timeout': 'error',
            'playwright/no-force-option': 'warn',
            'playwright/no-networkidle': 'error',
        },
    },
    prettier,
);
