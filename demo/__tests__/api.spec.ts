  
import { ok, handle, okify, optimistic } from "oa-client-generator/lib/index";
import * as api from "../api";
import * as optimisticApi from "../optimisticApi";

api.defaults.baseUrl = `${process.env.SERVER_URL}/v2`;
optimisticApi.defaults.baseUrl = `${process.env.SERVER_URL}/v2`;

(global as any).fetch = require("node-fetch");
(global as any).FormData = require("form-data");

describe("ok", () => {
  it("should get books by id", async () => {
    const book = await ok(api.getBookById(1));
    expect(book).toMatchObject({ id: 1, name: "Harry Potter" });
  });

  it("should throw if status != 200", async () => {
    const promise = ok(
      api.getBookById(1, { headers: { Prefer: "statusCode=404" } })
    );
    expect(promise).rejects.toHaveProperty("status", 404);
  });

  it("should post json", async () => {
    const order = await ok(
      api.placeOrder({
        bookId: 1,
        status: "placed",
        quantity: 1,
      })
    );
    expect(order).toMatchObject({
      quantity: 1,
      status: "placed",
    });
  });

  it("should type response as Book|string", async () => {
    const book = await ok(api.addBook({ name: "Harry Potter", photoUrls: [] }));
    //@ts-expect-error
    expect(book.name).toBe("Harry Potter");
  });
});

describe("handle", () => {
  it("should call the matching handler", async () => {
    const res = await handle(api.updateBook({ name: "Leon", photoUrls: [] }), {
      204() {
        return "204 called";
      },
    });
    expect(res).toBe("204 called");
  });

  it("should call the default handler", async () => {
    const res = await handle(
      api.updateBook({} as any), // provoke 404 error
      {
        default(status, data) {
          return "default called";
        },
      }
    );
    expect(res).toBe("default called");
  });

  it("should throw if status is unhandled", async () => {
    const promise = handle(api.updateBook({ name: "Leon", photoUrls: [] }), {});
    await expect(promise).rejects.toHaveProperty("status", 204);
  });
});

describe("okify", () => {
  it("should okify a single function", async () => {
    const getBookById = okify(api.getBookById);
    const book = await getBookById(1);
    expect(book).toMatchObject({ id: 1, name: "Harry Potter" });
  });
});

describe("optimistic", () => {
  it("should okify all functions", async () => {
    const optimisticApi = optimistic(api);
    const book = await optimisticApi.getBookById(1);
    expect(book).toMatchObject({ id: 1, name: "Harry Potter" });
  });
});

describe("--optimistic", () => {
  it("should get books by id", async () => {
    const book = await optimisticApi.getBookById(1);
    expect(book).toMatchObject({ id: 1, name: "Harry Potter" });
  });

  it("should throw if status != 200", async () => {
    const promise = optimisticApi.getBookById(1, {
      headers: { Prefer: "statusCode=404" },
    });
    expect(promise).rejects.toHaveProperty("status", 404);
  });

  it("should post json", async () => {
    const order = await optimisticApi.placeOrder({
      bookId: 1,
      status: "placed",
      quantity: 1,
    });

    expect(order).toMatchObject({
      quantity: 1,
      status: "placed",
    });
  });

  it("should type response as Book|string", async () => {
    const book = await optimisticApi.addBook({ name: "Harry Potter", photoUrls: [] });
    if ('name' in book) {
      expect(book.name).toBe("Harry Potter");
    }
  });
});
