import { CollectionImporter } from './import-service';
import {
  Collection as PostmanCollection,
  CollectionDefinition,
  Item,
  ItemGroup,
  RequestAuth as PostmanRequestAuth,
} from 'postman-collection';
import { Collection as TrufosCollection } from 'shim/objects/collection';
import { Folder as TrufosFolder } from 'shim/objects/folder';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { parseUrl } from 'shim/objects/url';
import { RequestMethod } from 'shim/objects/request-method';
import fs from 'node:fs/promises';
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

/**
 * An importer for Postman collections. It will import the collection and all of its variables,
 * folders and requests. It imports using the DFS algorithm.
 */
export class PostmanImporter implements CollectionImporter {
  public async importCollection(srcFilePath: string) {
    // read Postman collection
    const json = JSON.parse(await fs.readFile(srcFilePath, 'utf8')) as CollectionDefinition;
    const postmanCollection = new PostmanCollection(json);
    const variablesArray = postmanCollection.variables
      .all()
      .filter((variable) => variable.id !== undefined && VARIABLE_NAME_REGEX.test(variable.id))
      .map(
        (variable) =>
          [
            variable.id,
            {
              value: variable.toString(),
            } as VariableObject,
          ] as const
      );
    logger.info('Loaded', variablesArray.length, 'collection variables');

    const variables: Record<string, VariableObject> = {};
    variablesArray.forEach(([key, val]) => (variables[key] = val));

    const collection: TrufosCollection = {
      id: postmanCollection.id,
      type: 'collection',
      lastModified: Date.now(),
      title: postmanCollection.name,
      dirPath: '', // must be set after import
      children: [],
      variables,
      environments: {},
    };

    // import children
    this.importItems(collection, postmanCollection.items.all());
    return collection;
  }

  private importItems(parent: TrufosCollection | TrufosFolder, items: (Item | ItemGroup<Item>)[]) {
    for (const item of items) {
      if (item instanceof ItemGroup) {
        this.importFolder(parent, item);
      } else if (item instanceof Item) {
        this.importRequest(parent, item);
      }
    }
  }

  private importFolder(parent: TrufosCollection | TrufosFolder, postmanFolder: ItemGroup<Item>) {
    const folder: TrufosFolder = {
      id: postmanFolder.id,
      parentId: parent.id,
      type: 'folder',
      lastModified: Date.now(),
      title: postmanFolder.name,
      children: [],
    };

    this.importItems(folder, postmanFolder.items.all());
    parent.children.push(folder);
  }

  private importRequest(parent: TrufosCollection | TrufosFolder, item: Item) {
    const { request } = item;

    let bodyInfo: RequestBody | null = null;
    if (request.body != null) {
      switch (request.body.mode) {
        case 'file':
          bodyInfo = {
            type: RequestBodyType.FILE,
            filePath: request.body.file?.src,
          };
          break;
        case 'raw':
          bodyInfo = {
            type: RequestBodyType.TEXT,
            text: request.body.raw,
            mimeType: request.headers.get('Content-Type') ?? DEFAULT_MIME_TYPE,
          };
          break;
      }
    }

    const trufosRequest: TrufosRequest = {
      id: item.id,
      parentId: parent.id,
      type: 'request',
      lastModified: Date.now(),
      title: item.name,
      url: parseUrl(request.url.toString()),
      headers: request.headers.all().map((header) => ({
        key: header.key,
        value: header.value,
        isActive: !header.disabled,
      })),
      method: request.method as RequestMethod,
      body: bodyInfo ?? {
        type: RequestBodyType.TEXT,
        mimeType: DEFAULT_MIME_TYPE,
      },
      auth: this.importAuth(request.auth),
    };

    parent.children.push(trufosRequest);
  }

  private importAuth(postmanAuth?: PostmanRequestAuth): TrufosRequest['auth'] {
    if (postmanAuth == null) return;

    const parameters = new Map<string, string>();
    for (const param of postmanAuth.parameters().all()) {
      if (param.key != null && param.key !== '') parameters.set(param.key, param.value);
    }

    switch (postmanAuth.type) {
      case 'basic':
        return {
          type: AuthorizationType.BASIC,
          username: parameters.get('username') ?? '',
          password: parameters.get('password') ?? '',
        };
      case 'bearer':
        return {
          type: AuthorizationType.BEARER,
          token: parameters.get('token') ?? '',
        };
      case 'oauth2': {
        return this.importOAuth2(parameters);
      }
      default:
        logger.warn('Unsupported auth type while importing from Postman:', postmanAuth.type);
        return;
    }
  }

  private importOAuth2(
    parameters: Map<string, string>
  ): OAuth2AuthorizationInformation | undefined {
    const base: Omit<Oauth2BaseAuthorizationInformation, 'method'> = {
      type: AuthorizationType.OAUTH2,
      issuerUrl: '',
      tokenUrl: parameters.get('accessTokenUrl') ?? '',
      clientId: parameters.get('clientId') ?? '',
      clientSecret: parameters.get('clientSecret') ?? '',
      scope: parameters.get('scope') ?? '',
      clientAuthenticationMethod:
        parameters.get('client_authentication') === 'body'
          ? OAuth2ClientAuthenticationMethod.REQUEST_BODY
          : OAuth2ClientAuthenticationMethod.BASIC_AUTH,
    };

    switch (parameters.get('grant_type')) {
      case 'authorization_code':
        return {
          ...base,
          method: OAuth2Method.AUTHORIZATION_CODE,
          authorizationUrl: parameters.get('authUrl') ?? '',
          callbackUrl: parameters.get('redirect_uri') ?? '',
        };
      case 'authorization_code_with_pkce':
        return {
          ...base,
          method: OAuth2Method.AUTHORIZATION_CODE_PKCE,
          authorizationUrl: parameters.get('authUrl') ?? '',
          callbackUrl: parameters.get('redirect_uri') ?? '',
          codeChallengeMethod:
            parameters.get('challengeAlgorithm') === 'plain'
              ? OAuth2PKCECodeChallengeMethod.PLAIN
              : OAuth2PKCECodeChallengeMethod.S256,
          codeVerifier: parameters.get('code_verifier'),
        };
      case 'client_credentials':
        return {
          ...base,
          method: OAuth2Method.CLIENT_CREDENTIALS,
        };
    }
  }
}
