import { dereference } from '@readme/openapi-parser';
import { CollectionImporter } from './import-service';
import { Collection as TrufosCollection } from 'shim/objects/collection';
import { Folder as TrufosFolder } from 'shim/objects/folder';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { parseUrl } from 'shim/objects/url';
import { TrufosHeader } from 'shim/objects/headers';
import {
  AuthorizationInformation,
  AuthorizationType,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
} from 'shim';
import { randomUUID } from 'node:crypto';
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

const DEFAULT_MIME_TYPE = 'text/plain';
const JSON_MIME_TYPE = 'application/json';
const DEFAULT_BASE_URL = 'http://localhost';

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
      description: document.info.description,
      dirPath: '',
      children: [],
      variables: {},
      environments: {},
    };

    this.importPaths(collection, document);
    return collection;
  }

  private importPaths(collection: TrufosCollection, document: OpenApiDocument) {
    const foldersByTag = new Map<string, TrufosFolder>();
    const baseUrl = this.getBaseUrl(document);

    for (const [pathTemplate, pathItem] of Object.entries(document.paths ?? {})) {
      if (pathItem == null) continue;

      for (const [method, operationCandidate] of Object.entries(pathItem)) {
        if (!this.isOperation(method, operationCandidate)) continue;

        const request = this.importOperation(
          collection.id,
          baseUrl,
          pathTemplate,
          method as Lowercase<RequestMethod>,
          pathItem,
          operationCandidate,
          document
        );
        const firstTag = operationCandidate.tags?.[0];
        if (firstTag == null || firstTag.trim() === '') {
          collection.children.push(request);
          continue;
        }

        const folder = this.getOrCreateFolder(collection, foldersByTag, firstTag, document);
        request.parentId = folder.id;
        folder.children.push(request);
      }
    }
  }

  private importOperation(
    parentId: string,
    baseUrl: string,
    pathTemplate: string,
    method: Lowercase<RequestMethod>,
    pathItem: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject | OpenAPIV3_1.PathItemObject,
    operation: OpenAPIV2.OperationObject | OpenApi3Operation,
    document: OpenApiDocument
  ): TrufosRequest {
    const parameters = this.getParameters(pathItem, operation);
    const query = parameters
      .filter((parameter) => parameter.in === 'query')
      .map((parameter) => ({
        key: parameter.name,
        value: this.stringifyParameterValue(parameter) ?? '',
        isActive: true,
      }));

    return {
      id: randomUUID(),
      parentId,
      type: 'request',
      lastModified: Date.now(),
      title:
        operation.summary || operation.operationId || `${method.toUpperCase()} ${pathTemplate}`,
      description: operation.description,
      url: {
        ...parseUrl(this.joinUrl(baseUrl, pathTemplate)),
        query,
      },
      headers: this.importHeaders(parameters),
      method: method.toUpperCase() as RequestMethod,
      body: this.importBody(operation),
      auth: this.importAuth(document, operation),
    };
  }

  private getOrCreateFolder(
    collection: TrufosCollection,
    foldersByTag: Map<string, TrufosFolder>,
    tag: string,
    document: OpenApiDocument
  ) {
    let folder = foldersByTag.get(tag);
    if (folder != null) return folder;

    const tagDescription = document.tags?.find((candidate) => candidate.name === tag)?.description;

    folder = {
      id: randomUUID(),
      parentId: collection.id,
      type: 'folder',
      lastModified: Date.now(),
      title: tag,
      description: tagDescription,
      children: [],
    };
    foldersByTag.set(tag, folder);
    collection.children.push(folder);
    return folder;
  }

  private getBaseUrl(document: OpenApiDocument) {
    if (this.isOpenApi3(document)) {
      return this.completeBaseUrl(this.resolveServerUrl(document.servers?.[0]));
    }

    const scheme = document.schemes?.[0] ?? 'https';
    const host = document.host ?? '';
    const basePath = document.basePath ?? '';
    return this.completeBaseUrl(host === '' ? basePath : `${scheme}://${host}${basePath}`);
  }

  private getParameters(
    pathItem: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject | OpenAPIV3_1.PathItemObject,
    operation: OpenAPIV2.OperationObject | OpenApi3Operation
  ) {
    return [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].filter(
      (parameter) => parameter != null && 'name' in parameter && 'in' in parameter
    ) as Array<OpenAPIV2.ParameterObject | OpenApi3Parameter>;
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

  private importBody(operation: OpenAPIV2.OperationObject | OpenApi3Operation): RequestBody {
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
        text: this.stringifyExample(bodyParameter.example),
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
      text: this.stringifyExample(mediaType?.example),
    };
  }

  private importAuth(
    document: OpenApiDocument,
    operation: OpenAPIV2.OperationObject | OpenApi3Operation
  ): AuthorizationInformation | undefined {
    const securityRequirement = operation.security?.[0] ?? document.security?.[0];
    const schemeName = Object.keys(securityRequirement ?? {})[0];
    if (schemeName == null) return;

    const scheme = this.getSecurityScheme(document, schemeName);
    if (scheme == null) return;

    if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'basic') {
      return { type: AuthorizationType.BASIC, username: '', password: '' };
    }
    if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer') {
      return { type: AuthorizationType.BEARER, token: '' };
    }
    if (scheme.type === 'basic') {
      return { type: AuthorizationType.BASIC, username: '', password: '' };
    }
    if (scheme.type === 'oauth2') {
      return this.importOAuth2Auth(scheme, securityRequirement?.[schemeName] ?? []);
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
  ): AuthorizationInformation | undefined {
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
