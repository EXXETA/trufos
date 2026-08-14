import { dereference } from '@readme/openapi-parser';
import { CollectionImporter } from './import-service';
import { importSecurity, ImportedSecurity } from './openapi-security';
import { createExampleGenerator, ExampleGenerator } from './schema-example';
import { Collection as TrufosCollection } from 'shim/objects/collection';
import { Folder as TrufosFolder } from 'shim/objects/folder';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { parseUrl } from 'shim/objects/url';
import { TrufosQueryParam } from 'shim/objects/query-param';
import { VARIABLE_NAME_REGEX } from 'shim/objects/variables';
import { truncate } from 'shim/string';
import { TrufosHeader } from 'shim/objects/headers';
import { AuthorizationType } from 'shim';
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
type PathItem = OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject | OpenAPIV3_1.PathItemObject;
type Operation = OpenAPIV2.OperationObject | OpenApi3Operation;
type Parameter = OpenAPIV2.ParameterObject | OpenApi3Parameter;

const HTTP_METHODS = new Set(Object.values(RequestMethod).map((method) => method.toLowerCase()));

export class OpenApiImporter implements CollectionImporter {
  public async importCollection(srcFilePath: string) {
    const document = (await dereference(srcFilePath, {
      dereference: { circular: 'ignore' },
    })) as OpenApiDocument;

    return new OpenApiImport(document).import();
  }
}

/**
 * One import run. The document, the collection being built, and everything that is derived from
 * the document once (base URL, document security, example generator) live here as fields, so that
 * no method has to thread them through its signature. Instances are single-use.
 */
class OpenApiImport {
  private readonly collection: TrufosCollection;
  private readonly baseUrl: string;
  private readonly documentSecurity?: ImportedSecurity;
  private readonly generateExample: ExampleGenerator;
  private readonly foldersByTag = new Map<string, TrufosFolder>();

  constructor(private readonly document: OpenApiDocument) {
    this.collection = {
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
    this.documentSecurity = importSecurity(document, document.security);
    this.collection.auth = this.documentSecurity?.auth;

    this.baseUrl = this.importServers();
    this.generateExample = createExampleGenerator(document);
  }

  public import() {
    for (const [pathTemplate, pathItem] of Object.entries(this.document.paths ?? {})) {
      if (pathItem == null) continue;

      for (const [method, operationCandidate] of Object.entries(pathItem)) {
        if (!this.isOperation(method, operationCandidate)) continue;

        const request = this.importOperation(
          pathTemplate,
          method as Lowercase<RequestMethod>,
          pathItem,
          operationCandidate
        );
        const firstTag = operationCandidate.tags?.[0];
        if (firstTag == null || firstTag.trim() === '') {
          this.collection.children.push(request);
          continue;
        }

        const folder = this.getOrCreateFolder(firstTag);
        request.parentId = folder.id;
        folder.children.push(request);
      }
    }

    return this.collection;
  }

  private importOperation(
    pathTemplate: string,
    method: Lowercase<RequestMethod>,
    pathItem: PathItem,
    operation: Operation
  ): TrufosRequest {
    const parameters = this.getParameters(pathItem, operation);
    const query = parameters
      .filter((parameter) => parameter.in === 'query')
      .map((parameter) => this.importQueryParam(parameter));

    // an operation without security of its own inherits the one of the document
    const inheritsSecurity = operation.security == null;
    const security = inheritsSecurity
      ? this.documentSecurity
      : importSecurity(this.document, operation.security);

    this.importPathVariables(pathTemplate, parameters);

    return {
      id: randomUUID(),
      parentId: this.collection.id,
      type: 'request',
      lastModified: Date.now(),
      title: this.getTitle(operation, pathTemplate),
      url: {
        ...parseUrl(this.joinUrl(this.baseUrl, this.toTemplateVariables(pathTemplate))),
        query: query.concat(security?.query ?? []),
      },
      headers: this.importHeaders(parameters).concat(security?.headers ?? []),
      method: method.toUpperCase() as RequestMethod,
      body: this.importBody(operation),
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
  private getTitle(operation: Operation, pathTemplate: string): string {
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
   * @param pathTemplate the path of the operation, e.g. `/apps/{appId}/versions`
   * @param parameters the parameters of the operation, used as source of values and descriptions
   */
  private importPathVariables(pathTemplate: string, parameters: Parameter[]) {
    for (const [, name] of pathTemplate.matchAll(PATH_PARAMETER_REGEX)) {
      if (!VARIABLE_NAME_REGEX.test(name) || this.collection.variables[name] != null) continue;

      const parameter = parameters.find(
        (parameter) => parameter.in === 'path' && parameter.name === name
      );
      this.collection.variables[name] = {
        value: (parameter == null ? undefined : this.stringifyParameterValue(parameter)) ?? '',
        description: parameter?.description,
      };
    }
  }

  private getOrCreateFolder(tag: string) {
    let folder = this.foldersByTag.get(tag);
    if (folder != null) return folder;

    folder = {
      id: randomUUID(),
      parentId: this.collection.id,
      type: 'folder',
      lastModified: Date.now(),
      title: tag,
      children: [],
    };
    this.foldersByTag.set(tag, folder);
    this.collection.children.push(folder);
    return folder;
  }

  /**
   * Imports the servers of the document. Requests are built against a {@link BASE_URL_VARIABLE}
   * variable instead of the server URL itself, so that the whole collection can be pointed at
   * another installation by editing one value. Documents that list more than one server get an
   * environment per server on top, which makes switching between them a single click.
   * @returns the base URL to build the request URLs with
   */
  private importServers() {
    const servers = this.getServers();
    this.collection.variables[BASE_URL_VARIABLE] = { value: servers[0].url };

    if (servers.length > 1) {
      for (const server of servers) {
        const key = this.getUniqueKey(this.collection.environments, server.key);
        this.collection.environments[key] = {
          variables: { [BASE_URL_VARIABLE]: { value: server.url } },
        };
      }
    }

    return `{{${BASE_URL_VARIABLE}}}`;
  }

  /**
   * @returns the servers of the document as absolute URLs, at least one
   */
  private getServers() {
    const urls = this.isOpenApi3(this.document)
      ? (this.document.servers ?? []).map((server) => ({
          url: this.completeBaseUrl(this.resolveServerUrl(server)),
          description: server.description,
        }))
      : [{ url: this.getSwaggerBaseUrl(this.document), description: undefined }];

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

  private getParameters(pathItem: PathItem, operation: Operation) {
    return [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].filter(
      (parameter) => parameter != null && 'name' in parameter && 'in' in parameter
    ) as Parameter[];
  }

  /**
   * Imports a query parameter. Optional parameters that the spec gives no value for are imported
   * as inactive, because sending them empty (`?search=&filter=`) is not what the endpoint expects
   * and specs commonly declare dozens of optional parameters per operation.
   * @param parameter the query parameter to import
   * @returns the query parameter of the request
   */
  private importQueryParam(parameter: Parameter): TrufosQueryParam {
    const value = this.stringifyParameterValue(parameter) ?? '';
    return { key: parameter.name, value, isActive: parameter.required === true || value !== '' };
  }

  private importHeaders(parameters: Parameter[]): TrufosHeader[] {
    return parameters
      .filter((parameter) => parameter.in === 'header')
      .map((parameter) => ({
        key: parameter.name,
        value: this.stringifyParameterValue(parameter) ?? '',
        isActive: true,
      }));
  }

  private importBody(operation: Operation): RequestBody {
    if ('requestBody' in operation && operation.requestBody != null) {
      return this.importOpenApi3Body(operation.requestBody as OpenApi3RequestBody);
    }

    const bodyParameter = (operation.parameters ?? []).find(
      (parameter) => parameter != null && 'in' in parameter && parameter.in === 'body'
    ) as OpenAPIV2.InBodyParameterObject | undefined;
    if (bodyParameter != null) {
      return {
        type: RequestBodyType.TEXT,
        mimeType: JSON_MIME_TYPE,
        text: this.stringifyExample(
          bodyParameter.example ?? this.generateExample(bodyParameter.schema)
        ),
      };
    }

    return {
      type: RequestBodyType.TEXT,
      mimeType: DEFAULT_MIME_TYPE,
    };
  }

  private importOpenApi3Body(requestBody: OpenApi3RequestBody): RequestBody {
    const [mimeType, mediaType] = Object.entries(requestBody.content ?? {})[0] ?? [
      DEFAULT_MIME_TYPE,
      undefined,
    ];

    return {
      type: RequestBodyType.TEXT,
      mimeType,
      text: this.stringifyExample(mediaType?.example ?? this.generateExample(mediaType?.schema)),
    };
  }

  private stringifyParameterValue(parameter: Parameter) {
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

  private isOperation(method: string, candidate: unknown): candidate is Operation {
    return HTTP_METHODS.has(method) && candidate != null && typeof candidate === 'object';
  }
}
