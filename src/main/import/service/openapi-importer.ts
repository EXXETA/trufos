import { dereference } from '@readme/openapi-parser';
import { CollectionImporter } from './import-service';
import { Collection as TrufosCollection } from 'shim/objects/collection';
import { Folder as TrufosFolder } from 'shim/objects/folder';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { parseUrl } from 'shim/objects/url';
import { TrufosQueryParam } from 'shim/objects/query-param';
import { VARIABLE_NAME_REGEX } from 'shim/objects/variables';
import { truncate } from 'shim/string';
import { TrufosHeader } from 'shim/objects/headers';
import {
  AuthorizationInformationNoInherit,
  AuthorizationType,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
} from 'shim';
import { randomUUID } from 'node:crypto';
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

const DEFAULT_MIME_TYPE = 'text/plain';
const JSON_MIME_TYPE = 'application/json';
const DEFAULT_BASE_URL = 'http://localhost';

/** The maximum length of a request title derived from an OpenAPI operation summary. */
const MAX_TITLE_LENGTH = 100;

/** Matches a path template parameter, e.g. the `{appId}` in `/apps/{appId}/versions`. */
const PATH_PARAMETER_REGEX = /\{([^{}/]*)\}/g;

/** The collection variable that holds the server URL all imported requests are sent to. */
const BASE_URL_VARIABLE = 'baseUrl';

type OpenApiDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document;
type OpenApi3Document = OpenAPIV3.Document | OpenAPIV3_1.Document;
type OpenApi3Operation = OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject;
type OpenApi3Parameter = OpenAPIV3.ParameterObject | OpenAPIV3_1.ParameterObject;
type OpenApi3RequestBody = OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject;
type OpenApi3SecurityScheme = OpenAPIV3.SecuritySchemeObject | OpenAPIV3_1.SecuritySchemeObject;
type OAuth2Flow = {
  authorizationUrl?: string;
  tokenUrl?: string;
};

/**
 * The parts of a JSON schema that the request body generator understands. The OpenAPI schema types
 * differ between the specification versions, but all of them are JSON schemas at their core.
 */
type ExampleSchema = {
  $ref?: string;
  type?: string | string[];
  example?: unknown;
  default?: unknown;
  enum?: unknown[];
  readOnly?: boolean;
  properties?: Record<string, ExampleSchema>;
  items?: ExampleSchema;
  allOf?: ExampleSchema[];
  oneOf?: ExampleSchema[];
  anyOf?: ExampleSchema[];
};

/** What a single security scheme contributes to a request. */
type SecuritySchemeImport = {
  auth?: AuthorizationInformationNoInherit;
  header?: TrufosHeader;
  queryParam?: TrufosQueryParam;
};

/** What a met security requirement contributes to a request. */
type ImportedSecurity = {
  auth?: AuthorizationInformationNoInherit;
  headers: TrufosHeader[];
  query: TrufosQueryParam[];
};

const HTTP_METHODS = new Set(Object.values(RequestMethod).map((method) => method.toLowerCase()));

export class OpenApiImporter implements CollectionImporter {
  public async importCollection(srcFilePath: string) {
    const document = (await dereference(srcFilePath, {
      dereference: { circular: 'ignore' },
    })) as OpenApiDocument;

    const collection: TrufosCollection = {
      id: randomUUID(),
      type: 'collection',
      lastModified: Date.now(),
      title: document.info.title,
      dirPath: '',
      children: [],
      variables: {},
      environments: {},
    };

    // the document security applies to every operation that does not bring its own, so it becomes
    // the authorization of the collection and the operations inherit it
    const documentSecurity = this.importSecurity(document, document.security);
    collection.auth = documentSecurity?.auth;

    this.importPaths(collection, document, documentSecurity);
    return collection;
  }

  private importPaths(
    collection: TrufosCollection,
    document: OpenApiDocument,
    documentSecurity?: ImportedSecurity
  ) {
    const foldersByTag = new Map<string, TrufosFolder>();
    const baseUrl = this.importServers(collection, document);

    for (const [pathTemplate, pathItem] of Object.entries(document.paths ?? {})) {
      if (pathItem == null) continue;

      for (const [method, operationCandidate] of Object.entries(pathItem)) {
        if (!this.isOperation(method, operationCandidate)) continue;

        const request = this.importOperation(
          collection,
          baseUrl,
          pathTemplate,
          method as Lowercase<RequestMethod>,
          pathItem,
          operationCandidate,
          document,
          documentSecurity
        );
        const firstTag = operationCandidate.tags?.[0];
        if (firstTag == null || firstTag.trim() === '') {
          collection.children.push(request);
          continue;
        }

        const folder = this.getOrCreateFolder(collection, foldersByTag, firstTag);
        request.parentId = folder.id;
        folder.children.push(request);
      }
    }
  }

  private importOperation(
    collection: TrufosCollection,
    baseUrl: string,
    pathTemplate: string,
    method: Lowercase<RequestMethod>,
    pathItem: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject | OpenAPIV3_1.PathItemObject,
    operation: OpenAPIV2.OperationObject | OpenApi3Operation,
    document: OpenApiDocument,
    documentSecurity?: ImportedSecurity
  ): TrufosRequest {
    const parameters = this.getParameters(pathItem, operation);
    const query = parameters
      .filter((parameter) => parameter.in === 'query')
      .map((parameter) => this.importQueryParam(parameter));

    // an operation without security of its own inherits the one of the document
    const inheritsSecurity = operation.security == null;
    const security = inheritsSecurity
      ? documentSecurity
      : this.importSecurity(document, operation.security);

    this.importPathVariables(collection, pathTemplate, parameters);

    return {
      id: randomUUID(),
      parentId: collection.id,
      type: 'request',
      lastModified: Date.now(),
      title: this.getTitle(operation, pathTemplate),
      url: {
        ...parseUrl(this.joinUrl(baseUrl, this.toTemplateVariables(pathTemplate))),
        query: query.concat(security?.query ?? []),
      },
      headers: this.importHeaders(parameters).concat(security?.headers ?? []),
      method: method.toUpperCase() as RequestMethod,
      body: this.importBody(operation, document),
      auth: inheritsSecurity ? { type: AuthorizationType.INHERIT } : security?.auth,
    };
  }

  /**
   * Derives the title of an imported request. The title is also the source of its directory name,
   * so it must stay short and should identify the operation. The HTTP method is not part of it,
   * because it is shown separately in the UI.
   * @param operation the operation to derive the title from
   * @param pathTemplate the path of the operation, e.g. `/apps/{appId}/versions`
   * @returns the shortened operation summary, or the operation ID, or the path as last resort
   */
  private getTitle(
    operation: OpenAPIV2.OperationObject | OpenApi3Operation,
    pathTemplate: string
  ): string {
    const summary = this.shortenSummary(operation.summary);
    if (summary !== '') return summary;

    const operationId = operation.operationId?.trim();
    if (operationId != null && operationId !== '') return operationId;

    return pathTemplate;
  }

  /**
   * Shortens an operation summary to a single line of at most {@link MAX_TITLE_LENGTH} characters.
   * Summaries are meant to be short descriptions, but specs in the wild put the whole endpoint
   * documentation in them, which makes for unreadable titles and directory names.
   * @param summary the summary of the operation, if any
   * @returns the first sentence of the summary, or an empty string if there is no summary
   */
  private shortenSummary(summary?: string) {
    const firstLine = summary?.split(/\r?\n/, 1)[0]?.trim().replace(/\.$/, '') ?? '';
    return truncate(firstLine, MAX_TITLE_LENGTH, ' ');
  }

  /**
   * Converts the OpenAPI path template syntax `{appId}` into the Trufos template variable syntax
   * `{{appId}}`, so that the parameter is resolved when the request is sent instead of being sent
   * literally. Parameters whose name cannot be a Trufos variable are left untouched, because
   * turning them into templates would only produce URLs that never resolve.
   * @param pathTemplate the path of the operation, e.g. `/apps/{appId}/versions`
   * @returns the path with all of its parameters in Trufos template variable syntax
   */
  private toTemplateVariables(pathTemplate: string) {
    return pathTemplate.replace(PATH_PARAMETER_REGEX, (parameter, name: string) =>
      VARIABLE_NAME_REGEX.test(name) ? `{{${name}}}` : parameter
    );
  }

  /**
   * Declares the parameters of a path template as collection variables, so that the templates in
   * the imported URL resolve to something. The variables are derived from the path template rather
   * than from the parameter list, because specs in the wild use parameters they never declare.
   * Already known variables are kept, as the same parameter usually appears in many operations.
   * @param collection the collection to declare the variables in
   * @param pathTemplate the path of the operation, e.g. `/apps/{appId}/versions`
   * @param parameters the parameters of the operation, used as source of values and descriptions
   */
  private importPathVariables(
    collection: TrufosCollection,
    pathTemplate: string,
    parameters: Array<OpenAPIV2.ParameterObject | OpenApi3Parameter>
  ) {
    for (const [, name] of pathTemplate.matchAll(PATH_PARAMETER_REGEX)) {
      if (!VARIABLE_NAME_REGEX.test(name) || collection.variables[name] != null) continue;

      const parameter = parameters.find(
        (parameter) => parameter.in === 'path' && parameter.name === name
      );
      collection.variables[name] = {
        value: (parameter == null ? undefined : this.stringifyParameterValue(parameter)) ?? '',
        description: parameter?.description,
      };
    }
  }

  private getOrCreateFolder(
    collection: TrufosCollection,
    foldersByTag: Map<string, TrufosFolder>,
    tag: string
  ) {
    let folder = foldersByTag.get(tag);
    if (folder != null) return folder;

    folder = {
      id: randomUUID(),
      parentId: collection.id,
      type: 'folder',
      lastModified: Date.now(),
      title: tag,
      children: [],
    };
    foldersByTag.set(tag, folder);
    collection.children.push(folder);
    return folder;
  }

  /**
   * Imports the servers of the document. Requests are built against a {@link BASE_URL_VARIABLE}
   * variable instead of the server URL itself, so that the whole collection can be pointed at
   * another installation by editing one value. Documents that list more than one server get an
   * environment per server on top, which makes switching between them a single click.
   * @param collection the collection to declare the variable and the environments in
   * @param document the document to import the servers of
   * @returns the base URL to build the request URLs with
   */
  private importServers(collection: TrufosCollection, document: OpenApiDocument) {
    const servers = this.getServers(document);
    collection.variables[BASE_URL_VARIABLE] = { value: servers[0].url };

    if (servers.length > 1) {
      for (const server of servers) {
        const key = this.getUniqueKey(collection.environments, server.key);
        collection.environments[key] = {
          variables: { [BASE_URL_VARIABLE]: { value: server.url } },
        };
      }
    }

    return `{{${BASE_URL_VARIABLE}}}`;
  }

  /**
   * @param document the document to read the servers of
   * @returns the servers of the document as absolute URLs, at least one
   */
  private getServers(document: OpenApiDocument) {
    const urls = this.isOpenApi3(document)
      ? (document.servers ?? []).map((server) => ({
          url: this.completeBaseUrl(this.resolveServerUrl(server)),
          description: server.description,
        }))
      : [{ url: this.getSwaggerBaseUrl(document), description: undefined }];

    const servers = urls.length === 0 ? [{ url: DEFAULT_BASE_URL, description: undefined }] : urls;
    return servers.map((server) => ({
      url: server.url,
      // the scheme carries no meaning for the user, but the host and path tell the servers apart
      key: server.description?.trim() || server.url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, ''),
    }));
  }

  private getSwaggerBaseUrl(document: OpenAPIV2.Document) {
    const scheme = document.schemes?.[0] ?? 'https';
    const host = document.host ?? '';
    const basePath = document.basePath ?? '';
    return this.completeBaseUrl(host === '' ? basePath : `${scheme}://${host}${basePath}`);
  }

  /**
   * @param existing the entries that the key must not collide with
   * @param key the desired key
   * @returns the key itself, or the key with a counter appended if it is already taken
   */
  private getUniqueKey(existing: Record<string, unknown>, key: string) {
    if (existing[key] === undefined) return key;

    let counter = 2;
    while (existing[`${key}-${counter}`] !== undefined) counter++;
    return `${key}-${counter}`;
  }

  private getParameters(
    pathItem: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject | OpenAPIV3_1.PathItemObject,
    operation: OpenAPIV2.OperationObject | OpenApi3Operation
  ) {
    return [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].filter(
      (parameter) => parameter != null && 'name' in parameter && 'in' in parameter
    ) as Array<OpenAPIV2.ParameterObject | OpenApi3Parameter>;
  }

  /**
   * Imports a query parameter. Optional parameters that the spec gives no value for are imported
   * as inactive, because sending them empty (`?search=&filter=`) is not what the endpoint expects
   * and specs commonly declare dozens of optional parameters per operation.
   * @param parameter the query parameter to import
   * @returns the query parameter of the request
   */
  private importQueryParam(
    parameter: OpenAPIV2.ParameterObject | OpenApi3Parameter
  ): TrufosQueryParam {
    const value = this.stringifyParameterValue(parameter) ?? '';
    return { key: parameter.name, value, isActive: parameter.required === true || value !== '' };
  }

  private importHeaders(
    parameters: Array<OpenAPIV2.ParameterObject | OpenApi3Parameter>
  ): TrufosHeader[] {
    return parameters
      .filter((parameter) => parameter.in === 'header')
      .map((parameter) => ({
        key: parameter.name,
        value: this.stringifyParameterValue(parameter) ?? '',
        isActive: true,
      }));
  }

  private importBody(
    operation: OpenAPIV2.OperationObject | OpenApi3Operation,
    document: OpenApiDocument
  ): RequestBody {
    if ('requestBody' in operation && operation.requestBody != null) {
      return this.importOpenApi3Body(operation.requestBody as OpenApi3RequestBody, document);
    }

    const bodyParameter = (operation.parameters ?? []).find(
      (parameter) => parameter != null && 'in' in parameter && parameter.in === 'body'
    ) as OpenAPIV2.InBodyParameterObject | undefined;
    if (bodyParameter != null) {
      return {
        type: RequestBodyType.TEXT,
        mimeType: JSON_MIME_TYPE,
        text: this.stringifyExample(
          bodyParameter.example ?? this.generateExample(bodyParameter, document)
        ),
      };
    }

    return {
      type: RequestBodyType.TEXT,
      mimeType: DEFAULT_MIME_TYPE,
    };
  }

  private importOpenApi3Body(
    requestBody: OpenApi3RequestBody,
    document: OpenApiDocument
  ): RequestBody {
    const [mimeType, mediaType] = Object.entries(requestBody.content ?? {})[0] ?? [
      DEFAULT_MIME_TYPE,
      undefined,
    ];

    return {
      type: RequestBodyType.TEXT,
      mimeType,
      text: this.stringifyExample(mediaType?.example ?? this.generateExample(mediaType, document)),
    };
  }

  /**
   * Generates an example value for the schema of a media type or body parameter. Most specs
   * document their bodies with a schema and no example at all, which would leave every imported
   * request with an empty body, so the schema is turned into a skeleton the user can fill in.
   * @param container the media type or body parameter holding the schema
   * @param document the document the schema belongs to, used to look up references
   * @returns the generated example, or undefined if there is no usable schema
   */
  private generateExample(container: { schema?: unknown } | undefined, document: OpenApiDocument) {
    const schema = container?.schema as ExampleSchema | undefined;
    return this.generateSchemaExample(schema, new Set(), document);
  }

  /**
   * Generates an example value for a single schema.
   * @param schema the schema to generate a value for
   * @param ancestors the schemas that the current value is nested in, used to stop recursion
   * @param document the document the schema belongs to, used to look up references
   * @returns the generated value, or undefined if the schema describes nothing usable
   */
  private generateSchemaExample(
    schema: ExampleSchema | undefined,
    ancestors: Set<ExampleSchema>,
    document: OpenApiDocument
  ): unknown {
    // a schema that is part of a reference cycle is left as a reference by the parser
    const resolved = this.resolveSchemaRef(schema, document);
    if (resolved == null || ancestors.has(resolved)) return;

    if (resolved.example !== undefined) return resolved.example;
    if (resolved.default !== undefined) return resolved.default;
    if (resolved.enum != null && resolved.enum.length > 0) return resolved.enum[0];

    ancestors.add(resolved);
    try {
      // any of the alternatives is valid, so the first one is as good a starting point as any
      const alternative = resolved.oneOf?.[0] ?? resolved.anyOf?.[0];
      if (alternative != null) return this.generateSchemaExample(alternative, ancestors, document);

      const type = this.getSchemaType(resolved);
      if (type === 'array') {
        const item = this.generateSchemaExample(resolved.items, ancestors, document);
        return item === undefined ? [] : [item];
      }
      if (type === 'object' || resolved.properties != null || resolved.allOf != null) {
        return this.generateObjectExample(resolved, ancestors, document);
      }

      return this.generatePrimitiveExample(type);
    } finally {
      ancestors.delete(resolved);
    }
  }

  /**
   * Generates an example object. Read-only properties are left out, because they are owned by the
   * server and sending them is pointless at best.
   * @param schema the object schema to generate a value for
   * @param ancestors the schemas that the object is nested in, used to stop recursion
   * @param document the document the schema belongs to, used to look up references
   * @returns the generated object
   */
  private generateObjectExample(
    schema: ExampleSchema,
    ancestors: Set<ExampleSchema>,
    document: OpenApiDocument
  ) {
    const example: Record<string, unknown> = {};

    // a value has to satisfy every branch of an allOf, so their properties end up in one object
    for (const branch of schema.allOf ?? []) {
      const branchExample = this.generateSchemaExample(branch, ancestors, document);
      if (this.isPlainObject(branchExample)) Object.assign(example, branchExample);
    }

    for (const [name, property] of Object.entries(schema.properties ?? {})) {
      if (property.readOnly) continue;
      const value = this.generateSchemaExample(property, ancestors, document);
      if (value !== undefined) example[name] = value;
    }

    return example;
  }

  /**
   * Resolves a schema reference within the document. The parser dereferences the document already,
   * but it leaves the references of recursive schemas in place, which are the ones that appear here.
   * @param schema the schema that may be a reference
   * @param document the document to resolve the reference in
   * @returns the referenced schema, the given schema if it is none, or undefined if it is unknown
   */
  private resolveSchemaRef(schema: ExampleSchema | undefined, document: OpenApiDocument) {
    if (schema?.$ref == null) return schema;
    if (!schema.$ref.startsWith('#/')) return;

    let target: unknown = document;
    for (const segment of schema.$ref.slice(2).split('/')) {
      if (!this.isPlainObject(target)) return;
      target = target[segment.replaceAll('~1', '/').replaceAll('~0', '~')];
    }
    return this.isPlainObject(target) ? (target as ExampleSchema) : undefined;
  }

  /**
   * @param type the type of the schema to generate a value for
   * @returns an empty value of the given type, or undefined if the schema has no known type
   */
  private generatePrimitiveExample(type?: string) {
    switch (type) {
      case 'string':
        return '';
      case 'number':
      case 'integer':
        return 0;
      case 'boolean':
        return false;
      case 'null':
        return null;
    }
  }

  /**
   * @param schema the schema to read the type of
   * @returns the type of the schema, ignoring the `null` that OpenAPI 3.1 allows to add to it
   */
  private getSchemaType(schema: ExampleSchema) {
    if (!Array.isArray(schema.type)) return schema.type;
    return schema.type.find((type) => type !== 'null') ?? 'null';
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Imports the security of a document or operation. The requirements are alternatives, of which
   * only one has to be met, so the first one that Trufos can represent completely is used. Empty
   * requirements are skipped, because they only state that the authorization is optional, which
   * makes for a less useful request than actually authorizing it.
   * @param document the document the security schemes are defined in
   * @param requirements the security requirements of the document or of one of its operations
   * @returns what the requirement contributes to a request, or undefined if none is supported
   */
  private importSecurity(
    document: OpenApiDocument,
    requirements?: Array<OpenAPIV2.SecurityRequirementObject | OpenAPIV3.SecurityRequirementObject>
  ): ImportedSecurity | undefined {
    for (const requirement of requirements ?? []) {
      const schemeNames = Object.keys(requirement);
      if (schemeNames.length === 0) continue;

      // all schemes of a requirement must be met, so it is only usable if all of them are supported
      const parts: SecuritySchemeImport[] = [];
      for (const schemeName of schemeNames) {
        const scheme = this.getSecurityScheme(document, schemeName);
        const part =
          scheme == null
            ? undefined
            : this.importSecurityScheme(scheme, requirement[schemeName] ?? []);
        if (part == null) break;
        parts.push(part);
      }
      if (parts.length !== schemeNames.length) continue;

      return {
        auth: parts.find((part) => part.auth != null)?.auth,
        headers: parts.flatMap((part) => part.header ?? []),
        query: parts.flatMap((part) => part.queryParam ?? []),
      };
    }
  }

  /**
   * Imports a single security scheme. API keys have no equivalent in Trufos, but they are just a
   * header or query parameter, so they are imported as one with an empty value for the user to
   * fill in. API keys in cookies are not supported, as Trufos has no cookie store.
   * @param scheme the security scheme to import
   * @param scopes the scopes the requirement asks for, only used by OAuth 2.0
   * @returns what the scheme contributes to a request, or undefined if Trufos cannot represent it
   */
  private importSecurityScheme(
    scheme: OpenAPIV2.SecuritySchemeObject | OpenApi3SecurityScheme,
    scopes: string[]
  ): SecuritySchemeImport | undefined {
    switch (scheme.type) {
      case 'basic': // Swagger 2.0 spells out basic authentication as its own type
        return { auth: { type: AuthorizationType.BASIC, username: '', password: '' } };
      case 'http':
        switch (scheme.scheme?.toLowerCase()) {
          case 'basic':
            return { auth: { type: AuthorizationType.BASIC, username: '', password: '' } };
          case 'bearer':
            return { auth: { type: AuthorizationType.BEARER, token: '' } };
        }
        return;
      case 'oauth2': {
        const auth = this.importOAuth2Auth(scheme, scopes);
        return auth == null ? undefined : { auth };
      }
      case 'apiKey':
        switch (scheme.in) {
          case 'header':
            return { header: { key: scheme.name, value: '', isActive: true } };
          case 'query':
            return { queryParam: { key: scheme.name, value: '', isActive: true } };
        }
        return;
    }
  }

  private getSecurityScheme(document: OpenApiDocument, schemeName: string) {
    if (this.isOpenApi3(document)) {
      return document.components?.securitySchemes?.[schemeName] as OpenApi3SecurityScheme;
    }

    return document.securityDefinitions?.[schemeName];
  }

  private importOAuth2Auth(
    scheme: OpenAPIV2.SecuritySchemeObject | OpenApi3SecurityScheme,
    scopes: string[]
  ): AuthorizationInformationNoInherit | undefined {
    const flow = this.getOAuth2Flow(scheme);
    if (flow == null) return;

    const base = {
      type: AuthorizationType.OAUTH2 as const,
      issuerUrl: '',
      tokenUrl: flow.tokenUrl ?? '',
      clientId: '',
      clientSecret: '',
      scope: scopes.join(' '),
      clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
    };

    if (flow.authorizationUrl != null) {
      return {
        ...base,
        method: OAuth2Method.AUTHORIZATION_CODE,
        authorizationUrl: flow.authorizationUrl,
        callbackUrl: '',
      };
    }

    return {
      ...base,
      method: OAuth2Method.CLIENT_CREDENTIALS,
    };
  }

  private getOAuth2Flow(
    scheme: OpenAPIV2.SecuritySchemeObject | OpenApi3SecurityScheme
  ): OAuth2Flow | undefined {
    if ('flows' in scheme && scheme.flows != null) {
      return (
        scheme.flows.authorizationCode ??
        scheme.flows.clientCredentials ??
        scheme.flows.password ??
        scheme.flows.implicit
      );
    }

    if ('tokenUrl' in scheme || 'authorizationUrl' in scheme) {
      return scheme;
    }
  }

  private stringifyParameterValue(parameter: OpenAPIV2.ParameterObject | OpenApi3Parameter) {
    if ('example' in parameter && parameter.example != null) {
      return this.stringifyPrimitive(parameter.example);
    }
    if ('schema' in parameter && parameter.schema != null) {
      const schema = parameter.schema as { default?: unknown; example?: unknown };
      return this.stringifyPrimitive(schema.example ?? schema.default);
    }

    return undefined;
  }

  private stringifyExample(value: unknown) {
    if (value == null) return undefined;
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }

  private stringifyPrimitive(value: unknown) {
    if (value == null) return undefined;
    return typeof value === 'string' ? value : String(value);
  }

  private resolveServerUrl(server?: OpenAPIV3.ServerObject | OpenAPIV3_1.ServerObject) {
    return Object.entries(server?.variables ?? {}).reduce((url, [key, variable]) => {
      return url.replaceAll(`{${key}}`, variable.default);
    }, server?.url ?? '');
  }

  private completeBaseUrl(url: string) {
    const trimmed = url.trim();
    if (trimmed === '') return DEFAULT_BASE_URL;
    if (URL.canParse(trimmed)) return this.removeTrailingSlash(trimmed);
    if (trimmed.startsWith('//')) return this.removeTrailingSlash(`https:${trimmed}`);
    if (trimmed.startsWith('/')) return this.removeTrailingSlash(`${DEFAULT_BASE_URL}${trimmed}`);

    const firstSegment = trimmed.split('/')[0];
    if (firstSegment.includes('.') || firstSegment.includes(':')) {
      return this.removeTrailingSlash(`https://${trimmed}`);
    }

    return this.removeTrailingSlash(`${DEFAULT_BASE_URL}/${trimmed}`);
  }

  private joinUrl(baseUrl: string, pathTemplate: string) {
    if (URL.canParse(pathTemplate)) return pathTemplate;
    const normalizedPath = pathTemplate.startsWith('/') ? pathTemplate : `/${pathTemplate}`;
    return `${this.removeTrailingSlash(baseUrl)}${normalizedPath}`;
  }

  private removeTrailingSlash(value: string) {
    return value.replace(/\/+$/, '');
  }

  private isOpenApi3(document: OpenApiDocument): document is OpenApi3Document {
    return 'openapi' in document;
  }

  private isOperation(
    method: string,
    candidate: unknown
  ): candidate is OpenAPIV2.OperationObject | OpenApi3Operation {
    return HTTP_METHODS.has(method) && candidate != null && typeof candidate === 'object';
  }
}
