/**
 * Generated from the OpenAPI contract by `npm run generate:api`. Do not edit by hand:
 * change the contract and regenerate. CI fails if this file is out of date.
 */

export interface paths {
    "/api/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List items */
        get: operations["listItems"];
        put?: never;
        /** Create an item (admin only) */
        post: operations["createItem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/items/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: number;
            };
            cookie?: never;
        };
        /** Get one item */
        get: operations["getItem"];
        put?: never;
        post?: never;
        /** Delete an item (admin only) */
        delete: operations["deleteItem"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Log in and start a session */
        post: operations["login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The logged-in user */
        get: operations["getMe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Error: {
            error: {
                /** @enum {string} */
                code: "INVALID_CREDENTIALS" | "INVALID_JSON" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "SERVER_ERROR";
                field?: string;
                message?: string;
            };
        };
        Item: {
            /** Format: date-time */
            createdAt: string;
            id: number;
            name: string;
        };
        ItemCreate: {
            /** @description Leading and trailing spaces are trimmed; the result must be 1-255 characters. */
            name: string;
        };
        ItemList: {
            items: components["schemas"]["Item"][];
        };
        LoginRequest: {
            password: string;
            username: string;
        };
        LoginResponse: {
            token: string;
            user: components["schemas"]["User"];
        };
        /** @enum {string} */
        Role: "admin" | "viewer";
        User: {
            role: components["schemas"]["Role"];
            username: string;
        };
    };
    responses: {
        /** @description The user's role can't do this */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description The body isn't valid JSON */
        InvalidJson: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description No such item */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description No session or token */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listItems: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description All items */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ItemList"];
                };
            };
            401: components["responses"]["Unauthorized"];
        };
    };
    createItem: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ItemCreate"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Item"];
                };
            };
            /** @description Invalid name, or a body that isn't JSON */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    getItem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The item */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Item"];
                };
            };
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
        };
    };
    deleteItem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description Logged in. Also sets the `session` cookie. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResponse"];
                };
            };
            400: components["responses"]["InvalidJson"];
            /** @description Wrong username or password */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getMe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The session's user */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["User"];
                };
            };
            401: components["responses"]["Unauthorized"];
        };
    };
}
