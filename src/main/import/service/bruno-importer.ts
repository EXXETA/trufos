import { CollectionImporter } from './import-service.js';
import { bruToJsonV2, bruToEnvJsonV2, BrunoAuth, BrunoRequest } from '@usebruno/lang';
import { Collection as TrufosCollection } from 'shim/objects/collection';
import { Folder as TrufosFolder } from 'shim/objects/folder';
import { FormDataBody, RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { parseUrl } from 'shim/objects/url';
import { RequestMethod } from 'shim/objects/request-method';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { VARIABLE_NAME_REGEX, VariableObject } from 'shim/objects/variables';
import {
  AuthorizationType,
  OAuth2AuthorizationInformation,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
  OAuth2PKCECodeChallengeMethod,
  Oauth2BaseAuthorizationInformation,
} from 'shim';

const DEFAULT_MIME_TYPE = 'text/plain';

/** Maps Bruno body type strings to HTTP MIME types. */
const BODY_MIME_TYPES: Record<string, string> = {
  json: 'application/json',
  text: 'text/plain',
  xml: 'application/xml',
  formUrlEncoded: 'application/x-www-form-urlencoded',
};

/** Directories to skip when walking the collection tree. */
const IGNORED_DIRS = new Set(['environments', 'node_modules']);

interface BrunoJson {
  name: string;
  uid?: string;
  version?: string;
}

/**
 * An importer for Bruno collections. A Bruno collection is a directory containing a
 * `bruno.json` metadata file, `.bru` request files and optional subdirectories (folders).
 * An optional `environments/` subdirectory may contain `.bru` environment files.
 * Items are ordered according to their `seq` field in the meta block.
 */
export class BrunoImporter implements CollectionImporter {
  public async importCollection(srcFilePath: string): Promise<TrufosCollection> {
    // Accept either the collection directory or the bruno.json file
    const stat = await fs.stat(srcFilePath);
    const collectionDir = stat.isDirectory() ? srcFilePath : path.dirname(srcFilePath);

    // Read collection metadata
    const brunoJsonPath = path.join(collectionDir, 'bruno.json');
    const brunoJson = JSON.parse(await fs.readFile(brunoJsonPath, 'utf8')) as BrunoJson;
    logger.info('Importing Bruno collection:', brunoJson.name);

    const collection: TrufosCollection = {
      id: brunoJson.uid ?? crypto.randomUUID(),
      type: 'collection',
      lastModified: Date.now(),
      title: brunoJson.name,
      dirPath: '', // must be set after import
      children: [],
      variables: {},
      environments: await this.importEnvironments(collectionDir),
    };

    await this.importDirectory(collection, collectionDir);
    return collection;
  }

  private async importEnvironments(
    collectionDir: string
  ): Promise<TrufosCollection['environments']> {
    const environmentsDir = path.join(collectionDir, 'environments');
    const environments: TrufosCollection['environments'] = {};

    try {
      const files = await fs.readdir(environmentsDir);
      for (const file of files.sort()) {
        if (!file.endsWith('.bru')) continue;
        const content = await fs.readFile(path.join(environmentsDir, file), 'utf8');
        const parsed = bruToEnvJsonV2(content);
        const envName = path.basename(file, '.bru');
        const variables: Record<string, VariableObject> = {};
        for (const v of parsed.variables) {
          if (v.enabled && VARIABLE_NAME_REGEX.test(v.name)) {
            variables[v.name] = { value: v.value };
          }
        }
        if (Object.keys(variables).length > 0) {
          environments[envName] = { variables };
        }
      }
    } catch {
      // environments/ directory may not exist — that's fine
    }

    return environments;
  }

  private async importDirectory(
    parent: TrufosCollection | TrufosFolder,
    dirPath: string
  ): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    type SortableEntry = { seq: number; name: string };
    const requests: (SortableEntry & { parsed: BrunoRequest })[] = [];
    const folders: (SortableEntry & { fullPath: string })[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'bruno.json') continue;

      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        folders.push({ seq: Infinity, name: entry.name, fullPath });
      } else if (entry.isFile() && entry.name.endsWith('.bru')) {
        const content = await fs.readFile(fullPath, 'utf8');
        const parsed = bruToJsonV2(content);
        const seq = parsed.meta?.seq != null ? parseInt(parsed.meta.seq, 10) : Infinity;
        requests.push({ seq, name: entry.name, parsed });
      }
    }

    const bySeqThenName = (a: SortableEntry, b: SortableEntry) =>
      a.seq - b.seq || a.name.localeCompare(b.name);

    for (const { parsed } of requests.sort(bySeqThenName)) {
      this.importRequest(parent, parsed);
    }

    for (const { name, fullPath } of folders.sort(bySeqThenName)) {
      await this.importFolder(parent, name, fullPath);
    }
  }

  private async importFolder(
    parent: TrufosCollection | TrufosFolder,
    name: string,
    dirPath: string
  ): Promise<void> {
    const folder: TrufosFolder = {
      id: crypto.randomUUID(),
      parentId: parent.id,
      type: 'folder',
      lastModified: Date.now(),
      title: name,
      children: [],
    };

    await this.importDirectory(folder, dirPath);
    parent.children.push(folder);
  }

  private importRequest(parent: TrufosCollection | TrufosFolder, brunoRequest: BrunoRequest): void {
    const { meta, http, headers = [], params = [], body, auth } = brunoRequest;

    const parsedUrl = parseUrl(http.url ?? '');
    const extraQueryParams = params
      .filter((p) => p.type === 'query')
      .map((p) => ({ key: p.name, value: p.value, isActive: p.enabled }));
    parsedUrl.query = [...parsedUrl.query, ...extraQueryParams];

    const trufosRequest: TrufosRequest = {
      id: crypto.randomUUID(),
      parentId: parent.id,
      type: 'request',
      lastModified: Date.now(),
      title: meta.name,
      url: parsedUrl,
      method: (http.method?.toUpperCase() as RequestMethod) ?? RequestMethod.GET,
      headers: headers.map((h) => ({
        key: h.name,
        value: h.value,
        isActive: h.enabled,
      })),
      body: this.importBody(http.body, body),
      auth: this.importAuth(http.auth, auth),
    };

    parent.children.push(trufosRequest);
  }

  private importBody(
    bodyType: string | undefined,
    body: BrunoRequest['body']
  ): RequestBody {
    switch (bodyType) {
      case 'json':
        return {
          type: RequestBodyType.TEXT,
          mimeType: BODY_MIME_TYPES.json,
          text: body?.json,
        };
      case 'text':
        return {
          type: RequestBodyType.TEXT,
          mimeType: BODY_MIME_TYPES.text,
          text: body?.text,
        };
      case 'xml':
        return {
          type: RequestBodyType.TEXT,
          mimeType: BODY_MIME_TYPES.xml,
          text: body?.xml,
        };
      case 'multipartForm': {
        const fields = body?.multipartForm ?? [];
        return {
          type: RequestBodyType.FORM_DATA,
          fields: fields.map((f) => ({
            key: f.name,
            isActive: f.enabled,
            value:
              f.type === 'file'
                ? { type: RequestBodyType.FILE, filePath: f.value }
                : { type: RequestBodyType.TEXT, mimeType: DEFAULT_MIME_TYPE, text: f.value },
          })),
        } satisfies FormDataBody;
      }
      case 'formUrlEncoded':
        return {
          type: RequestBodyType.TEXT,
          mimeType: BODY_MIME_TYPES.formUrlEncoded,
          text: body?.formUrlEncoded?.map((f) => `${f.name}=${f.value}`).join('&'),
        };
      case 'file':
        return { type: RequestBodyType.FILE };
      default:
        return { type: RequestBodyType.TEXT, mimeType: DEFAULT_MIME_TYPE };
    }
  }

  private importAuth(
    authType: string | undefined,
    auth: BrunoAuth | undefined
  ): TrufosRequest['auth'] {
    if (authType === 'inherit') {
      return { type: AuthorizationType.INHERIT };
    }

    if (auth == null) return;

    if (auth.bearer != null) {
      return {
        type: AuthorizationType.BEARER,
        token: auth.bearer.token ?? '',
      };
    }

    if (auth.basic != null) {
      return {
        type: AuthorizationType.BASIC,
        username: auth.basic.username ?? '',
        password: auth.basic.password ?? '',
      };
    }

    if (auth.oauth2 != null) {
      return this.importOAuth2(auth.oauth2);
    }

    return;
  }

  private importOAuth2(
    oauth2: NonNullable<BrunoAuth['oauth2']>
  ): OAuth2AuthorizationInformation | undefined {
    const base: Omit<Oauth2BaseAuthorizationInformation, 'method'> = {
      type: AuthorizationType.OAUTH2,
      issuerUrl: '',
      tokenUrl: oauth2.accessTokenUrl ?? '',
      clientId: oauth2.clientId ?? '',
      clientSecret: oauth2.clientSecret ?? '',
      scope: oauth2.scope ?? '',
      clientAuthenticationMethod:
        oauth2.credentialsPlacement === 'body'
          ? OAuth2ClientAuthenticationMethod.REQUEST_BODY
          : OAuth2ClientAuthenticationMethod.BASIC_AUTH,
    };

    switch (oauth2.grantType) {
      case 'client_credentials':
        return { ...base, method: OAuth2Method.CLIENT_CREDENTIALS };
      case 'authorization_code':
        if (oauth2.pkce) {
          return {
            ...base,
            method: OAuth2Method.AUTHORIZATION_CODE_PKCE,
            authorizationUrl: oauth2.authorizationUrl ?? '',
            callbackUrl: oauth2.callbackUrl ?? '',
            codeChallengeMethod: OAuth2PKCECodeChallengeMethod.S256,
          };
        }
        return {
          ...base,
          method: OAuth2Method.AUTHORIZATION_CODE,
          authorizationUrl: oauth2.authorizationUrl ?? '',
          callbackUrl: oauth2.callbackUrl ?? '',
        };
      default:
        logger.warn('Unsupported OAuth2 grant type while importing from Bruno:', oauth2.grantType);
        return;
    }
  }
}
