import type fs from 'node:fs';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { CollectionModel, normalizeCollection } from 'shim/collection-model';
import { makeCollection, makeFolder, makeRequest } from 'shim/__mocks__/collection-fixtures';
import {
  AuthorizationType,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
} from 'shim/objects/auth';
import { Collection } from 'shim/objects/collection';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { parseUrl } from 'shim/objects/url';
import { DisplayableError } from 'shim/error/DisplayableError';
import type { ResolveVariablesOptions } from 'main/environment/service/variable-resolver';
import {
  buildCurlCommand,
  getRequestAsCurl,
  MAX_CURL_TEXT_BODY_SIZE,
  shellQuote,
} from './curl-command';

const NO_BODY = { type: RequestBodyType.NONE } as const;

/** Builds the model of a collection that contains only the given request. */
function modelOf(request: TrufosRequest, collection: Partial<Collection> = {}): CollectionModel {
  return normalizeCollection(makeCollection('col', [request], collection));
}

/** The variables of the collections in these tests: `{{v}}` and the secret `{{s}}`. */
const VARIABLES: Partial<Collection> = {
  variables: { v: { value: 'V' }, s: { value: 'S', secret: true } },
};

function curl(
  overrides: Partial<TrufosRequest>,
  textBody?: string,
  options: ResolveVariablesOptions = {}
): Promise<string> {
  const request = makeRequest('r', 'col', { body: NO_BODY, ...overrides });
  return buildCurlCommand(modelOf(request, VARIABLES), request, options, textBody);
}

describe('shellQuote()', () => {
  it('quotes a value in single quotes', () => {
    expect(shellQuote('a b $HOME')).toBe(`'a b $HOME'`);
  });

  it('escapes single quotes', () => {
    expect(shellQuote(`it's`)).toBe(`'it'\\''s'`);
  });
});

describe('buildCurlCommand()', () => {
  it('builds the method and the URL with the active query parameters', async () => {
    const url = parseUrl('http://localhost/path?a=1&b=2');
    url.query[1].isActive = false;

    expect(await curl({ method: RequestMethod.DELETE, url })).toBe(
      `curl -X DELETE 'http://localhost/path?a=1'`
    );
  });

  it('uses --head for HEAD requests and leaves their body out', async () => {
    const body = { type: RequestBodyType.TEXT, mimeType: 'application/json' } as const;

    expect(await curl({ method: RequestMethod.HEAD, body }, '{}')).toBe(
      `curl --head 'http://localhost'`
    );
  });

  it('resolves the variables where Trufos resolves them when sending', async () => {
    const request = makeRequest('r', 'col', {
      method: RequestMethod.POST,
      url: parseUrl('http://{{v}}/path?q={{v}}'),
      headers: [{ key: 'X-Own', value: '{{v}}', isActive: true }],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/{{v}}' },
      auth: { type: AuthorizationType.BEARER, token: '{{v}}' },
    });
    const model = modelOf(request, {
      ...VARIABLES,
      headers: [{ key: 'X-Inherited', value: '{{v}}', isActive: true }],
    });

    expect(await buildCurlCommand(model, request, {}, 'body {{v}}')).toBe(
      [
        `curl -X POST 'http://V/path?q=V'`,
        // the values of automatic headers are final
        `-H 'content-type: text/{{v}}'`,
        `-H 'authorization: Bearer V'`,
        `-H 'X-Inherited: V'`,
        `-H 'X-Own: V'`,
        `--data-raw 'body V'`,
      ].join(' \\\n  ')
    );
  });

  it('resolves the variables in the credentials and form-data text fields', async () => {
    const command = await curl({
      auth: { type: AuthorizationType.BASIC, username: '{{v}}', password: 'p{{v}}' },
      body: {
        type: RequestBodyType.FORM_DATA,
        fields: [
          {
            key: 'name',
            isActive: true,
            value: { type: RequestBodyType.TEXT, text: '{{v}}', mimeType: 'text/plain' },
          },
        ],
      },
    });

    expect(command).toContain(`-u 'V:pV'`);
    expect(command).toContain(`--form-string 'name=V'`);
  });

  it('keeps the secret variables as templates if asked to', async () => {
    const request: Partial<TrufosRequest> = {
      url: parseUrl('http://{{s}}'),
      headers: [{ key: 'X-Key', value: '{{ s }}', isActive: true }],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
      auth: { type: AuthorizationType.BEARER, token: '{{s}}' },
    };
    const command = (s: string) =>
      [
        `curl -X GET 'http://${s}'`,
        `-H 'content-type: text/plain'`,
        `-H 'authorization: Bearer ${s}'`,
        `-H 'X-Key: ${s}'`,
        `--data-raw 'body ${s}'`,
      ].join(' \\\n  ');

    expect(await curl(request, 'body {{s}}', { keepSecrets: true })).toBe(command('{{s}}'));
    expect(await curl(request, 'body {{s}}')).toBe(command('S'));
  });

  it('adds the active headers only', async () => {
    const command = await curl({
      headers: [
        { key: 'X-Active', value: 'yes', isActive: true },
        { key: 'X-Inactive', value: 'no', isActive: false },
      ],
    });

    expect(command).toContain(`-H 'X-Active: yes'`);
    expect(command).not.toContain('X-Inactive');
  });

  it('adds the inherited headers unless the request overrides or disables them', async () => {
    const request = makeRequest('r', 'f', {
      body: NO_BODY,
      headers: [{ key: 'X-Overridden', value: 'own', isActive: true }],
      disabledHeaders: ['x-disabled'],
    });
    const folder = { ...makeFolder('f', 'col', [request]) };
    folder.headers = [{ key: 'X-Folder', value: 'folder', isActive: true }];
    const model = normalizeCollection(
      makeCollection('col', [folder], {
        headers: [
          { key: 'X-Overridden', value: 'inherited', isActive: true },
          { key: 'X-Disabled', value: 'inherited', isActive: true },
        ],
      })
    );

    const command = await buildCurlCommand(model, request, {});

    expect(command).toContain(`-H 'X-Folder: folder'`);
    expect(command).toContain(`-H 'X-Overridden: own'`);
    expect(command).not.toContain('inherited');
  });

  it('leaves the headers without value to curl', async () => {
    expect(await curl({})).not.toMatch(/user-agent/i);
  });

  it('stops curl from setting a User-Agent if the request disabled it', async () => {
    expect(await curl({ disabledHeaders: ['user-agent'] })).toBe(
      `curl -X GET 'http://localhost' \\\n  -H 'user-agent:'`
    );
  });

  describe('text body', () => {
    const body = { type: RequestBodyType.TEXT, mimeType: 'application/json' } as const;

    it('adds the body and its content type', async () => {
      expect(await curl({ method: RequestMethod.POST, body }, `{"name":"it's"}`)).toBe(
        [
          `curl -X POST 'http://localhost'`,
          `-H 'content-type: application/json'`,
          `--data-raw '{"name":"it'\\''s"}'`,
        ].join(' \\\n  ')
      );
    });

    it('adds no body and no content type if the body is empty or was never written', async () => {
      expect(await curl({ body }, '')).toBe(`curl -X GET 'http://localhost'`);
      expect(await curl({ body })).toBe(`curl -X GET 'http://localhost'`);
    });

    it('prefers an own content type', async () => {
      const command = await curl(
        { body, headers: [{ key: 'Content-Type', value: 'text/x-own', isActive: true }] },
        'x'
      );

      expect(command).toContain(`-H 'Content-Type: text/x-own'`);
      expect(command).not.toContain('application/json');
    });

    it('stops curl from setting a content type if the request disabled it', async () => {
      const command = await curl({ body, disabledHeaders: ['content-type'] }, 'x');

      expect(command).toContain(`-H 'content-type:'`);
      expect(command).not.toContain('application/json');
    });

    it('does not blank out a disabled content type that an own header replaces', async () => {
      const command = await curl(
        {
          body,
          disabledHeaders: ['content-type'],
          headers: [{ key: 'Content-Type', value: 'text/x-own', isActive: true }],
        },
        'x'
      );

      expect(command).toContain(`-H 'Content-Type: text/x-own'`);
      expect(command).not.toContain(`-H 'content-type:'`);
    });
  });

  describe('file body', () => {
    it('adds the file', async () => {
      const body = { type: RequestBodyType.FILE, filePath: `/it's/file.bin` } as const;

      expect(await curl({ body })).toBe(
        [
          `curl -X GET 'http://localhost'`,
          `-H 'content-type: application/octet-stream'`,
          `--data-binary '@/it'\\''s/file.bin'`,
        ].join(' \\\n  ')
      );
    });

    it('adds nothing if no file is chosen', async () => {
      expect(await curl({ body: { type: RequestBodyType.FILE } })).toBe(
        `curl -X GET 'http://localhost'`
      );
    });
  });

  describe('form-data body', () => {
    it('adds the active fields and leaves the content type to curl', async () => {
      const command = await curl({
        body: {
          type: RequestBodyType.FORM_DATA,
          fields: [
            {
              key: 'name',
              isActive: true,
              value: { type: RequestBodyType.TEXT, text: '@not-a-file', mimeType: 'text/plain' },
            },
            {
              key: 'upload',
              isActive: true,
              value: {
                type: RequestBodyType.FILE,
                filePath: '/dir/a;b.png',
                fileName: 'a.png',
                mimeType: 'image/png',
              },
            },
            {
              key: 'inactive',
              isActive: false,
              value: { type: RequestBodyType.TEXT, text: 'x', mimeType: 'text/plain' },
            },
            {
              key: 'nofile',
              isActive: true,
              value: { type: RequestBodyType.FILE },
            },
          ],
        },
      });

      expect(command).toBe(
        [
          `curl -X GET 'http://localhost'`,
          `--form-string 'name=@not-a-file'`,
          `-F 'upload=@"/dir/a;b.png";filename="a.png";type=image/png'`,
        ].join(' \\\n  ')
      );
    });
  });

  describe('authorization', () => {
    it('adds basic and digest credentials', async () => {
      expect(
        await curl({ auth: { type: AuthorizationType.BASIC, username: 'u', password: '{{pw}}' } })
      ).toContain(`-u 'u:{{pw}}'`);
      expect(
        await curl({ auth: { type: AuthorizationType.DIGEST, username: 'u', password: 'p' } })
      ).toContain(`--digest -u 'u:p'`);
    });

    it('adds a bearer token', async () => {
      expect(
        await curl({ auth: { type: AuthorizationType.BEARER, token: '{{token}}' } })
      ).toContain(`-H 'authorization: Bearer {{token}}'`);
    });

    it('uses the inherited authorization', async () => {
      const request = makeRequest('r', 'col', {
        body: NO_BODY,
        auth: { type: AuthorizationType.INHERIT },
      });
      const model = modelOf(request, { auth: { type: AuthorizationType.BEARER, token: 't' } });

      expect(await buildCurlCommand(model, request, {})).toContain(`-H 'authorization: Bearer t'`);
    });

    it('prefers an own Authorization header', async () => {
      const command = await curl({
        auth: { type: AuthorizationType.BEARER, token: 'token' },
        headers: [{ key: 'Authorization', value: 'Custom x', isActive: true }],
      });

      expect(command).toContain(`-H 'Authorization: Custom x'`);
      expect(command).not.toContain('Bearer');
    });

    it('says that an OAuth 2.0 authorization is not included', async () => {
      const command = await curl({
        auth: {
          type: AuthorizationType.OAUTH2,
          method: OAuth2Method.CLIENT_CREDENTIALS,
          issuerUrl: '',
          clientId: 'id',
          clientSecret: 'secret',
          tokenUrl: 'http://localhost/token',
          scope: '',
          clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
        },
      });

      expect(command).toBe(
        `# The OAuth 2.0 authorization is not included.\ncurl -X GET 'http://localhost'`
      );
    });
  });
});

describe('getRequestAsCurl()', () => {
  const collectionState = CollectionStateService.instance;
  const request = makeRequest('r', 'col', { method: RequestMethod.POST });

  function mockCollection(
    textBody?: string,
    copied: TrufosRequest = request,
    collection: Partial<Collection> = {}
  ) {
    vi.spyOn(collectionState, 'model', 'get').mockReturnValue(modelOf(copied, collection));
    vi.spyOn(collectionState, 'readExistingRequest').mockImplementation(
      async (_id, reader) => await reader(copied)
    );
    vi.spyOn(PersistenceService.instance, 'loadTextBodyOfRequest').mockResolvedValue(
      textBody == null ? undefined : (Readable.from([Buffer.from(textBody)]) as fs.ReadStream)
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the command with the text body read from its file', async () => {
    mockCollection('hello');

    const command = await getRequestAsCurl('r');

    expect(collectionState.readExistingRequest).toHaveBeenCalledWith('r', expect.any(Function));
    expect(command).toContain(`--data-raw 'hello'`);
  });

  it('builds the command without body if the body file does not exist', async () => {
    mockCollection();

    expect(await getRequestAsCurl('r')).toBe(`curl -X POST 'http://localhost'`);
  });

  function mockCollectionWithSecret() {
    const withVariables = makeRequest('r', 'col', {
      url: parseUrl('{{baseUrl}}/users'),
      headers: [{ key: 'X-Api-Key', value: '{{apiKey}}', isActive: true }],
      body: { type: RequestBodyType.NONE },
    });
    mockCollection(undefined, withVariables, {
      variables: {
        baseUrl: { value: 'http://example.com' },
        apiKey: { value: 'hidden', secret: true },
      },
    });
  }

  it('resolves the variables except the secret ones', async () => {
    mockCollectionWithSecret();

    expect(await getRequestAsCurl('r')).toBe(
      `curl -X GET 'http://example.com/users' \\\n  -H 'X-Api-Key: {{apiKey}}'`
    );
  });

  it('resolves the secret variables too if asked to', async () => {
    mockCollectionWithSecret();

    expect(await getRequestAsCurl('r', { includeSecrets: true })).toBe(
      `curl -X GET 'http://example.com/users' \\\n  -H 'X-Api-Key: hidden'`
    );
  });

  it('refuses a body that is too large', async () => {
    mockCollection('x'.repeat(MAX_CURL_TEXT_BODY_SIZE + 1));

    await expect(getRequestAsCurl('r')).rejects.toThrow(DisplayableError);
  });
});
