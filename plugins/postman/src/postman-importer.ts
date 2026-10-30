import {
  Collection as PostmanCollection,
  CollectionDefinition,
  Item,
  ItemGroup,
  RequestAuth as PostmanRequestAuth,
} from 'postman-collection';
import {
  AuthorizationType,
  type CollectionImporter,
  DisplayableError,
  type Folder as TrufosFolder,
  type OAuth2AuthorizationInformation,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
  OAuth2PKCECodeChallengeMethod,
  type Oauth2BaseAuthorizationInformation,
  parseUrl,
  type PluginFileSystem,
  type PluginLogger,
  type RequestBody,
  RequestBodyType,
  type RequestMethod,
  type Collection as TrufosCollection,
  type TrufosRequest,
  VARIABLE_NAME_REGEX,
  type VariableObject,
} from 'shim/plugin';
import { z } from 'zod';

const DEFAULT_MIME_TYPE = 'text/plain';

/**
 * A Postman collection file. Only the title is checked, as the Postman SDK reads the rest of the
 * file and tolerates what it does not know.
 */
const CollectionFile = z.looseObject({ info: z.looseObject({ name: z.string() }) });

/**
 * An importer for Postman collections. It will import the collection and all of its variables,
 * folders and requests. It imports using the DFS algorithm.
 */
export class PostmanImporter implements CollectionImporter {
  constructor(
    private readonly log: PluginLogger,
    private readonly fs: PluginFileSystem
  ) {}

  public async importCollection(srcFilePath: string) {
    // read Postman collection
    let json: CollectionDefinition;
    try {
      json = CollectionFile.parse(JSON.parse(await this.fs.readFile(srcFilePath, 'utf8')));
    } catch (error) {
      throw new DisplayableError(
        `Could not read a Postman collection from "${srcFilePath}". ` +
          'Make sure the selected file is a valid Postman collection.',
        'Import Error',
        error
      );
    }
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
    this.log.info(`Loaded ${variablesArray.length} collection variables`);

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
      id: postmanFolder.id as string,
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

    const trufosRequest: TrufosRequest = {
      id: item.id as string,
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
      body: this.importBody(request),
      auth: this.importAuth(request.auth),
    };

    parent.children.push(trufosRequest);
  }

  private importBody(request: Item['request']): RequestBody {
    switch (request.body?.mode) {
      case 'file':
        return { type: RequestBodyType.FILE, filePath: request.body.file?.src };
      case 'raw':
        return {
          type: RequestBodyType.TEXT,
          text: request.body.raw,
          mimeType: request.headers.get('Content-Type') ?? DEFAULT_MIME_TYPE,
        };
      default:
        // no body, or a mode Trufos cannot import
        return { type: RequestBodyType.NONE };
    }
  }

  private importAuth(postmanAuth?: PostmanRequestAuth): TrufosRequest['auth'] {
    if (postmanAuth == null) return;

    const parameters = new Map<string, string>();
    for (const param of postmanAuth.parameters().all()) {
      if (param.key != null && param.key !== '') parameters.set(param.key, param.value);
    }

    switch (postmanAuth.type) {
      case 'basic':
        return { type: AuthorizationType.BASIC, ...this.importCredentials(parameters) };
      case 'digest':
        return { type: AuthorizationType.DIGEST, ...this.importCredentials(parameters) };
      case 'bearer':
        return {
          type: AuthorizationType.BEARER,
          token: parameters.get('token') ?? '',
        };
      case 'oauth2': {
        return this.importOAuth2(parameters);
      }
      default:
        this.log.warn(`Unsupported auth type while importing from Postman: ${postmanAuth.type}`);
        return;
    }
  }

  /** Imports the username and password of an authorization that authenticates with them. */
  private importCredentials(parameters: Map<string, string>): {
    username: string;
    password: string;
  } {
    return {
      username: parameters.get('username') ?? '',
      password: parameters.get('password') ?? '',
    };
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
