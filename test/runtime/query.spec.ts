import { deep, explode, form, pipe, query, space } from "../../src/runtime/query";

describe("delimited", () => {
  it("should use commas", () => {
    expect(form({ id: [3, 4, 5] })).toEqual("id=3,4,5");
  });
  it("should use pipes", () => {
    expect(pipe({ id: [3, 4, 5] })).toEqual("id=3|4|5");
  });
  it("should use spaces", () => {
    expect(space({ id: [3, 4, 5] })).toEqual("id=3%204%205");
  });
  it("should enumerate entries", () => {
    expect(form({ author: { firstName: "Bethel", role: "admin" } })).toEqual(
      "author=firstName,Bethel,role,admin"
    );
  });
  it("should omit undefined values", () => {
    expect(form({ id: 23, foo: undefined })).toEqual("id=23");
  });
  it("should keep zeros", () => {
    expect(form({ id: 0 })).toEqual("id=0");
  });
});

describe("explode", () => {
  it("should explode arrays", () => {
    expect(explode({ id: [3, 4, 5] })).toEqual("id=3&id=4&id=5");
  });
  it("should explode objects", () => {
    expect(
      explode({ author: { firstName: "Antone", role: "admin" } })
    ).toEqual("firstName=Antone&role=admin");
  });
  it("should omit undefined values", () => {
    expect(explode({ id: 23, foo: undefined })).toEqual("id=23");
  });
});

describe("deep", () => {
  it("should serialize objects", () => {
    expect(deep({ author: { firstName: "Rocky", role: "admin" } })).toEqual(
      "author[firstName]=Rocky&author[role]=admin"
    );
  });
  it("should serialize nested objects", () => {
    expect(
      deep({ author: { name: { first: "Vernon", last: "Roberts" } } })
    ).toEqual("author[name][first]=Vernon&author[name][last]=Roberts");
  });
  it("should omit undefined values", () => {
    expect(deep({ author: { name: "Lynch", role: undefined } })).toEqual(
      "author[name]=Lynch"
    );
  });
  it("should serialize nested arrays", () => {
    expect(deep({ names: ["John", "Doe"] })).toEqual(
      "names[]=John&names[]=Doe"
    );
  });
  it("should serialize nested arrays with custom encoders", () => {
    expect(deep({ names: ["John", "Doe"] }, [encodeURIComponent, encodeURIComponent])).toEqual(
      "names[]=John&names[]=Doe"
    );
  });
});

describe("query", () => {
  it("should return an empty string", () => {
    expect(query()).toEqual("");
  });
  it("should add a leading \"?\"", () => {
    expect(query("foo=bar")).toEqual("?foo=bar");
  });
  it("should join multiple params", () => {
    expect(query("foo=bar", "boo=baz")).toEqual("?foo=bar&boo=baz");
  });
});