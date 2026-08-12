import { vi, describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { AuthorizationType } from 'shim/objects/auth';
import { sanitizeTitle } from 'shim/string';

vi.unmock('node:fs');
vi.unmock('node:fs/promises');

const OPEN_API_DOCUMENT = {
  openapi: '3.0.3',
  info: {
    title: 'Petstore API',
    version: '1.0.0',
  },
  servers: [{ url: 'https://api.example.com/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
  paths: {
    '/pets': {
      get: {
        tags: ['Pets'],
        summary: 'List pets',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 10 },
          },
          {
            name: 'X-Trace-Id',
            in: 'header',
            schema: { type: 'string', default: 'trace-1' },
          },
        ],
        responses: {
          '200': { description: 'ok' },
        },
      },
      post: {
        tags: ['Pets'],
        operationId: 'createPet',
        requestBody: {
          content: {
            'application/json': {
              example: { name: 'Milo' },
            },
          },
        },
        responses: {
          '201': { description: 'created' },
        },
      },
    },
    '/health': {
      get: {
        responses: {
          '200': { description: 'ok' },
        },
      },
    },
  },
};

describe('OpenApiImporter', () => {
  it('imports an OpenAPI collection from JSON', async () => {
    const fs = await import('node:fs/promises');
    const { OpenApiImporter } = await import('./openapi-importer.js');
    const srcFilePath = path.join(tmpdir(), 'openapi-import.json');
    await fs.writeFile(srcFilePath, JSON.stringify(OPEN_API_DOCUMENT));

    const result = await new OpenApiImporter().importCollection(srcFilePath);

    expect(result.type).toBe('collection');
    expect(result.title).toBe('Petstore API');
    expect(result.children.length).toBe(2);

    const folder = result.children[0] as Folder;
    expect(folder.type).toBe('folder');
    expect(folder.title).toBe('Pets');
    expect(folder.children.length).toBe(2);

    const listPets = folder.children[0] as TrufosRequest;
    expect(listPets.title).toBe('List pets');
    expect(listPets.method).toBe('GET');
    expect(listPets.url).toEqual({
      base: 'https://api.example.com/v1/pets',
      query: [{ key: 'limit', value: '10', isActive: true }],
    });
    expect(listPets.headers).toEqual([{ key: 'X-Trace-Id', value: 'trace-1', isActive: true }]);
    expect(listPets.body).toEqual({
      type: RequestBodyType.TEXT,
      mimeType: 'text/plain',
    });
    expect(listPets.auth).toEqual({
      type: AuthorizationType.BEARER,
      token: '',
    });

    const createPet = folder.children[1] as TrufosRequest;
    expect(createPet.title).toBe('createPet');
    expect(createPet.method).toBe('POST');
    expect(createPet.body).toEqual({
      type: RequestBodyType.TEXT,
      mimeType: 'application/json',
      text: '{\n  "name": "Milo"\n}',
    });

    const health = result.children[1] as TrufosRequest;
    expect(health.title).toBe('/health');
    expect(health.url).toEqual({
      base: 'https://api.example.com/v1/health',
      query: [],
    });
  });

  it('completes relative OpenAPI server URLs with a localhost base URL', async () => {
    const fs = await import('node:fs/promises');
    const { OpenApiImporter } = await import('./openapi-importer.js');
    const srcFilePath = path.join(tmpdir(), 'openapi-relative-server.json');
    await fs.writeFile(
      srcFilePath,
      JSON.stringify({
        ...OPEN_API_DOCUMENT,
        servers: [{ url: '/api/v2' }],
        paths: {
          '/users': {
            get: {
              responses: {
                '200': { description: 'ok' },
              },
            },
          },
        },
      })
    );

    const result = await new OpenApiImporter().importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.url).toEqual({
      base: 'http://localhost/api/v2/users',
      query: [],
    });
  });

  it('uses OpenAPI server variable defaults before completing URLs', async () => {
    const fs = await import('node:fs/promises');
    const { OpenApiImporter } = await import('./openapi-importer.js');
    const srcFilePath = path.join(tmpdir(), 'openapi-server-variables.json');
    await fs.writeFile(
      srcFilePath,
      JSON.stringify({
        ...OPEN_API_DOCUMENT,
        servers: [
          {
            url: '{scheme}://{host}/api',
            variables: {
              scheme: { default: 'https' },
              host: { default: 'example.org' },
            },
          },
        ],
        paths: {
          '/users': {
            get: {
              responses: {
                '200': { description: 'ok' },
              },
            },
          },
        },
      })
    );

    const result = await new OpenApiImporter().importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.url.base).toBe('https://example.org/api/users');
  });

  it('completes Swagger base paths without a host with a localhost base URL', async () => {
    const fs = await import('node:fs/promises');
    const { OpenApiImporter } = await import('./openapi-importer.js');
    const srcFilePath = path.join(tmpdir(), 'swagger-without-host.json');
    await fs.writeFile(
      srcFilePath,
      JSON.stringify({
        swagger: '2.0',
        info: {
          title: 'Swagger API',
          version: '1.0.0',
        },
        basePath: '/legacy',
        paths: {
          '/status': {
            get: {
              responses: {
                '200': { description: 'ok' },
              },
            },
          },
        },
      })
    );

    const result = await new OpenApiImporter().importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.url.base).toBe('http://localhost/legacy/status');
  });

  describe('request titles', () => {
    async function importOperation(operation: object) {
      const fs = await import('node:fs/promises');
      const { OpenApiImporter } = await import('./openapi-importer.js');
      const srcFilePath = path.join(tmpdir(), 'openapi-titles.json');
      await fs.writeFile(
        srcFilePath,
        JSON.stringify({
          ...OPEN_API_DOCUMENT,
          paths: { '/apps/{appId}/versions': { post: { ...operation, responses: {} } } },
        })
      );

      const result = await new OpenApiImporter().importCollection(srcFilePath);
      return result.children[0] as TrufosRequest;
    }

    it('uses only the first line of a summary that contains the whole documentation', async () => {
      const request = await importOperation({
        summary: `Takes native app file from request and creates new appstore application.
          Optional parameters for the request are:
          - changelog: to provide a changelog in form of a text file
          - releaseState: the release state the app should be in after creation`,
        operationId: 'createApplication',
      });

      expect(request.title).toBe(
        'Takes native app file from request and creates new appstore application'
      );
      expect(sanitizeTitle(request.title)).toBe(
        'takes-native-app-file-from-request-and-creates-new-appstore'
      );
    });

    it('shortens single line summaries that are too long for a title', async () => {
      const request = await importOperation({
        summary:
          'Creates a new appstore application from the native app file that is sent along with this request and returns its metadata',
      });

      expect(request.title).toBe(
        'Creates a new appstore application from the native app file that is sent along with this request'
      );
    });

    it('keeps a short summary as it is', async () => {
      const request = await importOperation({ summary: 'Create application' });

      expect(request.title).toBe('Create application');
    });

    it('falls back to the operation ID if there is no usable summary', async () => {
      const request = await importOperation({ summary: '  \n ', operationId: 'createApplication' });

      expect(request.title).toBe('createApplication');
      expect(sanitizeTitle(request.title)).toBe('create-application');
    });

    it('falls back to the path template if there is neither summary nor operation ID', async () => {
      const request = await importOperation({});

      expect(request.title).toBe('/apps/{appId}/versions');
      expect(sanitizeTitle(request.title)).toBe('apps-app-id-versions');
    });
  });
});
