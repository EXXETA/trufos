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

function curl(overrides: Partial<TrufosRequest>, textBody?: string): string {
  const request = makeRequest('r', 'col', { body: NO_BODY, ...overrides });
  return buildCurlCommand(modelOf(request), request, textBody);
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
  it('builds the method and the URL with the active query parameters', () => {
    const url = parseUrl('http://localhost/path?a=1&b=2');
    url.query[1].isActive = false;

    expect(curl({ method: RequestMethod.DELETE, url })).toBe(
      `curl -X DELETE 'http://localhost/path?a=1'`
    );
  });

  it('uses --head for HEAD requests and leaves their body out', () => {
    const body = { type: RequestBodyType.TEXT, mimeType: 'application/json' } as const;

    expect(curl({ method: RequestMethod.HEAD, body }, '{}')).toBe(`curl --head 'http://localhost'`);
  });

  it('copies variables unresolved', () => {
    expect(
      curl({
        url: parseUrl('{{baseUrl}}/users'),
        headers: [{ key: 'X-Api-Key', value: '{{apiKey}}', isActive: true }],
      })
    ).toBe(`curl -X GET '{{baseUrl}}/users' \\\n  -H 'X-Api-Key: {{apiKey}}'`);
  });

  it('adds the active headers only', () => {
    const command = curl({
      headers: [
        { key: 'X-Active', value: 'yes', isActive: true },
        { key: 'X-Inactive', value: 'no', isActive: false },
      ],
    });

    expect(command).toContain(`-H 'X-Active: yes'`);
    expect(command).not.toContain('X-Inactive');
  });

  it('adds the inherited headers unless the request overrides or disables them', () => {
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

    const command = buildCurlCommand(model, request);

    expect(command).toContain(`-H 'X-Folder: folder'`);
    expect(command).toContain(`-H 'X-Overridden: own'`);
    expect(command).not.toContain('inherited');
  });

  it('leaves the headers without value to curl', () => {
    expect(curl({})).not.toMatch(/user-agent/i);
  });

  it('stops curl from setting a User-Agent if the request disabled it', () => {
    expect(curl({ disabledHeaders: ['user-agent'] })).toBe(
      `curl -X GET 'http://localhost' \\\n  -H 'user-agent:'`
    );
  });

  describe('text body', () => {
    const body = { type: RequestBodyType.TEXT, mimeType: 'application/json' } as const;

    it('adds the body and its content type', () => {
      expect(curl({ method: RequestMethod.POST, body }, `{"name":"it's"}`)).toBe(
        [
          `curl -X POST 'http://localhost'`,
          `-H 'content-type: application/json'`,
          `--data-raw '{"name":"it'\\''s"}'`,
        ].join(' \\\n  ')
      );
    });

    it('adds no body and no content type if the body is empty or was never written', () => {
      expect(curl({ body }, '')).toBe(`curl -X GET 'http://localhost'`);
      expect(curl({ body })).toBe(`curl -X GET 'http://localhost'`);
    });

    it('prefers an own content type', () => {
      const command = curl(
        { body, headers: [{ key: 'Content-Type', value: 'text/x-own', isActive: true }] },
        'x'
      );

      expect(command).toContain(`-H 'Content-Type: text/x-own'`);
      expect(command).not.toContain('application/json');
    });

    it('stops curl from setting a content type if the request disabled it', () => {
      const command = curl({ body, disabledHeaders: ['content-type'] }, 'x');

      expect(command).toContain(`-H 'content-type:'`);
      expect(command).not.toContain('application/json');
    });

    it('does not blank out a disabled content type that an own header replaces', () => {
      const command = curl(
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
    it('adds the file', () => {
      const body = { type: RequestBodyType.FILE, filePath: `/it's/file.bin` } as const;

      expect(curl({ body })).toBe(
        [
          `curl -X GET 'http://localhost'`,
          `-H 'content-type: application/octet-stream'`,
          `--data-binary '@/it'\\''s/file.bin'`,
        ].join(' \\\n  ')
      );
    });

    it('adds nothing if no file is chosen', () => {
      expect(curl({ body: { type: RequestBodyType.FILE } })).toBe(`curl -X GET 'http://localhost'`);
    });
  });

  describe('form-data body', () => {
    it('adds the active fields and leaves the content type to curl', () => {
      const command = curl({
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
    it('adds basic and digest credentials', () => {
      expect(
        curl({ auth: { type: AuthorizationType.BASIC, username: 'u', password: '{{pw}}' } })
      ).toContain(`-u 'u:{{pw}}'`);
      expect(
        curl({ auth: { type: AuthorizationType.DIGEST, username: 'u', password: 'p' } })
      ).toContain(`--digest -u 'u:p'`);
    });

    it('adds a bearer token', () => {
      expect(curl({ auth: { type: AuthorizationType.BEARER, token: '{{token}}' } })).toContain(
        `-H 'authorization: Bearer {{token}}'`
      );
    });

    it('uses the inherited authorization', () => {
      const request = makeRequest('r', 'col', {
        body: NO_BODY,
        auth: { type: AuthorizationType.INHERIT },
      });
      const model = modelOf(request, { auth: { type: AuthorizationType.BEARER, token: 't' } });

      expect(buildCurlCommand(model, request)).toContain(`-H 'authorization: Bearer t'`);
    });

    it('prefers an own Authorization header', () => {
      const command = curl({
        auth: { type: AuthorizationType.BEARER, token: 'token' },
        headers: [{ key: 'Authorization', value: 'Custom x', isActive: true }],
      });

      expect(command).toContain(`-H 'Authorization: Custom x'`);
      expect(command).not.toContain('Bearer');
    });

    it('says that an OAuth 2.0 authorization is not included', () => {
      const command = curl({
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

  function mockCollection(textBody?: string) {
    vi.spyOn(collectionState, 'model', 'get').mockReturnValue(modelOf(request));
    vi.spyOn(collectionState, 'readExistingRequest').mockImplementation(
      async (_id, reader) => await reader(request)
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

  it('refuses a body that is too large', async () => {
    mockCollection('x'.repeat(MAX_CURL_TEXT_BODY_SIZE + 1));

    await expect(getRequestAsCurl('r')).rejects.toThrow(DisplayableError);
  });
});
