
import { delimited, joinUrl, stripUndefined } from "../../src/runtime/utils";

describe("Runtime - Utils", () => {
  it("should join urls", () => {
    expect(joinUrl("http://example.com/", "/foo")).toEqual("http://example.com/foo");
    expect(joinUrl("http://example.com", "foo")).toEqual("http://example.com/foo");
    expect(joinUrl("http://example.com", "/foo")).toEqual("http://example.com/foo");
    expect(joinUrl("//example.com/", "/foo")).toEqual("//example.com/foo");
    expect(joinUrl(undefined, "/foo")).toEqual("/foo");
    expect(joinUrl("/", "/foo")).toEqual("/foo");
    expect(joinUrl("", "/foo/")).toEqual("/foo/");
  });

  it('should strip undefined from object', () => {
    expect(stripUndefined({ a: undefined, b: 0 })).toEqual({ b: 0 });
    expect(stripUndefined(undefined)).toBe(undefined);
  });

  it('should separate array values by delimiter', () => {
    expect(delimited()({ a: 0, b: 's', c: false, d: ['a','b'], e: {f:0, h:1},i:undefined})).toBe('a=0&b=s&c=false&d=a,b&e=f,0,h,1');
    expect(delimited(';')({ a: 0, b: 's', c: false, d: ['a','b'], e: {f:0, h:1}})).toBe('a=0&b=s&c=false&d=a;b&e=f;0;h;1');
    expect(delimited(';')({ a: 0, b: 's', c: false, d: ['a','b'], e: {f:0, h:1}}, [encodeURIComponent])).toBe('a=0&b=s&c=false&d=a;b&e=f;0;h;1');
  });
});
