import { dereference } from '@readme/openapi-parser';
import { CollectionImporter } from './import-service';
import { importSecurity, ImportedSecurity } from './openapi-security';
import { createExampleGenerator, ExampleGenerator } from './schema-example';
import {
  completeBaseUrl,
  DEFAULT_BASE_URL,
  getEnvironmentKey,
  getSwaggerBaseUrl,
  joinUrl,
  PATH_PARAMETER_REGEX,
  resolveServerUrl,
  toTemplateVariables,
} from './openapi-url';
import {
  getParameters,
  getTitle,
  importHeaders,
  importQueryParam,
  Operation,
  Parameter,
  PathItem,
  stringifyExample,
  stringifyParameterValue,
} from './openapi-values';
import { Collection as TrufosCollection } from 'shim/objects/collection';
import { Folder as TrufosFolder } from 'shim/objects/folder';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { parseUrl } from 'shim/objects/url';
import { VARIABLE_NAME_REGEX } from 'shim/objects/variables';
import { AuthorizationType } from 'shim';
import { randomUUID } from 'node:crypto';
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

const DEFAULT_MIME_TYPE = 'text/plain';
const JSON_MIME_TYPE = 'application/json';

/** The collection variable that holds the server URL all imported requests are sent to. */
const BASE_URL_VARIABLE = 'baseUrl';

/** The base URL that every imported request is built against: a template, not a URL. */
const BASE_URL_TEMPLATE = `{{${BASE_URL_VARIABLE}}}`;

type OpenApiDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document;
type OpenApi3Document = OpenAPIV3.Document | OpenAPIV3_1.Document;
type OpenApi3RequestBody = OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject;

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
 * One import run: the assembly of the collection, its folders, variables and environments. The
 * document and the collection being built live here as fields, so that no method has to thread
 * them through its signature; everything stateless lives in the openapi-* modules next door.
 * Instances are single-use.
 */
class OpenApiImport {
  private readonly collection: TrufosCollection;
  private readonly foldersByTag = new Map<string, TrufosFolder>();
  private generateExample!: ExampleGenerator;
  private documentSecurity?: ImportedSecurity;

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
  }

  public import() {
    // the document security applies to every operation that does not bring its own, so it becomes
    // the authorization of the collection and the operations inherit it
    this.documentSecurity = importSecurity(this.document, this.document.security);
    this.collection.auth = this.documentSecurity?.auth;

    this.generateExample = createExampleGenerator(this.document);
    this.importServers();

    for (const [pathTemplate, pathItem] of Object.entries(this.document.paths ?? {})) {
      if (pathItem == null) continue;

      for (const [method, operationCandidate] of Object.entries(pathItem)) {
        if (!isOperation(method, operationCandidate)) continue;

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
    const parameters = getParameters(pathItem, operation);
    const query = parameters
      .filter((parameter) => parameter.in === 'query')
      .map((parameter) => importQueryParam(parameter));

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
      title: getTitle(operation, pathTemplate),
      url: {
        ...parseUrl(joinUrl(BASE_URL_TEMPLATE, toTemplateVariables(pathTemplate))),
        query: query.concat(security?.query ?? []),
      },
      headers: importHeaders(parameters).concat(security?.headers ?? []),
      method: method.toUpperCase() as RequestMethod,
      body: this.importBody(operation),
      auth: inheritsSecurity ? { type: AuthorizationType.INHERIT } : security?.auth,
    };
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
        value: (parameter == null ? undefined : stringifyParameterValue(parameter)) ?? '',
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
   */
  private importServers() {
    const servers = isOpenApi3(this.document)
      ? (this.document.servers ?? []).map((server) => ({
          url: completeBaseUrl(resolveServerUrl(server)),
          description: server.description,
        }))
      : [{ url: getSwaggerBaseUrl(this.document), description: undefined }];

    this.collection.variables[BASE_URL_VARIABLE] = { value: servers[0]?.url ?? DEFAULT_BASE_URL };
    if (servers.length < 2) return;

    for (const server of servers) {
      const key = getUniqueKey(this.collection.environments, getEnvironmentKey(server));
      this.collection.environments[key] = {
        variables: { [BASE_URL_VARIABLE]: { value: server.url } },
      };
    }
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
        text: stringifyExample(bodyParameter.example ?? this.generateExample(bodyParameter.schema)),
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
      text: stringifyExample(mediaType?.example ?? this.generateExample(mediaType?.schema)),
    };
  }
}

/**
 * @param existing the entries that the key must not collide with
 * @param key the desired key
 * @returns the key itself, or the key with a counter appended if it is already taken
 */
function getUniqueKey(existing: Record<string, unknown>, key: string) {
  if (existing[key] === undefined) return key;

  let counter = 2;
  while (existing[`${key}-${counter}`] !== undefined) counter++;
  return `${key}-${counter}`;
}

function isOpenApi3(document: OpenApiDocument): document is OpenApi3Document {
  return 'openapi' in document;
}

function isOperation(method: string, candidate: unknown): candidate is Operation {
  return HTTP_METHODS.has(method) && candidate != null && typeof candidate === 'object';
}
