type Encoders = Array<(str: string) => string>;

// Encode param names and values as URIComponent
export const encodeReserved = [encodeURIComponent, encodeURIComponent];
export const allowReserved = [encodeURIComponent, encodeURI];

/**
 * Creates a tag-function to encode template strings with the given encoders.
 */
export function encode(encoders: Encoders, delimiter = ",") {
  const _encode = (value: any, index: number) => {
    const encoder = encoders[index % encoders.length];
    if (typeof value === "undefined") {
      return "";
    }
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        return value.map(encoder).join(delimiter);
      }
      const flat = Object.entries(value).reduce(
        (flat, entry) => [...flat, ...entry],
        [] as any
      );
      return flat.map(encoder).join(delimiter);
    }

    return encoder(String(value));
  };

  return (strings: TemplateStringsArray, ...values: any[]) => {
    return strings.reduce((prev, s, i) => {
      return `${prev}${s}${_encode(values[i], i)}`;
    }, "");
  };
}

/**
 * Separate array values by the given delimiter.
 */
export function delimited(delimiter = ",") {
  return (params: Record<string, any>, encoders = encodeReserved) =>
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => encode(encoders, delimiter)`${name}=${value}`)
      .join("&");
}

/**
 * Deeply remove all properties with undefined values.
 */
export function stripUndefined<T>(obj: T) {
  return obj && JSON.parse(JSON.stringify(obj));
}

export function joinUrl(...parts: Array<string | undefined>) {
  return parts
    .filter(Boolean)
    .map((s, i) => (i === 0 ? s : s!.replace(/^\/+/, "")))
    .map((s, i, a) => (i === a.length - 1 ? s : s!.replace(/\/+$/, "")))
    .join("/");
}

