/**
 * Validates API responses against the OpenAPI contract (contracts/openapi.yaml, or
 * OPENAPI_SPEC for your own app).
 *
 * A response violates the contract when its operation isn't documented, its status
 * isn't documented for that operation, or its body doesn't match the documented
 * schema (including undocumented fields, since the schemas forbid extra properties).
 *
 * The fixtures run this on every API response in every test, from API clients and
 * from the browser page (see tests/fixtures.ts).
 */
import fs from 'fs';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

export interface ContractResponse {
    method: string;
    /** Path with or without query string, e.g. /api/items/7?x=1 */
    path: string;
    status: number;
    body: unknown;
    /** The body couldn't be read (e.g. the page navigated away first): check the status only */
    bodyUnavailable?: boolean;
}

interface Operation {
    responses?: Record<string, ResponseObject | { $ref: string }>;
}
interface ResponseObject {
    description?: string;
    content?: Record<string, { schema?: unknown }>;
}
interface Spec {
    /** Path item: methods map to operations; other keys (parameters, summary) are ignored */
    paths?: Record<string, Record<string, unknown>>;
    components?: { responses?: Record<string, ResponseObject> };
}

const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'];
const escapePointer = (segment: string) => segment.replace(/~/g, '~0').replace(/\//g, '~1');

export class Contract {
    private readonly spec: Spec;
    private readonly ajv: Ajv2020;
    private readonly validators = new Map<string, ValidateFunction>();
    private readonly routes: Array<{ template: string; pattern: RegExp }>;

    constructor(specPath: string) {
        this.spec = parse(fs.readFileSync(specPath, 'utf8')) as Spec;
        // strict: false because the document is OpenAPI, not a pure JSON Schema
        this.ajv = new Ajv2020({ strict: false, allErrors: true });
        addFormats(this.ajv);
        this.ajv.addSchema(this.spec, 'openapi');
        this.routes = Object.keys(this.spec.paths ?? {}).map((template) => ({
            template,
            pattern: new RegExp(
                `^${template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{[^}]+\\?\}/g, '[^/]+')}$`,
            ),
        }));
    }

    /** The documented path template for a concrete path, e.g. /api/items/7 -> /api/items/{id} */
    templateFor(path: string): string | undefined {
        const pathname = path.split('?')[0] ?? path;
        return this.routes.find((route) => route.pattern.test(pathname))?.template;
    }

    /** Problems with a response; empty when it matches the contract. */
    check({ method, path, status, body, bodyUnavailable = false }: ContractResponse): string[] {
        const verb = method.toLowerCase();
        const template = this.templateFor(path);
        const operation = template ? (this.spec.paths?.[template]?.[verb] as Operation | undefined) : undefined;
        if (!template || !operation || !METHODS.includes(verb)) {
            return [`${method} ${path} is not in the contract`];
        }

        const label = `${method.toUpperCase()} ${template} -> ${status}`;
        const statusKey = String(status) in (operation.responses ?? {}) ? String(status) : `${String(status)[0]}XX`;
        const documented = operation.responses?.[statusKey];
        if (!documented) {
            const known = Object.keys(operation.responses ?? {}).join(', ');
            return [`${label}: status ${status} is not documented (documented: ${known})`];
        }

        if (bodyUnavailable) return [];
        const response = this.resolveResponse(documented);
        const hasJson = Boolean(response.content?.['application/json']?.schema);
        if (!hasJson) {
            const empty = body === null || body === undefined || body === '';
            return empty ? [] : [`${label}: documented without a body, but got ${JSON.stringify(body).slice(0, 200)}`];
        }

        const validate = this.validatorFor(template, verb, statusKey, documented);
        if (validate(body)) return [];
        return (validate.errors ?? []).map(
            (error) =>
                `${label}: body${error.instancePath || ''} ${error.message ?? 'is invalid'}${error.params && 'additionalProperty' in error.params ? ` (${String(error.params.additionalProperty)})` : ''}`,
        );
    }

    private resolveResponse(response: ResponseObject | { $ref: string }): ResponseObject {
        if ('$ref' in response) {
            const name = response.$ref.replace('#/components/responses/', '');
            const resolved = this.spec.components?.responses?.[name];
            if (!resolved) throw new Error(`Contract references a missing response: ${response.$ref}`);
            return resolved;
        }
        return response;
    }

    private validatorFor(
        template: string,
        verb: string,
        status: string,
        documented: ResponseObject | { $ref: string },
    ) {
        const pointer =
            '$ref' in documented
                ? `${documented.$ref}/content/application~1json/schema`
                : `#/paths/${escapePointer(template)}/${verb}/responses/${status}/content/application~1json/schema`;
        let validate = this.validators.get(pointer);
        if (!validate) {
            validate = this.ajv.compile({ $ref: `openapi${pointer}` });
            this.validators.set(pointer, validate);
        }
        return validate;
    }
}

/** Thrown when a response breaks the contract; the message lists every problem. */
export class ContractViolation extends Error {
    constructor(problems: string[]) {
        super(`API response does not match the contract:\n  - ${problems.join('\n  - ')}`);
        this.name = 'ContractViolation';
    }
}
