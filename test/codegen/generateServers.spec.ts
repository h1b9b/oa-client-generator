  
import generateServers from "../../src/codegen/generateServers";
import * as cg from "../../src/codegen/codegen";

describe("generateServer", () => {
  it("creates an object with servers", () => {
    const servers = generateServers([{ url: "http://example.org" }]);

    expect(cg.printNode(servers)).toMatchSnapshot();
  });

  it("uses the description as name", () => {
    const servers = generateServers([
      { url: "http://example.org", description: "Super API" },
      { url: "http://example.org/2" },
    ]);

    expect(cg.printNode(servers)).toMatchSnapshot();
  });

  it("supports variables", () => {
    const servers = generateServers([
      {
        variables: {
          tld: {
            enum: ["org", "com"],
            default: "org",
          },
          path: {
            default: "",
          },
        },
        url: "http://example.{tld}/{path}",
      },
    ]);

    expect(cg.printNode(servers)).toMatchSnapshot();
  });
});
