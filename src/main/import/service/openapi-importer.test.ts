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
    expect(result.variables).toEqual({ baseUrl: { value: 'https://api.example.com/v1' } });
    expect(result.environments).toEqual({});

    expect(listPets.url).toEqual({
      base: '{{baseUrl}}/pets',
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
      base: '{{baseUrl}}/health',
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

    expect(result.variables.baseUrl.value).toBe('http://localhost/api/v2');
    expect(request.url).toEqual({ base: '{{baseUrl}}/users', query: [] });
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

    expect(result.variables.baseUrl.value).toBe('https://example.org/api');
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

    expect(result.variables.baseUrl.value).toBe('http://localhost/legacy');
  });

  it('imports every server of a document as an environment', async () => {
    const fs = await import('node:fs/promises');
    const { OpenApiImporter } = await import('./openapi-importer.js');
    const srcFilePath = path.join(tmpdir(), 'openapi-multiple-servers.json');
    await fs.writeFile(
      srcFilePath,
      JSON.stringify({
        ...OPEN_API_DOCUMENT,
        servers: [
          { url: 'https://api.example.com/v1', description: 'Production' },
          { url: 'https://staging.example.com/v1' },
          { url: 'https://staging.example.com/v2' },
        ],
        paths: { '/users': { get: { responses: { '200': { description: 'ok' } } } } },
      })
    );

    const result = await new OpenApiImporter().importCollection(srcFilePath);

    // the first server stays the fallback for when no environment is selected
    expect(result.variables.baseUrl.value).toBe('https://api.example.com/v1');
    expect(result.environments).toEqual({
      Production: { variables: { baseUrl: { value: 'https://api.example.com/v1' } } },
      'staging.example.com/v1': {
        variables: { baseUrl: { value: 'https://staging.example.com/v1' } },
      },
      'staging.example.com/v2': {
        variables: { baseUrl: { value: 'https://staging.example.com/v2' } },
      },
    });
  });

  describe('request bodies', () => {
    async function importBody(requestBody: object, schemas?: object) {
      const fs = await import('node:fs/promises');
      const { OpenApiImporter } = await import('./openapi-importer.js');
      const srcFilePath = path.join(tmpdir(), 'openapi-bodies.json');
      await fs.writeFile(
        srcFilePath,
        JSON.stringify({
          ...OPEN_API_DOCUMENT,
          components: { ...OPEN_API_DOCUMENT.components, schemas },
          paths: {
            '/apps': { post: { requestBody, responses: { '201': { description: 'ok' } } } },
          },
        })
      );

      const result = await new OpenApiImporter().importCollection(srcFilePath);
      return (result.children[0] as TrufosRequest).body;
    }

    it('generates a body from the schema when the spec has no example', async () => {
      const body = await importBody({
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                size: { type: 'integer' },
                public: { type: 'boolean' },
                state: { type: 'string', enum: ['DEVELOPMENT', 'RELEASE'] },
                retries: { type: 'integer', default: 3 },
                tags: { type: 'array', items: { type: 'string' } },
                owner: { type: 'object', properties: { id: { type: 'string' } } },
              },
            },
          },
        },
      });

      expect(body).toEqual({
        type: RequestBodyType.TEXT,
        mimeType: 'application/json',
        text: JSON.stringify(
          {
            name: '',
            size: 0,
            public: false,
            state: 'DEVELOPMENT',
            retries: 3,
            tags: [''],
            owner: { id: '' },
          },
          null,
          2
        ),
      });
    });

    it('merges the branches of an allOf schema into one body', async () => {
      const body = await importBody({
        content: {
          'application/json': {
            schema: {
              allOf: [
                { type: 'object', properties: { uuid: { type: 'string' } } },
                { type: 'object', properties: { version: { type: 'integer' } } },
              ],
              properties: { comment: { type: 'string' } },
            },
          },
        },
      });

      expect(body.type === RequestBodyType.TEXT && body.text).toBe(
        JSON.stringify({ uuid: '', version: 0, comment: '' }, null, 2)
      );
    });

    it('leaves out read-only properties that the server owns', async () => {
      const body = await importBody({
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                createdAt: { type: 'integer', readOnly: true },
              },
            },
          },
        },
      });

      expect(body.type === RequestBodyType.TEXT && body.text).toBe(
        JSON.stringify({ name: '' }, null, 2)
      );
    });

    it('prefers the example of the spec over a generated one', async () => {
      const body = await importBody({
        content: {
          'application/json': {
            example: { name: 'Milo' },
            schema: { type: 'object', properties: { name: { type: 'string' } } },
          },
        },
      });

      expect(body.type === RequestBodyType.TEXT && body.text).toBe(
        JSON.stringify({ name: 'Milo' }, null, 2)
      );
    });

    it('generates a body from a schema that references itself', async () => {
      const body = await importBody(
        { content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } } } },
        {
          Node: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              parent: { $ref: '#/components/schemas/Node' },
              children: { type: 'array', items: { $ref: '#/components/schemas/Node' } },
            },
          },
        }
      );

      // the recursion stops at the properties that lead back to the node itself
      expect(body.type === RequestBodyType.TEXT && body.text).toBe(
        JSON.stringify({ name: '', children: [] }, null, 2)
      );
    });
  });

  describe('security', () => {
    const SECURITY_SCHEMES = {
      basicAuth: { type: 'http', scheme: 'basic' },
      bearerAuth: { type: 'http', scheme: 'bearer' },
      cookieAuth: { type: 'apiKey', name: 'JSESSIONID', in: 'cookie' },
      accessTokenAuth: { type: 'apiKey', name: 'X-User-Access-Token', in: 'header' },
      deviceUuid: { type: 'apiKey', name: 'Relution-Device-Uuid', in: 'header' },
      tenantAuth: { type: 'apiKey', name: 'tenantOrganizationUuid', in: 'query' },
      digestAuth: { type: 'http', scheme: 'digest' },
    };

    async function importSecurity(security: object[], operationSecurity?: object[]) {
      const fs = await import('node:fs/promises');
      const { OpenApiImporter } = await import('./openapi-importer.js');
      const srcFilePath = path.join(tmpdir(), 'openapi-security.json');
      await fs.writeFile(
        srcFilePath,
        JSON.stringify({
          ...OPEN_API_DOCUMENT,
          components: { securitySchemes: SECURITY_SCHEMES },
          security,
          paths: {
            '/apps': {
              get: {
                ...(operationSecurity == null ? {} : { security: operationSecurity }),
                responses: { '200': { description: 'ok' } },
              },
            },
          },
        })
      );

      const collection = await new OpenApiImporter().importCollection(srcFilePath);
      return { collection, request: collection.children[0] as TrufosRequest };
    }

    it('skips the empty requirement that only marks the authorization as optional', async () => {
      const { collection, request } = await importSecurity([{}, { basicAuth: [] }]);

      expect(collection.auth).toEqual({
        type: AuthorizationType.BASIC,
        username: '',
        password: '',
      });
      expect(request.auth).toEqual({ type: AuthorizationType.INHERIT });
    });

    it('skips requirements that Trufos cannot represent completely', async () => {
      const { collection } = await importSecurity([
        { cookieAuth: [] }, // API keys in cookies are unsupported
        { digestAuth: [] }, // only basic and bearer HTTP authentication are supported
        { unknownAuth: [] }, // not defined in the security schemes at all
        { bearerAuth: [] },
      ]);

      expect(collection.auth).toEqual({ type: AuthorizationType.BEARER, token: '' });
    });

    it('imports API keys as the header or query parameter they are', async () => {
      const { collection, request } = await importSecurity([
        { accessTokenAuth: [], deviceUuid: [], tenantAuth: [] },
      ]);

      expect(collection.auth).toBeUndefined();
      expect(request.headers).toEqual([
        { key: 'X-User-Access-Token', value: '', isActive: true },
        { key: 'Relution-Device-Uuid', value: '', isActive: true },
      ]);
      expect(request.url.query).toEqual([
        { key: 'tenantOrganizationUuid', value: '', isActive: true },
      ]);
    });

    it('keeps the security of an operation on the request itself', async () => {
      const { collection, request } = await importSecurity(
        [{ basicAuth: [] }],
        [{ bearerAuth: [] }]
      );

      expect(collection.auth).toEqual({
        type: AuthorizationType.BASIC,
        username: '',
        password: '',
      });
      expect(request.auth).toEqual({ type: AuthorizationType.BEARER, token: '' });
    });

    it('does not inherit the document security into an operation that opts out of it', async () => {
      const { request } = await importSecurity([{ basicAuth: [] }], []);

      expect(request.auth).toBeUndefined();
    });
  });

  describe('query parameters', () => {
    async function importQuery(parameters: object[]) {
      const fs = await import('node:fs/promises');
      const { OpenApiImporter } = await import('./openapi-importer.js');
      const srcFilePath = path.join(tmpdir(), 'openapi-query-parameters.json');
      await fs.writeFile(
        srcFilePath,
        JSON.stringify({
          ...OPEN_API_DOCUMENT,
          paths: {
            '/apps': { get: { parameters, responses: { '200': { description: 'ok' } } } },
          },
        })
      );

      const result = await new OpenApiImporter().importCollection(srcFilePath);
      return (result.children[0] as TrufosRequest).url.query;
    }

    it('deactivates optional parameters without a value', async () => {
      const query = await importQuery([
        { name: 'search', in: 'query', schema: { type: 'string' } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
        { name: 'orgId', in: 'query', required: true, schema: { type: 'string' } },
      ]);

      expect(query).toEqual([
        { key: 'search', value: '', isActive: false },
        { key: 'limit', value: '100', isActive: true },
        { key: 'orgId', value: '', isActive: true },
      ]);
    });
  });

  describe('path parameters', () => {
    async function importPaths(paths: object) {
      const fs = await import('node:fs/promises');
      const { OpenApiImporter } = await import('./openapi-importer.js');
      const srcFilePath = path.join(tmpdir(), 'openapi-path-parameters.json');
      await fs.writeFile(srcFilePath, JSON.stringify({ ...OPEN_API_DOCUMENT, paths }));

      const collection = await new OpenApiImporter().importCollection(srcFilePath);
      const { baseUrl, ...pathVariables } = collection.variables;
      expect(baseUrl).toBeDefined();
      return { collection, pathVariables, request: collection.children[0] as TrufosRequest };
    }

    it('converts path parameters into template variables and declares them', async () => {
      const { request, pathVariables } = await importPaths({
        '/apps/{appId}/versions/{version}': {
          get: {
            parameters: [
              {
                name: 'appId',
                in: 'path',
                description: 'The ID of the application',
                schema: { type: 'string', example: 'my-app' },
              },
              { name: 'version', in: 'path', schema: { type: 'integer', default: 1 } },
            ],
            responses: { '200': { description: 'ok' } },
          },
        },
      });
      expect(request.url.base).toBe('{{baseUrl}}/apps/{{appId}}/versions/{{version}}');
      expect(pathVariables).toEqual({
        appId: { value: 'my-app', description: 'The ID of the application' },
        version: { value: '1', description: undefined },
      });
    });

    it('declares path parameters that the operation does not define', async () => {
      const { request, pathVariables } = await importPaths({
        '/apps/{appId}': { get: { responses: { '200': { description: 'ok' } } } },
      });
      expect(request.url.base).toBe('{{baseUrl}}/apps/{{appId}}');
      expect(pathVariables).toEqual({ appId: { value: '', description: undefined } });
    });

    it('sanitizes parameter names that cannot be Trufos variables', async () => {
      const { request, pathVariables } = await importPaths({
        '/apps/{app.id}': {
          get: {
            parameters: [{ name: 'app.id', in: 'path', schema: { example: 'my-app' } }],
            responses: { '200': { description: 'ok' } },
          },
        },
      });

      expect(request.url.base).toBe('{{baseUrl}}/apps/{{app-id}}');
      expect(pathVariables).toEqual({ 'app-id': { value: 'my-app', description: undefined } });
    });

    it('keeps distinct parameters distinct when they sanitize to the same name', async () => {
      const { request, pathVariables } = await importPaths({
        '/apps/{app-id}/copies/{app.id}': {
          get: {
            parameters: [
              { name: 'app-id', in: 'path', schema: { example: 'first' } },
              { name: 'app.id', in: 'path', schema: { example: 'second' } },
            ],
            responses: { '200': { description: 'ok' } },
          },
        },
      });

      expect(request.url.base).toBe('{{baseUrl}}/apps/{{app-id}}/copies/{{app-id-2}}');
      expect(pathVariables).toEqual({
        'app-id': { value: 'first', description: undefined },
        'app-id-2': { value: 'second', description: undefined },
      });
    });

    it('never lets a path parameter annex the baseUrl variable of the server', async () => {
      const { request, collection } = await importPaths({
        '/things/{baseUrl}': {
          get: {
            parameters: [{ name: 'baseUrl', in: 'path', schema: { example: 'abc' } }],
            responses: { '200': { description: 'ok' } },
          },
        },
      });

      expect(request.url.base).toBe('{{baseUrl}}/things/{{baseUrl-2}}');
      expect(collection.variables.baseUrl.value).toBe('https://api.example.com/v1');
      expect(collection.variables['baseUrl-2']).toEqual({ value: 'abc', description: undefined });
    });

    it('keeps parameters literal if nothing usable remains after sanitizing', async () => {
      const { request, pathVariables } = await importPaths({
        '/apps/{идентификатор}': { get: { responses: { '200': { description: 'ok' } } } },
      });

      expect(request.url.base).toBe('{{baseUrl}}/apps/{идентификатор}');
      expect(pathVariables).toEqual({});
    });

    it('declares a path parameter used by multiple operations only once', async () => {
      const { pathVariables } = await importPaths({
        '/apps/{appId}': {
          get: {
            parameters: [{ name: 'appId', in: 'path', schema: { example: 'first' } }],
            responses: { '200': { description: 'ok' } },
          },
          delete: {
            parameters: [{ name: 'appId', in: 'path', schema: { example: 'second' } }],
            responses: { '204': { description: 'deleted' } },
          },
        },
      });

      expect(pathVariables).toEqual({ appId: { value: 'first', description: undefined } });
    });
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
