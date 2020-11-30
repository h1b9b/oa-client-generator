import _ from "lodash";
import path from "path";
import ts from "typescript";
import { OpenAPIV3 } from "openapi-types";
import * as codegen from "./codegen";
import { Opts } from ".";
import generateServers, { defaultBaseUrl } from "./generateServers";

const verbs = [
  "GET",
  "PUT",
  "POST",
  "DELETE",
  "OPTIONS",
  "HEAD",
  "PATCH",
  "TRACE",
];

const contentTypes = {
  "*/*": "json",
  "application/json": "json",
  "application/x-www-form-urlencoded": "form",
  "multipart/form-data": "multipart",
};

/**
 * Get the name of a formatter function for a given parameter.
 */
function getFormatter({ style, explode }: OpenAPIV3.ParameterObject) {
  if (style === "spaceDelimited") return "space";
  if (style === "pipeDelimited") return "pipe";
  if (style === "deepObject") return "deep";
  return explode ? "explode" : "form";
}


function getOperationIdentifier(id?: string) {
  if (!id) return;
  if (id.match(/[^\w\s]/)) return;
  id = _.camelCase(id);
  if (codegen.isValidIdentifier(id)) return id;
}

/**
 * Create a method name for a given operation, either from its operationId or
 * the HTTP verb and path.
 */
export function getOperationName(
  verb: string,
  path: string,
  operationId?: string
) {
  const id = getOperationIdentifier(operationId);
  if (id) return id;
  path = path.replace(/\{(.+?)\}/, "by $1").replace(/\{(.+?)\}/, "and $1");
  return _.camelCase(`${verb} ${path}`);
}

function isNullable(schema: any) {
  return !!(schema && schema.nullable);
}

function isReference(obj: any): obj is OpenAPIV3.ReferenceObject {
  return obj && "$ref" in obj;
}

//See https://swagger.io/docs/specification/using-ref/
function getReference(spec: any, ref: string) {
  const path = ref
    .slice(2)
    .split("/")
    .map((s) => unescape(s.replace(/~1/g, "/").replace(/~0/g, "~")));

  const ret = _.get(spec, path);
  if (typeof ret === "undefined") {
    throw new Error(`Can't find ${path}`);
  }
  return ret;
}
/**
 * If the given object is a ReferenceObject, return the last part of its path.
 */
function getReferenceName(obj: any) {
  if (isReference(obj)) {
    return _.camelCase(obj.$ref.split("/").slice(-1)[0]);
  }
}

/**
 * Create a template string literal from the given OpenAPI urlTemplate.
 * Curly braces in the path are turned into identifier expressions,
 * which are read from the local scope during runtime.
 */
function createUrlExpression(path: string, qs?: ts.Expression) {
  const spans: Array<{ expression: ts.Expression; literal: string }> = [];
  // Use a replacer function to collect spans as a side effect:
  const head = path.replace(
    /(.*?)\{(.+?)\}(.*?)(?=\{|$)/g,
    (_substr, head, name, literal) => {
      const expression = _.camelCase(name);
      spans.push({ expression: ts.factory.createIdentifier(expression), literal });
      return head;
    }
  );
  if (qs) {
    // add the query string as last span
    spans.push({ expression: qs, literal: "" });
  }
  return codegen.createTemplateString(head, spans);
}

/**
 * Create a call expression for one of the Query runtime functions.
 */
function callQueryFunction(name: string, args: ts.Expression[]) {
  return codegen.createCall(
    ts.createPropertyAccess(ts.createIdentifier("Query"), name),
    { args }
  );
}

/**
 * Create a call expression for one of the oa-client-generator runtime functions.
 */
function callOaClientGenFunction(
  name: string,
  args: ts.Expression[],
  typeArgs?: ts.TypeNode[]
) {
  return codegen.createCall(
    ts.factory.createPropertyAccessExpression(ts.createIdentifier("oaclientgen"), name),
    { args, typeArgs }
  );
}

/**
 * Despite its name, OpenApi `deepObject` serialization does not support
 * deeply nested objects. As a workaround we detect parameters that contain
 * square brackets and merge them into a single object.
 */
function supportDeepObjects(params: OpenAPIV3.ParameterObject[]) {
  const res: OpenAPIV3.ParameterObject[] = [];
  const merged: any = {};
  params.forEach((p) => {
    const m = /^(.+?)\[(.*?)\]/.exec(p.name);
    if (!m) {
      res.push(p);
      return;
    }
    const [, name, prop] = m;
    let obj = merged[name];
    if (!obj) {
      obj = merged[name] = {
        name,
        in: p.in,
        style: "deepObject",
        schema: {
          type: "object",
          properties: {},
        },
      };
      res.push(obj);
    }
    obj.schema.properties[prop] = p.schema;
  });
  return res;
}

/**
 * Main entry point that generates TypeScript code from a given API spec.
 */
export default function generateApi(spec: OpenAPIV3.Document, opts?: Opts) {
  const aliases: ts.TypeAliasDeclaration[] = [];

  function resolve<T>(obj: T | OpenAPIV3.ReferenceObject) {
    if (!isReference(obj)) return obj;
    const ref = obj.$ref;
    if (!ref.startsWith("#/")) {
      throw new Error(
        `External refs are not supported (${ref}). Make sure to call SwaggerParser.bundle() first.`
      );
    }
    return getReference(spec, ref) as T;
  }

  function resolveArray<T>(array?: Array<T | OpenAPIV3.ReferenceObject>) {
    return array ? array.map(resolve) : [];
  }

  function skip(tags?: string[]) {
    const excluded = tags && tags.some((t) => opts?.exclude?.includes(t));
    if (excluded) {
      return true;
    }
    if (opts?.include) {
      const included = tags && tags.some((t) => opts.include?.includes(t));
      return !included;
    }
    return false;
  }

  // Collect the types of all referenced schemas so we can export them later
  const refs: Record<string, ts.TypeReferenceNode> = {};

  // Keep track of already used type aliases
  const typeAliases: Record<string, number> = {};

  function getUniqueAlias(name: string) {
    let used = typeAliases[name] || 0;
    if (used) {
      typeAliases[name] = ++used;
      name += used;
    }
    typeAliases[name] = 1;
    return name;
  }

  function getRefBasename(ref: string): string {
    return ref.replace(/.+\//, "");
  }

  /**
   * Create a type alias for the schema referenced by the given ReferenceObject
   */
  function getRefAlias(obj: OpenAPIV3.ReferenceObject) {
    const { $ref } = obj;
    let ref = refs[$ref];
    if (!ref) {
      const schema = resolve<OpenAPIV3.SchemaObject>(obj);
      const name = getUniqueAlias(
        _.upperFirst(schema.title || getRefBasename($ref))
      );

      ref = refs[$ref] = ts.createTypeReferenceNode(name, undefined);

      const type = getTypeFromSchema(schema);
      aliases.push(
        codegen.createTypeAliasDeclaration({
          modifiers: [codegen.modifier.export],
          name,
          type,
        })
      );
    }
    return ref;
  }

  function getUnionType(
    variants: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[],
    discriminator?: OpenAPIV3.DiscriminatorObject
  ): ts.TypeNode {
    if (discriminator) {
      // oneOf + discriminator -> tagged union (polymorphism)
      if (discriminator.propertyName === undefined) {
        throw new Error("Discriminators require a propertyName");
      }

      // By default, the last component of the ref name (i.e., after the last trailing slash) is
      // used as the discriminator value for each variant. This can be overridden using the
      // discriminator.mapping property.
      const mappedValues = new Set(
        Object.values(discriminator.mapping || {}).map((ref) =>
          getRefBasename(ref)
        )
      );

      return ts.factory.createUnionTypeNode(
        ([
          ...Object.entries(
            discriminator.mapping || {}
          ).map(([discriminatorValue, variantRef]) => [
            discriminatorValue,
            { $ref: variantRef },
          ]),
          ...variants
            .filter((variant) => {
              if (!isReference(variant)) {
                // From the Swagger spec: "When using the discriminator, inline schemas will not be
                // considered."
                throw new Error(
                  "Discriminators require references, not inline schemas"
                );
              }
              return !mappedValues.has(getRefBasename(variant.$ref));
            })
            .map((schema) => [
              getRefBasename((schema as OpenAPIV3.ReferenceObject).$ref),
              schema,
            ]),
        ] as [string, OpenAPIV3.ReferenceObject][]).map(
          ([discriminatorValue, variant]) =>
            // Yields: { [discriminator.propertyName]: discriminatorValue } & variant
            ts.factory.createIntersectionTypeNode([
              ts.factory.createTypeLiteralNode([
                codegen.createPropertySignature({
                  name: discriminator.propertyName,
                  type: ts.createLiteralTypeNode(
                    ts.createStringLiteral(discriminatorValue)
                  ),
                }),
              ]),
              getTypeFromSchema(variant),
            ])
        )
      );
    } else {
      // oneOf -> untagged union
      return ts.factory.createUnionTypeNode(variants.map(getTypeFromSchema));
    }
  }

  /**
   * Creates a type node from a given schema.
   * Delegates to getBaseTypeFromSchema internally and
   * optionally adds a union with null.
   */
  function getTypeFromSchema(
    schema?: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  ): ts.TypeNode {
    const type = getBaseTypeFromSchema(schema);
    return isNullable(schema)
      ? ts.createUnionTypeNode([type, codegen.keywordType.null])
      : type;
  }

  /**
   * This is the very core of the OpenAPI to TS conversion - it takes a
   * schema and returns the appropriate type.
   */
  function getBaseTypeFromSchema(
    schema?: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  ): ts.TypeNode {
    if (!schema) return codegen.keywordType.any;
    if (isReference(schema)) {
      return getRefAlias(schema);
    }

    if (schema.oneOf) {
      // oneOf -> union
      return getUnionType(schema.oneOf, schema.discriminator);
    }
    if (schema.anyOf) {
      // anyOf -> union
      return ts.factory.createUnionTypeNode(schema.anyOf.map(getTypeFromSchema));
    }
    if (schema.allOf) {
      // allOf -> intersection
      return ts.factory.createIntersectionTypeNode(schema.allOf.map(getTypeFromSchema));
    }
    if ("items" in schema) {
      // items -> array
      return ts.factory.createArrayTypeNode(getTypeFromSchema(schema.items));
    }
    if (schema.properties || schema.additionalProperties) {
      // properties -> literal type
      return getTypeFromProperties(
        schema.properties || {},
        schema.required,
        schema.additionalProperties
      );
    }
    if (schema.enum) {
      // enum -> union of literal types
      const types = schema.enum.map((s) => {
        if (s === null) return codegen.keywordType.null;
        if (typeof s === "boolean") {
          return s
            ? ts.factory.createLiteralTypeNode(ts.createTrue())
            : ts.factory.createLiteralTypeNode(ts.createFalse());
        }
        return ts.factory.createLiteralTypeNode(ts.createStringLiteral(s));
      });
      return types.length > 1 ? ts.factory.createUnionTypeNode(types) : types[0];
    }
    if (schema.format == "binary") {
      return ts.factory.createTypeReferenceNode("Blob", []);
    }
    if (schema.type) {
      // string, boolean, null, number
      if (schema.type in codegen.keywordType) return codegen.keywordType[schema.type];
      if (schema.type === "integer") return codegen.keywordType.number;
    }

    return codegen.keywordType.any;
  }

  /**
   * Recursively creates a type literal with the given props.
   */
  function getTypeFromProperties(
    props: {
      [prop: string]: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
    },
    required?: string[],
    additionalProperties?:
      | boolean
      | OpenAPIV3.SchemaObject
      | OpenAPIV3.ReferenceObject
  ) {
    const members: ts.TypeElement[] = Object.keys(props).map((name) => {
      const schema = props[name];
      const isRequired = required && required.includes(name);
      return codegen.createPropertySignature({
        questionToken: !isRequired,
        name,
        type: getTypeFromSchema(schema),
      });
    });
    if (additionalProperties) {
      const type =
        additionalProperties === true
          ? codegen.keywordType.any
          : getTypeFromSchema(additionalProperties);

      members.push(codegen.createIndexSignature(type));
    }
    return ts.factory.createTypeLiteralNode(members);
  }

  function getTypeFromResponses(responses: OpenAPIV3.ResponsesObject) {
    return ts.factory.createUnionTypeNode(
      Object.entries(responses).map(([code, res]) => {
        const statusType =
          code === "default"
            ? codegen.keywordType.number
            : ts.factory.createLiteralTypeNode(ts.factory.createNumericLiteral(code));

        const props = [
          codegen.createPropertySignature({
            name: "status",
            type: statusType,
          }),
        ];

        const dataType = getTypeFromResponse(res);
        if (dataType !== codegen.keywordType.void) {
          props.push(
            codegen.createPropertySignature({
              name: "data",
              type: dataType,
            })
          );
        }
        return ts.factory.createTypeLiteralNode(props);
      })
    );
  }

  function getTypeFromResponse(
    resOrRef: OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject
  ) {
    const res = resolve(resOrRef);
    if (!res || !res.content) return codegen.keywordType.void;
    return getTypeFromSchema(getSchemaFromContent(res.content));
  }

  function hasJsonContent(responses?: OpenAPIV3.ResponsesObject) {
    if (!responses) return false;
    return Object.values(responses)
      .map(resolve)
      .some(
        (res) =>
          !!_.get(res, ["content", "application/json"]) ||
          !!_.get(res, ["content", "*/*"])
      );
  }

  function getSchemaFromContent(content: any) {
    const contentType = Object.keys(contentTypes).find((t) => t in content);
    let schema;
    if (contentType) {
      schema = _.get(content, [contentType, "schema"]);
    }
    return (
      schema || {
        type: "string",
      }
    );
  }

  function wrapResult(ex: ts.Expression) {
    return opts?.optimistic ? callOaClientGenFunction("ok", [ex]) : ex;
  }

  // Parse ApiTemplate.ts so that we don't have to generate everything manually
  const stub = codegen.parseFile(
    path.resolve(__dirname, "../../src/codegen/ApiTemplate.ts")
  );

  // ApiTemplate contains `const servers = {}`, find it ...
  let servers = codegen.findFirstVariableDeclaration(stub.statements, "servers");

  servers = ts.factory.updateVariableDeclaration(
    servers,
    servers.name,
    servers.exclamationToken,
    servers.type,
    generateServers(spec.servers || [])
  );

  const { initializer } = codegen.findFirstVariableDeclaration(
    stub.statements,
    "defaults"
  );
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
    throw new Error("No object literal: defaults");
  }

  codegen.changePropertyValue(
    initializer,
    "baseUrl",
    defaultBaseUrl(spec.servers || [])
  );

  // Collect class functions to be added...
  const functions: ts.FunctionDeclaration[] = [];

  // Keep track of names to detect duplicates
  const names: Record<string, number> = {};

  Object.keys(spec.paths).forEach((path) => {
    const item: OpenAPIV3.PathItemObject = spec.paths[path];
    Object.keys(resolve(item)).forEach((verb) => {
      const method = verb.toUpperCase();
      // skip summary/description/parameters etc...
      if (!verbs.includes(method)) return;

      const op: OpenAPIV3.OperationObject = (item as any)[verb];
      const {
        operationId,
        requestBody,
        responses,
        summary,
        description,
        tags,
      } = op;

      if (skip(tags)) {
        return;
      }

      let name = getOperationName(verb, path, operationId);
      const count = (names[name] = (names[name] || 0) + 1);
      if (count > 1) {
        // The name is already taken, which means that the spec is probably
        // invalid as operationIds must be unique. Since this is quite common
        // nevertheless we append a counter:
        name += count;
      }

      // merge item and op parameters
      const parameters = supportDeepObjects([
        ...resolveArray(item.parameters),
        ...resolveArray(op.parameters),
      ]);

      // split into required/optional
      const [required, optional] = _.partition(parameters, "required");

      // convert parameter names to argument names ...
      const argNames: any = {};
      parameters
        .map((p) => p.name)
        .sort((a, b) => a.length - b.length)
        .forEach((name) => {
          // strip leading namespaces, eg. foo.name -> name
          const stripped = _.camelCase(name.replace(/.+\./, ""));
          // keep the prefix if the stripped-down name is already taken
          argNames[name] = stripped in argNames ? _.camelCase(name) : stripped;
        });

      // build the method signature - first all the required parameters
      const methodParams = required.map((p) =>
        codegen.createParameter(argNames[resolve(p).name], {
          type: getTypeFromSchema(isReference(p) ? p : p.schema),
        })
      );

      let body: any;
      let bodyVar;

      // add body if present
      if (requestBody) {
        body = resolve(requestBody);
        const schema = getSchemaFromContent(body.content);
        const type = getTypeFromSchema(schema);
        bodyVar = _.camelCase(
          (type as any).name || getReferenceName(schema) || "body"
        );
        methodParams.push(
          codegen.createParameter(bodyVar, {
            type,
            questionToken: !body.required
          })
        );
      }

      // add an object with all optional parameters
      if (optional.length) {
        methodParams.push(
          codegen.createParameter(
            codegen.createObjectBinding(
              optional
                .map(resolve)
                .map(({ name }) => ({ name: argNames[name] }))
            ),
            {
              initializer: ts.factory.createObjectLiteralExpression(),
              type: ts.factory.createTypeLiteralNode(
                optional.map((p) =>
                  codegen.createPropertySignature({
                    name: argNames[resolve(p).name],
                    questionToken: true,
                    type: getTypeFromSchema(isReference(p) ? p : p.schema),
                  })
                )
              ),
            }
          )
        );
      }

      methodParams.push(
        codegen.createParameter("opts", {
          type: ts.factory.createTypeReferenceNode("OaClientGen.RequestOpts", undefined),
          questionToken: true,
        })
      );

      // Next, build the method body...

      const returnsJson = hasJsonContent(responses);
      const query = parameters.filter((p) => p.in === "query");
      const header = parameters
        .filter((p) => p.in === "header")
        .map((p) => p.name);
      let qs;
      if (query.length) {
        const paramsByFormatter = _.groupBy(query, getFormatter);
        qs = callQueryFunction(
          "query",
          Object.entries(paramsByFormatter).map(([format, params]) => {
            //const [allowReserved, encodeReserved] = _.partition(params, "allowReserved");
            return callQueryFunction(format, [
              codegen.createObjectLiteral(
                params.map((p) => [p.name, argNames[p.name]])
              ),
            ]);
          })
        );
      }

      const url = createUrlExpression(path, qs);
      const init: ts.ObjectLiteralElementLike[] = [
        ts.factory.createSpreadAssignment(ts.createIdentifier("opts")),
      ];

      if (method !== "GET") {
        init.push(
          ts.factory.createPropertyAssignment("method", ts.createStringLiteral(method))
        );
      }

      if (bodyVar) {
        init.push(
          codegen.createPropertyAssignment("body", ts.createIdentifier(bodyVar))
        );
      }

      if (header.length) {
        init.push(
          ts.factory.createPropertyAssignment(
            "headers",
            ts.factory.createObjectLiteralExpression(
              [
                ts.factory.createSpreadAssignment(
                  ts.factory.createLogicalAnd(
                    ts.factory.createIdentifier("opts"),
                    ts.factory.createPropertyAccessExpression(
                      ts.createIdentifier("opts"),
                      "headers"
                    )
                  )
                ),
                ...header.map((name) =>
                  codegen.createPropertyAssignment(
                    name,
                    ts.createIdentifier(argNames[name])
                  )
                ),
              ],
              true
            )
          )
        );
      }

      const args: ts.Expression[] = [url];

      if (init.length) {
        const m = Object.entries(contentTypes).find(([type]) => {
          return !!_.get(body, ["content", type]);
        });
        const initObj = ts.factory.createObjectLiteralExpression(init, true);
        args.push(m ? callOaClientGenFunction(m[1], [initObj]) : initObj); // json, form, multipart
      }

      functions.push(
        codegen.addComment(
          codegen.createFunctionDeclaration(
            name,
            {
              modifiers: [codegen.modifier.export],
            },
            methodParams,
            codegen.block(
              ts.factory.createReturnStatement(
                wrapResult(
                  callOaClientGenFunction(
                    returnsJson ? "fetchJson" : "fetchText",
                    args,
                    returnsJson
                      ? [
                          getTypeFromResponses(responses!) ||
                            ts.SyntaxKind.AnyKeyword,
                        ]
                      : undefined
                  )
                )
              )
            )
          ),
          summary || description
        )
      );
    });
  });

  return ts.factory.updateSourceFile(
    stub,
    codegen.appendNodes(stub.statements, ...[...aliases, ...functions])
  );
}
