import _ from "lodash";
import * as codegen from "./codegen";
import ts, { TypeNode, TemplateLiteral } from "typescript";
import { OpenAPIV3 } from "openapi-types";

function createLiteral(value: string | boolean | number) {
  switch (typeof value) {
    case "string":
      return ts.factory.createStringLiteral(value);
    case "boolean":
      return value ? ts.factory.createTrue() : ts.factory.createFalse();
    case "number":
      return ts.factory.createNumericLiteral(String(value));
  }
}

function createUnion(strings: (string | boolean | number)[]): TypeNode[] {
  return strings.map(
    (e): TypeNode => {
      return ts.factory.createLiteralTypeNode(createLiteral(e));
    }
  );
}

function createTemplate(url: string): TemplateLiteral {
  const tokens = url.split(/{([\s\S]+?)}/g);
  const chunks = _.chunk(tokens.slice(1), 2);
  return ts.factory.createTemplateExpression(
    ts.factory.createTemplateHead(tokens[0]),
    [
      ...chunks.map(
        ([expression, literal], i) => {
          const _createTemplate = i === chunks.length - 1
            ? ts.factory.createTemplateTail
            : ts.factory.createTemplateMiddle;

          return ts.factory.createTemplateSpan(
            ts.factory.createIdentifier(expression),
            _createTemplate(literal)
          );
    }),
  ]);
}

function createServerFunction(
  template: string,
  vars: Record<string, OpenAPIV3.ServerVariableObject>
) {
  const params = [
    codegen.createParameter(
      codegen.createObjectBinding(
        Object.entries(vars || {}).map(([name, value]) => {
          return {
            name,
            initializer: createLiteral(value.default),
          };
        })
      ),
      {
        type: ts.factory.createTypeLiteralNode(
          Object.entries(vars || {}).map(([name, value]) => {
            const type = value.enum
              ? ts.factory.createUnionTypeNode(createUnion(value.enum))
              : ts.factory.createUnionTypeNode([
                  codegen.keywordType.string,
                  codegen.keywordType.number,
                  codegen.keywordType.boolean,
                ]);

            return codegen.createPropertySignature({ name, type });
          })
        ),
      }
    ),
  ];

  return codegen.createArrowFunction(params, createTemplate(template));
}

function generateServerExpression(server: OpenAPIV3.ServerObject) {
  return server.variables
    ? createServerFunction(server.url, server.variables)
    : ts.factory.createStringLiteral(server.url);
}

function defaultUrl(server?: OpenAPIV3.ServerObject) {
  if (!server) return "/";
  const { url, variables } = server;
  if (!variables) return url;
  return url.replace(/\{(.+?)\}/g, (m, name) =>
    variables[name] ? String(variables[name].default) : m
  );
}

export function defaultBaseUrl(servers: OpenAPIV3.ServerObject[]) {
  return ts.createStringLiteral(defaultUrl(servers[0]));
}

function serverName(server: OpenAPIV3.ServerObject, index: number) {
  return server.description
    ? _.camelCase(server.description.replace(/\W+/, " "))
    : `server${index + 1}`;
}

export default function generateServers(servers: OpenAPIV3.ServerObject[]) {
  const props = servers.map((server, i) => {
    return [serverName(server, i), generateServerExpression(server)] as [
      string,
      ts.Expression
    ];
  });

  return codegen.createObjectLiteral(props);
}
