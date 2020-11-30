import generate, { getOperationName } from "../../src/codegen/generate";
import { printAst } from "../../src/codegen";
import SwaggerParser from "@apidevtools/swagger-parser";
import { OpenAPIV3 } from "openapi-types";

describe("getOperationName", () => {
  it("should use the id", () => {
    expect(getOperationName("GET", "/books", "list books")).toEqual("listBooks");
  });
  it("should use the verb and path", () => {
    expect(getOperationName("GET", "/books/{color}/{status}")).toEqual(
      "getBooksByColorAndStatus"
    );
  });
  it("should not use ids with special chars", () => {
    expect(
      getOperationName("GET", "/books", "API\\PetController::listPetAction")
    ).toEqual("getBooks");
  });
});

describe("generate", () => {
  let artefact: string;
  let spec: OpenAPIV3.Document;

  beforeAll(async () => {
    spec = (await SwaggerParser.bundle(
      __dirname + "/../../demo/book-store.json"
    )) as any;
  });

  it("should generate an api", async () => {
    artefact = printAst(generate(spec));
    expect(artefact).toMatchSnapshot();
  });

  /* https://github.com/cotype/build-client/issues/5 */
  it("should generate same api a second time", async () => {
    expect(printAst(generate(spec))).toBe(artefact);
  });
});
