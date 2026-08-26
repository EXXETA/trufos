import { dereference } from '@readme/openapi-parser';
import { CollectionImporter } from './import-service';
import { importSecurity, ImportedSecurity } from './openapi-security';
import { createExampleGenerator, ExampleGenerator, ExampleSchema } from './schema-example';
import {
  completeBaseUrl,
  DEFAULT_BASE_URL,
  getEnvironmentKey,
  getSwaggerBaseUrl,
  joinUrl,
  resolveServerUrl,
} from './openapi-url';
import {
  getParameters,
  getTitle,
  importHeaders,
  importQueryParams,
  isOpenApi3,
  OpenApiDocument,
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
import { sanitizeVariableName } from 'shim/objects/variables';
import { uniqueName } from 'shim/string';
import { AuthorizationType } from 'shim';
import { randomUUID } from 'node:crypto';
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

const DEFAULT_MIME_TYPE = 'text/plain';
const JSON_MIME_TYPE = 'application/json';

/** The collection variable that holds the server URL all imported requests are sent to. */
const BASE_URL_VARIABLE = 'baseUrl';

/** The base URL that every imported request is built against: a template, not a URL. */
const BASE_URL_TEMPLATE = `{{${BASE_URL_VARIABLE}}}`;

/** Matches a path template parameter, e.g. the `{appId}` in `/apps/{appId}/versions`. */
const PATH_PARAMETER_REGEX = /\{([^{}/]*)\}/g;

type OpenApi3RequestBody = OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject;

/** Maps the lowercase method keys of OpenAPI path items to the request methods of Trufos. */
const HTTP_METHODS = new Map(
  Object.values(RequestMethod).map((method) => [method.toLowerCase(), method])
);

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
  private readonly pathVariableNames = new Map<string, string | undefined>();
  private readonly generateExample: ExampleGenerator;
  private readonly documentSecurity?: ImportedSecurity;

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
    this.generateExample = createExampleGenerator(document);
    this.documentSecurity = importSecurity(document, document.security);
  }

  public import(): TrufosCollection {
    // the document security applies to every operation that does not bring its own, so it becomes
    // the authorization of the collection and the operations inherit it
    this.collection.auth = this.documentSecurity?.auth;
    this.importServers();

    for (const [pathTemplate, pathItem] of Object.entries(this.document.paths ?? {})) {
      if (pathItem == null) continue;

      for (const [key, operationCandidate] of Object.entries(pathItem)) {
        const method = HTTP_METHODS.get(key);
        if (method == null || !isOperation(operationCandidate)) continue;

        const request = this.importOperation(pathTemplate, method, pathItem, operationCandidate);
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
    method: RequestMethod,
    pathItem: PathItem,
    operation: Operation
  ): TrufosRequest {
    const parameters = getParameters(pathItem, operation);

    // an operation without security of its own inherits the one of the document
    const inheritsSecurity = operation.security == null;
    const security = inheritsSecurity
      ? this.documentSecurity
      : importSecurity(this.document, operation.security);

    return {
      id: randomUUID(),
      parentId: this.collection.id,
      type: 'request',
      lastModified: Date.now(),
      title: getTitle(operation, pathTemplate),
      url: {
        ...parseUrl(joinUrl(BASE_URL_TEMPLATE, this.importPathTemplate(pathTemplate, parameters))),
        query: importQueryParams(parameters).concat(security?.query ?? []),
      },
      headers: importHeaders(parameters).concat(security?.headers ?? []),
      method,
      body: this.importBody(operation),
      auth: inheritsSecurity ? { type: AuthorizationType.INHERIT } : security?.auth,
    };
  }

  /**
   * Converts the OpenAPI path template syntax `{appId}` into the Trufos template variable syntax
   * `{{appId}}` and declares each parameter as a collection variable, so that the templates in
   * the imported URL resolve to something. The variables are derived from the path template rather
   * than from the parameter list, because specs in the wild use parameters they never declare.
   * Already known variables are kept, as the same parameter usually appears in many operations.
   * Parameters that cannot be a variable stay literal.
   * @param pathTemplate the path of the operation, e.g. `/apps/{appId}/versions`
   * @param parameters the parameters of the operation, used as source of values and descriptions
   * @returns the path with all of its parameters in Trufos template variable syntax
   */
  private importPathTemplate(pathTemplate: string, parameters: Parameter[]): string {
    return pathTemplate.replace(PATH_PARAMETER_REGEX, (parameter, parameterName: string) => {
      const name = this.getPathVariableName(parameterName);
      if (name == null) return parameter;

      if (this.collection.variables[name] == null) {
        const declared = parameters.find(
          (candidate) => candidate.in === 'path' && candidate.name === parameterName
        );
        this.collection.variables[name] = {
          value: (declared == null ? undefined : stringifyParameterValue(declared)) ?? '',
          description: declared?.description,
        };
      }

      return `{{${name}}}`;
    });
  }

  /**
   * Maps a path parameter to the variable it is imported as. Names that Trufos does not allow are
   * sanitized, e.g. `app.id` becomes `app-id`; distinct parameters that sanitize to the same name
   * get a counter suffix, so that they never silently share one variable. The mapping is cached,
   * because URL rewriting and variable declaration must agree on it across all operations.
   * @param parameterName the name of the path parameter, e.g. `app.id`
   * @returns the variable name, or undefined if the parameter has to stay literal
   */
  private getPathVariableName(parameterName: string): string | undefined {
    if (this.pathVariableNames.has(parameterName)) {
      return this.pathVariableNames.get(parameterName);
    }

    const baseName = sanitizeVariableName(parameterName);
    if (baseName == null) {
      logger.warn(`Path parameter {${parameterName}} stays literal in imported URLs`);
      this.pathVariableNames.set(parameterName, undefined);
      return undefined;
    }

    // unique within the whole variable namespace, so that a parameter can never annex a variable
    // that someone else owns, e.g. the baseUrl variable holding the server URL
    const name = uniqueName(baseName, (candidate) => this.collection.variables[candidate] != null);
    this.pathVariableNames.set(parameterName, name);
    return name;
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
      const key = uniqueName(
        getEnvironmentKey(server),
        (candidate) => this.collection.environments[candidate] !== undefined
      );
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
        text: stringifyExample(
          bodyParameter.example ?? this.generateExample(bodyParameter.schema as ExampleSchema)
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
      text: stringifyExample(
        mediaType?.example ?? this.generateExample(mediaType?.schema as ExampleSchema | undefined)
      ),
    };
  }
}

/**
 * @param candidate the value of an HTTP method key of a path item, an operation object per spec
 * @returns true if the candidate is an object, guarding against malformed documents
 */
function isOperation(candidate: unknown): candidate is Operation {
  return candidate != null && typeof candidate === 'object';
}
