/**
 * Generates TypeScript types from the OpenAPI contract.
 *
 *   npm run generate:api            write contracts/openapi.d.ts
 *   npm run generate:api -- --check fail if contracts/openapi.d.ts is out of date (CI)
 *
 * The source is contracts/openapi.yaml, or OPENAPI_SPEC (a file path or URL) for
 * your own app's API.
 */
import fs from 'fs';
import path from 'path';
import openapiTS, { astToString } from 'openapi-typescript';
import { ROOT } from '../config';

export const SPEC_PATH = path.join(ROOT, 'contracts', 'openapi.yaml');
export const TYPES_PATH = path.join(ROOT, 'contracts', 'openapi.d.ts');

const HEADER = `/**
 * Generated from the OpenAPI contract by \`npm run generate:api\`. Do not edit by hand:
 * change the contract and regenerate. CI fails if this file is out of date.
 */

`;

export async function generateApiTypes(source: string = process.env.OPENAPI_SPEC || SPEC_PATH): Promise<string> {
    const input = /^https?:\/\//.test(source)
        ? new URL(source)
        : new URL(`file://${path.resolve(source).replace(/\\/g, '/')}`);
    const ast = await openapiTS(input, { alphabetize: true });
    return HEADER + astToString(ast);
}

async function main(): Promise<void> {
    const generated = await generateApiTypes();
    const check = process.argv.includes('--check');
    const current = fs.existsSync(TYPES_PATH) ? fs.readFileSync(TYPES_PATH, 'utf8') : '';
    // Compare ignoring line endings, so Windows checkouts pass too
    const normalize = (text: string) => text.replace(/\r\n/g, '\n');

    if (check) {
        if (normalize(current) !== normalize(generated)) {
            console.error(
                `${path.relative(ROOT, TYPES_PATH)} is out of date with the contract. Run: npm run generate:api`,
            );
            process.exit(1);
        }
        console.log('API types are up to date with the contract');
        return;
    }
    fs.writeFileSync(TYPES_PATH, generated);
    console.log(`Wrote ${path.relative(ROOT, TYPES_PATH)}`);
}

if (require.main === module) {
    main().catch((error: unknown) => {
        console.error(error);
        process.exit(1);
    });
}
