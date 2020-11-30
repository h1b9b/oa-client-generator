import * as OaClientGen from "oa-client-generator/lib/runtime";
import * as Query from "oa-client-generator/lib/runtime/query";
export const defaults: OaClientGen.RequestOpts = {
    baseUrl: "/",
};
const oaclientgen = OaClientGen.runtime(defaults);
export const servers = {};
export type Category = {
    id?: number;
    name?: string;
};
export type Tag = {
    id?: number;
    name?: string;
};
export type Book = {
    id?: number;
    category?: Category;
    name: string;
    photoUrls: string[];
    tags?: Tag[];
    status?: "available" | "pending" | "sold";
    animal?: true;
};
export type ApiResponse = {
    code?: number;
    "type"?: string;
    message?: string;
};
export type Order = {
    id?: number;
    bookId?: number;
    quantity?: number;
    shipDate?: string;
    status?: "placed" | "approved" | "delivered";
    complete?: boolean;
};
export type User = {
    id?: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    phone?: string;
    userStatus?: number;
};
export type Schema = string;
export type Schema2 = number;
/**
 * Update an existing book
 */
export function updateBook(book: Book, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchJson<{
        status: 204;
        data: string;
    } | {
        status: 404;
        data: string;
    } | {
        status: number;
        data: {
            errors?: string[];
        };
    }>("/book", oaclientgen.json({
        ...opts,
        method: "PUT",
        body: book
    }));
}
/**
 * Add a new book to the store
 */
export function addBook(book: Book, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchJson<{
        status: 200;
        data: Book;
    } | {
        status: 201;
        data: {
            id?: string;
        };
    }>("/book", oaclientgen.json({
        ...opts,
        method: "POST",
        body: book
    }));
}
/**
 * Finds Books by status
 */
export function findBooksByStatus(status: ("available" | "pending" | "sold")[], opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchJson<{
        status: 200;
        data: Book[];
    } | {
        status: 400;
        data: string;
    }>(`/book/findByStatus${Query.query(Query.explode({
        status
    }))}`, {
        ...opts
    });
}
/**
 * Finds Books by tags
 */
export function findBooksByTags(tags: string[], opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchJson<{
        status: 200;
        data: Book[];
    } | {
        status: 400;
        data: string;
    }>(`/book/findByTags${Query.query(Query.explode({
        tags
    }))}`, {
        ...opts
    });
}
/**
 * Find book by ID
 */
export function getBookById(bookId: number, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchJson<{
        status: 200;
        data: Book;
    } | {
        status: 400;
        data: string;
    } | {
        status: 404;
    }>(`/book/${bookId}`, {
        ...opts
    });
}
/**
 * Updates a book in the store with form data
 */
export function updateBookWithForm(bookId: number, body?: {
    name?: string;
    status?: string;
}, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchText(`/book/${bookId}`, oaclientgen.form({
        ...opts,
        method: "POST",
        body
    }));
}
/**
 * Deletes a book
 */
export function deleteBook(bookId: number, { apiKey }: {
    apiKey?: string;
} = {}, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchText(`/book/${bookId}`, {
        ...opts,
        method: "DELETE",
        headers: {
            ...opts && opts.headers,
            api_key: apiKey
        }
    });
}
/**
 * uploads an image
 */
export function uploadFile(bookId: number, body?: {
    additionalMetadata?: string;
    file?: Blob;
}, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchJson<{
        status: 200;
        data: ApiResponse;
    }>(`/book/${bookId}/uploadImage`, oaclientgen.multipart({
        ...opts,
        method: "POST",
        body
    }));
}
/**
 * Returns book inventories by status
 */
export function getInventory(opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchJson<{
        status: 200;
        data: {
            [key: string]: number;
        };
    }>("/store/inventory", {
        ...opts
    });
}
/**
 * Place an order for a book
 */
export function placeOrder(order: Order, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchJson<{
        status: 200;
        data: Order;
    } | {
        status: 400;
        data: string;
    }>("/store/order", oaclientgen.json({
        ...opts,
        method: "POST",
        body: order
    }));
}
/**
 * Find purchase order by ID
 */
export function getOrderById(orderId: number, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchJson<{
        status: 200;
        data: Order;
    } | {
        status: 400;
        data: string;
    } | {
        status: 404;
        data: string;
    }>(`/store/order/${orderId}`, {
        ...opts
    });
}
/**
 * Delete purchase order by ID
 */
export function deleteOrder(orderId: number, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchText(`/store/order/${orderId}`, {
        ...opts,
        method: "DELETE"
    });
}
/**
 * Create user
 */
export function createUser(user: User, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchText("/user", oaclientgen.json({
        ...opts,
        method: "POST",
        body: user
    }));
}
/**
 * Creates list of users with given input array
 */
export function createUsersWithArrayInput(body: User[], opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchText("/user/createWithArray", oaclientgen.json({
        ...opts,
        method: "POST",
        body
    }));
}
/**
 * Creates list of users with given input array
 */
export function createUsersWithListInput(body: User[], opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchText("/user/createWithList", oaclientgen.json({
        ...opts,
        method: "POST",
        body
    }));
}
/**
 * Logs user into the system
 */
export function loginUser(username: string, password: string, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchJson<{
        status: 200;
        data: string;
    } | {
        status: 400;
        data: string;
    }>(`/user/login${Query.query(Query.form({
        username,
        password
    }))}`, {
        ...opts
    });
}
/**
 * Logs out current logged in user session
 */
export function logoutUser(opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchText("/user/logout", {
        ...opts
    });
}
/**
 * Get user by user name
 */
export function getUserByName(username: string, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchJson<{
        status: 200;
        data: User;
    } | {
        status: 400;
        data: string;
    } | {
        status: 404;
        data: string;
    }>(`/user/${username}`, {
        ...opts
    });
}
/**
 * Updated user
 */
export function updateUser(username: string, user: User, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchText(`/user/${username}`, oaclientgen.json({
        ...opts,
        method: "PUT",
        body: user
    }));
}
/**
 * Delete user
 */
export function deleteUser(username: string, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchText(`/user/${username}`, {
        ...opts,
        method: "DELETE"
    });
}
export function customizeBook({ furColor, color, xColorOptions }: {
    furColor?: string;
    color?: string;
    xColorOptions?: string;
} = {}, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchText(`/book/customize${Query.query(Query.form({
        "fur.color": furColor,
        color
    }))}`, {
        ...opts,
        method: "POST",
        headers: {
            ...opts && opts.headers,
            "x-color-options": xColorOptions
        }
    });
}
export function getIssue31ByFoo(foo: string, { bar, baz, boo }: {
    bar?: Schema;
    baz?: number;
    boo?: Schema2;
} = {}, opts?: OaClientGen.RequestOpts) {
    return oaclientgen.fetchText(`/issue31/${foo}${Query.query(Query.form({
        bar,
        baz,
        boo
    }))}`, {
        ...opts
    });
}
