import { HttpService } from './http-service';
import { resolveVariablesInString } from 'main/environment/service/variable-resolver';
import { Dispatcher, MockAgent, FormData } from 'undici';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { USER_DATA_DIR } from 'main/util/fs-util';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { parseUrl } from 'shim/objects/url';
import { randomUUID } from 'node:crypto';
import { RequestMethod } from 'shim/objects/request-method';
import { IncomingHttpHeaders } from 'undici/types/header';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { AuthorizationType } from 'shim/objects';
import { DisplayableError } from 'shim/error/DisplayableError';
import { BodyStore } from 'main/network/service/body-store';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { ScriptingService } from 'main/scripting/scripting-service';
import { Readable } from 'node:stream';
import { text as readText } from 'node:stream/consumers';
import type { RequestRecorder } from 'main/network/service/request-recorder';
import type { BodyCopy } from 'main/network/service/request-body-copy';
import { ScriptType } from 'shim/scripting';
import {
  CollectionChangedError,
  CollectionStateService,
  type PreparedRequest,
} from 'main/collection-state/collection-state-service';
import { type CollectionModel, normalizeCollection } from 'shim/collection-model';
import { freeze } from 'immer';
import { HistoryService } from 'main/history/history-service';
import { SettingsService } from 'main/persistence/service/settings-service';
import { LatestResponseBodies } from 'main/network/service/latest-response-bodies';
import type { TrufosResponse } from 'shim/objects/response';

vi.mock('main/environment/service/variable-resolver', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('main/environment/service/variable-resolver')>();
  return { ...actual, resolveVariablesInString: vi.fn(actual.resolveVariablesInString) };
});

const mockAgent = new MockAgent({ connections: 1 });
const recorder = { sent: vi.fn(), scriptLog: vi.fn() } satisfies RequestRecorder;
const model = normalizeCollection({
  id: randomUUID(),
  type: 'collection',
  title: 'Collection',
  dirPath: '/collection',
  isDefault: false,
  lastModified: 0,
  variables: {},
  environments: {},
  children: [],
});

/** Returns the model with the given collection variables. */
function withVariables(variables: Map<string, string>): CollectionModel {
  const collectionVariables = Object.fromEntries(
    [...variables].map(([key, value]) => [key, { value }])
  );
  return { ...model, collection: { ...model.collection, variables: collectionVariables } };
}

/** Prepares a request the way `CollectionStateService.prepareRequest()` does. */
async function prepare(
  request: TrufosRequest,
  preparedModel: CollectionModel = model
): Promise<PreparedRequest> {
  return {
    request,
    model: preparedModel,
    ...(await PersistenceService.instance.openRequestFiles(request)),
  };
}
const responseBodyService = BodyStore.instance;

describe('HttpService', () => {
  beforeAll(() => {
    mockAgent.disableNetConnect();
    mockAgent.enableCallHistory();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    // @ts-expect-error loadScript mock returns null but type expects ReadStream | null
    vi.spyOn(PersistenceService.instance, 'loadScript').mockResolvedValue(null);
    vi.spyOn(PersistenceService.instance, 'loadTextBodyOfRequest').mockResolvedValue(undefined);
    vi.spyOn(CollectionStateService.instance, 'applyTo').mockImplementation(
      async (collectionId, plan) => {
        if (model.collection.id !== collectionId) throw new CollectionChangedError();
        plan(model);
        return model;
      }
    );
  });

  it('fetchAsync() should make an HTTP call and return the body on read', async () => {
    // Arrange
    const text = 'Hello, world!';
    const url = new URL('https://example.com/api/data');
    const httpService = setupMockHttpService(url, text);
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Test Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    // Act
    const result = await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    expect(result.metaInfo.status).toEqual(200);
    expect(result.metaInfo.duration).toBeGreaterThanOrEqual(0);
    expect(result.body).toEqual({ id: expect.any(String), size: text.length });

    const responseBody = await readText(responseBodyService.openBody(result.body!.id)!);
    expect(responseBody).toEqual(text);
  });

  it('fetchAsync() should send a text-body request without a body file (e.g. never opened in the editor)', async () => {
    // Arrange
    const url = new URL('https://example.com/api/no-body-file');
    const httpService = setupMockHttpService(url, 'OK');
    vi.spyOn(PersistenceService.instance, 'loadTextBodyOfRequest').mockResolvedValue(undefined);
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Test Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    // Act
    const result = await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    expect(result.metaInfo.status).toEqual(200);
    // @ts-expect-error lastCall may be undefined, the request above was sent
    expect(mockAgent.getCallHistory()?.lastCall().headers).not.toHaveProperty('content-type');
  });

  it('fetchAsync() should calculate the response size using actual file size, ignoring content-length header', async () => {
    // Arrange
    const responseBodyMock = {
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    };
    const responseHeadersMock: IncomingHttpHeaders = {
      'content-type': 'application/json',
      'content-length': '5000', // intentionally wrong to verify it is not used
    };
    const url = new URL('https://example.com/api/data');
    const httpService = setupMockHttpService(url, responseBodyMock, responseHeadersMock);
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Test Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    // Act
    const result = await httpService.fetchAsync(await prepare(request), recorder);

    // Assert: bodySizeInBytes must reflect the real body size, not the fake content-length
    const actualBodySize = (await readText(responseBodyService.openBody(result.body!.id)!)).length;
    expect(result.metaInfo.size.bodySizeInBytes).toEqual(actualBodySize);
    expect(result.metaInfo.size.bodySizeInBytes).not.toEqual(5000);
  });

  it('fetchAsync() should generate authentication headers if credentials are provided', async () => {
    // Arrange
    const username = 'testuser';
    const password = 'testpassword';
    const url = new URL('https://example.com/api/data');
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Test Authenticated Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
      auth: { type: AuthorizationType.BASIC, username, password },
    };
    const httpService = setupMockHttpService(url, null);
    const expectedAuthHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

    // Act: requests come from the model of the open collection, which is frozen
    await httpService.fetchAsync(await prepare(freeze(request, true)), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers.authorization).toEqual([expectedAuthHeader]);
  });

  it('fetchAsync() should not resolve variables in the generated authorization header', async () => {
    // Arrange: the token resolves to a value that looks like a template of a defined variable
    const url = new URL('https://example.com/api/data');
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Templated Token Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.NONE },
      auth: { type: AuthorizationType.BEARER, token: '{{ token }}' },
    };
    const variables = new Map([
      ['token', '{{ secret }}'],
      ['secret', 'rewritten'],
    ]);
    const httpService = setupMockHttpService(url, null);

    // Act
    await httpService.fetchAsync(await prepare(request, withVariables(variables)), recorder);

    // Assert
    const headers = mockAgent.getCallHistory()?.lastCall()?.headers;
    expect(headers?.authorization).toEqual(['Bearer {{ secret }}']);
  });

  it('fetchAsync() should send the authorization a request inherits from its folder', async () => {
    // Arrange
    const url = new URL('https://example.com/api/data');
    const folderModel = normalizeCollection({
      ...structuredClone(model.collection),
      auth: { type: AuthorizationType.BEARER, token: 'collection' },
      children: [
        {
          id: 'folder',
          parentId: model.collection.id,
          type: 'folder',
          lastModified: 0,
          title: 'Folder',
          auth: { type: AuthorizationType.BEARER, token: 'folder' },
          children: [],
        },
      ],
    });
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: 'folder',
      type: 'request',
      lastModified: 0,
      title: 'Inheriting Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
      auth: { type: AuthorizationType.INHERIT },
    };
    const httpService = setupMockHttpService(url, null);

    // Act
    await httpService.fetchAsync(await prepare(request, folderModel), recorder);

    // Assert
    expect(mockAgent.getCallHistory()?.lastCall()?.headers?.authorization).toEqual([
      'Bearer folder',
    ]);
  });

  it('fetchAsync() should send the headers a request inherits unless it disables or overrides them', async () => {
    // Arrange
    const url = new URL('https://example.com/api/data');
    const folderModel = normalizeCollection({
      ...structuredClone(model.collection),
      variables: { tenant: { value: 'acme' } },
      headers: [
        { key: 'X-Tenant', value: '{{ tenant }}', isActive: true },
        { key: 'X-Disabled', value: 'collection', isActive: true },
      ],
      children: [
        {
          id: 'folder',
          parentId: model.collection.id,
          type: 'folder',
          lastModified: 0,
          title: 'Folder',
          headers: [{ key: 'X-Overridden', value: 'folder', isActive: true }],
          children: [],
        },
      ],
    });
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: 'folder',
      type: 'request',
      lastModified: 0,
      title: 'Inheriting Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [{ key: 'x-overridden', value: 'request', isActive: true }],
      disabledHeaders: ['x-disabled'],
      body: { type: RequestBodyType.NONE },
    };
    const httpService = setupMockHttpService(url, null);

    // Act
    await httpService.fetchAsync(await prepare(request, folderModel), recorder);

    // Assert
    const headers = mockAgent.getCallHistory()?.lastCall()?.headers;
    expect(headers?.['x-tenant']).toEqual(['acme']);
    expect(headers?.['x-overridden']).toEqual(['request']);
    expect(headers).not.toHaveProperty('x-disabled');
  });

  it('fetchAsync() should use custom authorization header over generated', async () => {
    // Arrange
    const username = 'testuser';
    const password = 'testpassword';
    const authorizationValue = 'Bearer custom-token';
    const url = new URL('https://example.com/api/data');
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Test Authenticated Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [{ key: 'Authorization', value: authorizationValue, isActive: true }],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
      auth: { type: AuthorizationType.BASIC, username, password },
    };
    const httpService = setupMockHttpService(url, null);

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers.authorization).toEqual([authorizationValue]);
  });

  it('fetchAsync() should replace variables in URL before sending request', async () => {
    // Arrange
    const variables = new Map([
      ['host', 'dev.example.com'],
      ['basePath', 'api'],
      ['resource', 'data'],
    ]);

    const rawUrl = 'https://{{host}}/{{basePath}}/{{resource}}';
    const expectedFinalUrl = 'https://dev.example.com/api/data';
    const urlObj = new URL(expectedFinalUrl);
    const httpService = setupMockHttpService(urlObj, 'OK');

    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Variable URL Request',
      url: parseUrl(rawUrl),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    // Act
    await httpService.fetchAsync(await prepare(request, withVariables(variables)), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.origin + lastCall.path).toEqual(expectedFinalUrl);
  });

  it('fetchAsync() should convert an undefined URL variable into a DisplayableError', async () => {
    // Arrange
    const httpService = new HttpService({ get: async () => mockAgent });
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Undefined Variable Request',
      url: parseUrl('https://{{ baseUrl }}/api'),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    // Act & Assert
    await expect(httpService.fetchAsync(await prepare(request), recorder)).rejects.toMatchObject({
      name: DisplayableError.name,
      title: 'Undefined Variable',
      description: expect.stringContaining('baseUrl'),
    });
  });

  it('fetchAsync() should replace variables inside header values', async () => {
    // Arrange
    const variables = new Map([
      ['apiVersion', 'v1'],
      ['token', 'staging-token'],
    ]);

    const finalUrl = new URL('https://example.com/test');
    const httpService = setupMockHttpService(finalUrl, 'OK');

    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Header Variable Request',
      url: parseUrl(finalUrl.toString()),
      method: RequestMethod.GET,
      headers: [
        { key: 'X-Api-Version', value: '{{ apiVersion }}', isActive: true },
        { key: 'Authorization', value: 'Bearer {{ token }}', isActive: true },
      ],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    // Act
    await httpService.fetchAsync(await prepare(request, withVariables(variables)), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers['x-api-version']).toEqual(['v1']);
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers.authorization).toEqual(['Bearer staging-token']);
  });

  it('fetchAsync() should support multiple header values with variable replacement', async () => {
    // Arrange
    const variables = new Map([
      ['trace1', 'abc'],
      ['trace2', 'def'],
    ]);

    const finalUrl = new URL('https://example.com/multi');
    const httpService = setupMockHttpService(finalUrl, 'OK');

    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Multi Header Variable Request',
      url: parseUrl('https://example.com/multi'),
      method: RequestMethod.GET,
      headers: [
        { key: 'X-Trace-Id', value: '{{ trace1 }}', isActive: true },
        { key: 'X-Trace-Id', value: '{{ trace2 }}', isActive: true },
      ],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    // Act
    await httpService.fetchAsync(await prepare(request, withVariables(variables)), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers['x-trace-id']).toEqual(['abc', 'def']);
  });

  it('fetchAsync() should skip headers with a blank key', async () => {
    // Arrange
    const finalUrl = new URL('https://example.com/blank');
    const httpService = setupMockHttpService(finalUrl, 'OK');

    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Blank Header Request',
      url: parseUrl('https://example.com/blank'),
      method: RequestMethod.GET,
      headers: [
        { key: '', value: '', isActive: true },
        { key: '  ', value: 'ignored', isActive: true },
        { key: 'X-Kept', value: 'yes', isActive: true },
      ],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers['x-kept']).toEqual(['yes']);
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(Object.keys(lastCall.headers).some((key) => key.trim() === '')).toBe(false);
  });

  it('fetchAsync() should send the mime type of a text body as its content type', async () => {
    // Arrange
    const url = new URL('https://example.com/text');
    mockAgent.get(url.origin).intercept({ path: url.pathname, method: 'POST' }).reply(200, 'OK');
    const httpService = new HttpService({ get: async () => mockAgent });
    vi.spyOn(PersistenceService.instance, 'loadTextBodyOfRequest').mockImplementation(
      async () => Readable.from('{}') as fs.ReadStream
    );
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Text Body Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'application/json' },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers['content-type']).toEqual(['application/json']);
  });

  it('fetchAsync() should not send the automatic headers the request disables', async () => {
    // Arrange
    const url = new URL('https://example.com/disabled');
    const httpService = setupMockHttpService(url, null);
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Disabled Headers Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      disabledHeaders: ['content-type', 'user-agent'],
      body: { type: RequestBodyType.TEXT, mimeType: 'application/json' },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    const headers = mockAgent.getCallHistory()?.lastCall()?.headers;
    expect(headers).not.toHaveProperty('content-type');
    expect(headers).not.toHaveProperty('user-agent');
  });

  it('fetchAsync() should send neither a body nor a content type for a request without a body', async () => {
    // Arrange
    const url = new URL('https://example.com/none');
    mockAgent.get(url.origin).intercept({ path: url.pathname, method: 'POST' }).reply(200, 'OK');
    const httpService = new HttpService({ get: async () => mockAgent });
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'No Body Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: { type: RequestBodyType.NONE },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers).not.toHaveProperty('content-type');
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.body).toBeUndefined();
  });

  it('fetchAsync() should send form data with text fields', async () => {
    // Arrange
    const url = new URL('https://example.com/formtext');
    const mockClient = mockAgent.get(url.origin);
    mockClient.intercept({ path: url.pathname, method: 'POST' }).reply(200, 'OK');
    const httpService = new HttpService({ get: async () => mockAgent });
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: Date.now(),
      title: 'Form Data Text Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: {
        type: RequestBodyType.FORM_DATA,
        fields: [
          {
            key: 'name',
            isActive: true,
            value: { type: RequestBodyType.TEXT, text: 'John', mimeType: 'text/plain' },
          },
          {
            key: 'email',
            isActive: true,
            value: { type: RequestBodyType.TEXT, text: 'john@example.com', mimeType: 'text/plain' },
          },
        ],
      },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    const body: FormData = lastCall.body as unknown as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('name')).toEqual('John');
  });

  it('fetchAsync() should send form data with file fields', async () => {
    // Arrange
    const url = new URL('https://example.com/formfile');
    const mockClient = mockAgent.get(url.origin);
    mockClient.intercept({ path: url.pathname, method: 'POST' }).reply(200, 'OK');
    const httpService = new HttpService({ get: async () => mockAgent });

    const fileContent = 'test file content';
    const openAsBlob = vi
      .spyOn(fs, 'openAsBlob')
      .mockImplementation(async (_, options) => new Blob([fileContent], options));
    const open = vi.spyOn(fsp, 'open');

    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: Date.now(),
      title: 'Form Data File Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: {
        type: RequestBodyType.FORM_DATA,
        fields: [
          {
            key: 'file',
            isActive: true,
            value: {
              type: RequestBodyType.FILE,
              filePath: '/mock/test.txt',
              fileName: 'test.txt',
              mimeType: 'text/plain',
            },
          },
        ],
      },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    // @ts-expect-error getCallHistory() return type may not have lastCall
    const lastCall = mockAgent.getCallHistory().lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    const body: FormData = lastCall.body as unknown as FormData;
    expect(body).toBeInstanceOf(FormData);
    const file = body.get('file') as Blob as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('test.txt');
    expect(file.type).toBe('text/plain');
    expect(await file.text()).toBe(fileContent);
    // the file is opened as a file-backed blob instead of being read into memory
    expect(openAsBlob).toHaveBeenCalledWith('/mock/test.txt', { type: 'text/plain' });
    expect(open).not.toHaveBeenCalled();
  });

  it('fetchAsync() should replace variables in form data fields', async () => {
    // Arrange
    const variables = new Map([
      ['username', 'alice'],
      ['token', 'secret123'],
    ]);

    const url = new URL('https://example.com/formvars');
    const mockClient = mockAgent.get(url.origin);
    mockClient.intercept({ path: url.pathname, method: 'POST' }).reply(200, 'OK');
    const httpService = new HttpService({ get: async () => mockAgent });
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: Date.now(),
      title: 'FormVars Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: {
        type: RequestBodyType.FORM_DATA,
        fields: [
          {
            key: 'user',
            isActive: true,
            value: { type: RequestBodyType.TEXT, text: '{{ username }}', mimeType: 'text/plain' },
          },
          {
            key: 'apikey',
            isActive: true,
            value: { type: RequestBodyType.TEXT, text: '{{ token }}', mimeType: 'text/plain' },
          },
        ],
      },
    };

    // Act
    await httpService.fetchAsync(await prepare(request, withVariables(variables)), recorder);

    // Assert
    // @ts-expect-error getCallHistory() return type may not have lastCall
    const lastCall = mockAgent.getCallHistory().lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    const body: FormData = lastCall.body as unknown as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('user')).toEqual('alice');
    expect(body.get('apikey')).toEqual('secret123');
  });

  it('fetchAsync() should execute scripts when provided', async () => {
    // Arrange
    const preScript = 'console.log("pre");';
    const postScript = 'console.log("post");';
    vi.spyOn(PersistenceService.instance, 'loadScript')
      .mockResolvedValueOnce(Readable.from(preScript) as fs.ReadStream)
      .mockResolvedValueOnce(Readable.from(postScript) as fs.ReadStream);
    const executeSpy = vi.spyOn(ScriptingService.instance, 'executeScript');

    const url = new URL('https://example.com/api/data');
    const httpService = setupMockHttpService(url, 'OK');
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Scripted Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    expect(executeSpy).toHaveBeenCalledTimes(2);
    expect(executeSpy.mock.calls[0]?.[0]).toEqual(preScript);
    expect(executeSpy.mock.calls[1]?.[0]).toEqual(postScript);
    expect(recorder.scriptLog).toHaveBeenCalledWith(
      expect.objectContaining({ script: ScriptType.PRE_REQUEST, args: ['pre'] })
    );
    expect(recorder.scriptLog).toHaveBeenCalledWith(
      expect.objectContaining({ script: ScriptType.POST_RESPONSE, args: ['post'] })
    );
  });

  it('fetchAsync() should send the body and run the scripts the request had when it was prepared', async () => {
    // Arrange
    const url = new URL('https://example.com/api/prepared');
    const mockClient = mockAgent.get(url.origin);
    mockClient.intercept({ path: url.pathname, method: 'POST' }).reply(200, 'OK');
    const httpService = new HttpService({ get: async () => mockAgent });
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Edited Meanwhile',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
      draft: true,
    };
    const files = {
      body: 'prepared body',
      [ScriptType.PRE_REQUEST]: 'pre',
      [ScriptType.POST_RESPONSE]: 'post',
    };
    vi.spyOn(PersistenceService.instance, 'loadTextBodyOfRequest').mockImplementation(
      async () => Readable.from(files.body) as fs.ReadStream
    );
    vi.spyOn(PersistenceService.instance, 'loadScript').mockImplementation(
      async (_, type) => Readable.from(files[type]) as fs.ReadStream
    );
    const executeSpy = vi
      .spyOn(ScriptingService.instance, 'executeScript')
      .mockImplementation(async (_code, _type, _log, scriptModel) => scriptModel);
    const prepared = await prepare(request);

    // the files of the request change after it was prepared
    files.body = 'edited body';
    files[ScriptType.PRE_REQUEST] = 'edited pre';
    files[ScriptType.POST_RESPONSE] = 'edited post';

    // Act
    await httpService.fetchAsync(prepared, recorder);

    // Assert
    expect(executeSpy.mock.calls.map(([code]) => code)).toEqual(['pre', 'post']);
    const bodyCopy: BodyCopy | undefined = recorder.sent.mock.calls[0]?.[1];
    await bodyCopy?.done;
    expect(await readText(responseBodyService.openBody(bodyCopy!.id)!)).toEqual('prepared body');
  });

  it('fetchAsync() should not send a request whose collection was closed meanwhile', async () => {
    // Arrange
    const url = new URL('https://example.com/api/closed');
    const dispatchers = { get: vi.fn(async (): Promise<Dispatcher> => mockAgent) };
    const httpService = new HttpService(dispatchers);
    vi.spyOn(PersistenceService.instance, 'loadScript').mockImplementation(async (_, type) =>
      type === ScriptType.PRE_REQUEST ? (Readable.from('pre') as fs.ReadStream) : undefined
    );
    const executeSpy = vi.spyOn(ScriptingService.instance, 'executeScript');
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Closed Collection',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };
    const closed = { ...model, collection: { ...model.collection, id: 'closed-collection' } };
    const prepared = await prepare(request, closed);

    // Act & Assert
    await expect(httpService.fetchAsync(prepared, recorder)).rejects.toMatchObject({
      title: 'Collection Changed',
    });
    expect(executeSpy).toHaveBeenCalledWith(
      'pre',
      ScriptType.PRE_REQUEST,
      expect.any(Function),
      closed
    );
    expect(dispatchers.get).not.toHaveBeenCalled();
    expect(recorder.sent).not.toHaveBeenCalled();
  });

  it('fetchAsync() should keep the response if the collection changed before the post-response script', async () => {
    // Arrange
    const url = new URL('https://example.com/api/closed-after-send');
    mockAgent.get(url.origin).intercept({ path: url.pathname, method: 'POST' }).reply(200, 'kept');
    const httpService = new HttpService({ get: async () => mockAgent });
    vi.spyOn(PersistenceService.instance, 'loadScript').mockImplementation(async (_, type) =>
      type === ScriptType.POST_RESPONSE ? (Readable.from('post') as fs.ReadStream) : undefined
    );
    const closed = { ...model, collection: { ...model.collection, id: 'closed-collection' } };
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Closed After Send',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    // Act
    const response = await httpService.fetchAsync(await prepare(request, closed), recorder);

    // Assert
    expect(response.metaInfo.status).toBe(200);
    expect(await readText(responseBodyService.openBody(response.body!.id)!)).toBe('kept');
    expect(recorder.scriptLog).toHaveBeenCalledWith(
      expect.objectContaining({ script: ScriptType.POST_RESPONSE, level: 'warn' })
    );
  });

  it('fetchAsync() should run the post-response script after the response body is stored', async () => {
    // Arrange
    const text = 'the whole response body';
    const url = new URL('https://example.com/api/post-response-body');
    const httpService = setupMockHttpService(url, text);
    vi.spyOn(PersistenceService.instance, 'loadScript').mockImplementation(async (_, type) =>
      type === ScriptType.POST_RESPONSE ? (Readable.from('post') as fs.ReadStream) : undefined
    );
    const createSpy = vi.spyOn(responseBodyService, 'create');
    let storedSizeWhenScriptRan: number | undefined;
    vi.spyOn(ScriptingService.instance, 'executeScript').mockImplementation(
      async (_code, _type, _log, scriptModel) => {
        const id = createSpy.mock.results[0]?.value.id;
        storedSizeWhenScriptRan = id == null ? undefined : responseBodyService.getSize(id);
        return scriptModel;
      }
    );
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Post-Response Body',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    expect(storedSizeWhenScriptRan).toBe(text.length);
  });

  it('fetchAsync() should report the request exactly as it is sent to the recorder', async () => {
    // Arrange
    const url = new URL('https://example.com/api/recorded');
    const httpService = setupMockHttpService(url, 'OK');
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Recorded Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [{ key: 'x-trace', value: 'abc', isActive: true }],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
      auth: { type: AuthorizationType.BASIC, username: 'user', password: 'secret' },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    expect(recorder.sent).toHaveBeenCalledWith(
      {
        method: RequestMethod.GET,
        url: url.toString(),
        headers: expect.objectContaining({
          'x-trace': ['abc'],
          authorization: [expect.stringMatching(/^Basic /)],
        }),
      },
      undefined
    );
  });

  it('fetchAsync() should never write the request or response to the app log', async () => {
    // Arrange
    const password = 'app-log-secret';
    const url = new URL('https://example.com/api/redacted');
    const httpService = setupMockHttpService(url, 'OK', { 'set-cookie': 'session=app-log-cookie' });
    const spies = (['info', 'debug', 'warn', 'error'] as const).map((level) =>
      vi.spyOn(logger, level)
    );
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Redacted Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
      auth: { type: AuthorizationType.BASIC, username: 'user', password },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    const logged = spies.flatMap((spy) => spy.mock.calls.flat()).map(String);
    expect(logged.some((arg) => arg.includes(password))).toBe(false);
    expect(logged.some((arg) => arg.includes('app-log-cookie'))).toBe(false);
  });

  it('fetchAsync() should send a file body with the size of the opened file', async () => {
    // Arrange
    const url = new URL('https://example.com/api/file');
    mockAgent.get(url.origin).intercept({ path: url.pathname, method: 'POST' }).reply(200, 'OK');
    const httpService = new HttpService({ get: async () => mockAgent });
    await fsp.mkdir(USER_DATA_DIR, { recursive: true });
    const filePath = path.join(USER_DATA_DIR, `${randomUUID()}.txt`);
    await fsp.writeFile(filePath, 'file content');
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'File Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: { type: RequestBodyType.FILE, filePath },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    expect(recorder.sent.mock.calls[0]?.[0].headers['content-length']).toEqual(['12']);
    const bodyCopy: BodyCopy | undefined = recorder.sent.mock.calls[0]?.[1];
    await bodyCopy?.done;
    expect(await readText(responseBodyService.openBody(bodyCopy!.id)!)).toEqual('file content');
  });

  it('fetchAsync() should close the file body if sending fails', async () => {
    // Arrange
    const url = new URL('https://example.com/api/file-failure');
    mockAgent
      .get(url.origin)
      .intercept({ path: url.pathname, method: 'POST' })
      .replyWithError(new Error('connection refused'));
    const httpService = new HttpService({ get: async () => mockAgent });
    await fsp.mkdir(USER_DATA_DIR, { recursive: true });
    const filePath = path.join(USER_DATA_DIR, `${randomUUID()}.txt`);
    await fsp.writeFile(filePath, 'file content');
    const open = fsp.open.bind(fsp);
    const handles: Awaited<ReturnType<typeof fsp.open>>[] = [];
    vi.spyOn(fsp, 'open').mockImplementation(async (...args) => {
      const handle = await open(...args);
      handles.push(handle);
      return handle;
    });
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'File Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: { type: RequestBodyType.FILE, filePath },
    };

    // Act
    await expect(httpService.fetchAsync(await prepare(request), recorder)).rejects.toThrow(
      'connection refused'
    );

    // Assert: the file handle is closed once the stream is destroyed
    expect(handles).toHaveLength(1);
    await vi.waitFor(() => expect(handles[0].fd).toBe(-1));
  });

  it('fetchAsync() should close the file body if resolving the headers fails', async () => {
    // Arrange
    const url = new URL('https://example.com/api/header-failure');
    const httpService = new HttpService({ get: async () => mockAgent });
    await fsp.mkdir(USER_DATA_DIR, { recursive: true });
    const filePath = path.join(USER_DATA_DIR, `${randomUUID()}.txt`);
    await fsp.writeFile(filePath, 'file content');
    const open = fsp.open.bind(fsp);
    const handles: Awaited<ReturnType<typeof fsp.open>>[] = [];
    vi.spyOn(fsp, 'open').mockImplementation(async (...args) => {
      const handle = await open(...args);
      handles.push(handle);
      return handle;
    });
    const { resolveVariablesInString: resolve } = await vi.importActual<
      typeof import('main/environment/service/variable-resolver')
    >('main/environment/service/variable-resolver');
    vi.mocked(resolveVariablesInString).mockImplementation(async (model, value, ...rest) => {
      if (value === 'fails') throw new Error('cannot resolve');
      return await resolve(model, value, ...rest);
    });
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'File Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [{ key: 'X-Fails', value: 'fails', isActive: true }],
      body: { type: RequestBodyType.FILE, filePath },
    };

    try {
      // Act
      await expect(httpService.fetchAsync(await prepare(request), recorder)).rejects.toThrow();

      // Assert: the file handle is closed once the stream is destroyed
      expect(handles).toHaveLength(1);
      await vi.waitFor(() => expect(handles[0].fd).toBe(-1));
    } finally {
      vi.mocked(resolveVariablesInString).mockImplementation(resolve);
    }
  });

  it('fetchAsync() should use the client certificate of the collection', async () => {
    // Arrange
    const url = new URL('https://example.com/api/certificate');
    mockAgent.get(url.origin).intercept({ path: url.pathname }).reply(200, 'OK');
    const dispatchers = { get: vi.fn(async (): Promise<Dispatcher> => mockAgent) };
    const httpService = new HttpService(dispatchers);
    const clientCertificate = { certPath: '/cert.pem' };
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Certificate Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };
    const certificateModel = {
      ...model,
      collection: { ...model.collection, clientCertificate },
    };

    // Act
    await httpService.fetchAsync(await prepare(request, certificateModel), recorder);

    // Assert
    expect(dispatchers.get).toHaveBeenCalledWith({
      verifyTlsCertificates: true,
      clientCertificate,
    });
  });

  it('fetchAsync() should not verify TLS certificates if the app settings say so', async () => {
    // Arrange
    const url = new URL('https://example.com/api/unverified');
    mockAgent.get(url.origin).intercept({ path: url.pathname }).reply(200, 'OK');
    const dispatchers = { get: vi.fn(async (): Promise<Dispatcher> => mockAgent) };
    const httpService = new HttpService(dispatchers);
    vi.spyOn(SettingsService.instance, 'settings', 'get').mockReturnValue({
      theme: 'system',
      verifyTlsCertificates: false,
    });
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Unverified Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    expect(dispatchers.get).toHaveBeenCalledWith({ verifyTlsCertificates: false });
  });

  it('fetchAsync() should answer the Digest challenge of a request sent without its body', async () => {
    // Arrange
    const url = new URL('https://example.com/api/digest?a=1');
    const pool = mockAgent.get(url.origin);
    const target = url.pathname + url.search;
    pool.intercept({ path: target, method: 'POST' }).reply(401, '', {
      headers: { 'www-authenticate': 'Digest realm="r", nonce="n", qop="auth"' },
    });
    pool.intercept({ path: target, method: 'POST' }).reply(200, 'OK');
    const httpService = new HttpService({ get: async () => mockAgent });
    vi.spyOn(PersistenceService.instance, 'loadTextBodyOfRequest').mockResolvedValue(
      Readable.from(['the body']) as fs.ReadStream
    );
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Digest Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [{ key: 'X-Custom', value: 'custom', isActive: true }],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
      auth: { type: AuthorizationType.DIGEST, username: 'user', password: 'pass' },
    };

    // Act
    const response = await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    expect(response.metaInfo.status).toBe(200);
    const [probe, sent] = mockAgent.getCallHistory()?.calls().slice(-2) ?? [];
    expect(probe.headers).toMatchObject({ 'x-custom': ['custom'] });
    expect(probe.headers).not.toHaveProperty('authorization');
    expect(probe.headers).not.toHaveProperty('content-type');
    expect(probe.body).toBeFalsy();
    expect(sent.headers).toMatchObject({
      'x-custom': ['custom'],
      'content-type': ['text/plain'],
      authorization: [
        expect.stringMatching(
          /^Digest username="user", realm="r", nonce="n", uri="\/api\/digest\?a=1", response="[0-9a-f]{32}", qop=auth, nc=00000001, cnonce="[0-9a-f]{32}"$/
        ),
      ],
    });
    // only the request that is sent with its body is recorded
    expect(recorder.sent).toHaveBeenCalledOnce();
  });

  it('fetchAsync() should fail with Digest authorization if the server does not challenge', async () => {
    // Arrange
    const url = new URL('https://example.com/api/no-digest');
    const httpService = setupMockHttpService(url, 'OK');
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Digest Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.NONE },
      auth: { type: AuthorizationType.DIGEST, username: 'user', password: 'pass' },
    };

    // Act & Assert
    await expect(httpService.fetchAsync(await prepare(request), recorder)).rejects.toMatchObject({
      title: 'No Digest Challenge',
    });
    expect(recorder.sent).not.toHaveBeenCalled();
  });

  it('fetchAsync() should resolve the URL, auth and headers with the variables the pre-request script set', async () => {
    // Arrange
    const url = new URL('https://example.com/api/scripted');
    mockAgent.get(url.origin).intercept({ path: url.pathname }).reply(200, 'OK');
    const httpService = new HttpService({ get: async () => mockAgent });
    vi.spyOn(PersistenceService.instance, 'loadScript').mockImplementation(async (_, type) =>
      type === ScriptType.PRE_REQUEST ? (Readable.from('pre') as fs.ReadStream) : undefined
    );
    const scripted = withVariables(
      new Map([
        ['path', 'scripted'],
        ['token', 'from-script'],
      ])
    );
    vi.spyOn(ScriptingService.instance, 'executeScript').mockImplementation(
      async (_code, type, _log, scriptModel) =>
        type === ScriptType.PRE_REQUEST ? scripted : scriptModel
    );
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: 0,
      title: 'Scripted Request',
      url: parseUrl('https://example.com/api/{{ path }}'),
      method: RequestMethod.GET,
      headers: [{ key: 'X-Token', value: '{{ token }}', isActive: true }],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
      auth: { type: AuthorizationType.BEARER, token: '{{ token }}' },
    };

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall?.path).toBe(url.pathname);
    expect(lastCall?.headers).toMatchObject({
      'x-token': ['from-script'],
      authorization: ['Bearer from-script'],
    });
  });
});

describe('HttpService.sendRequest()', () => {
  const request: TrufosRequest = {
    id: randomUUID(),
    parentId: model.collection.id,
    type: 'request',
    lastModified: 0,
    title: 'Test Request',
    url: parseUrl('https://example.com'),
    method: RequestMethod.GET,
    headers: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
  };
  let httpService: HttpService;

  const makeResponse = (): TrufosResponse => ({
    type: 'response',
    body: { id: randomUUID(), size: 0 },
    headers: {},
    metaInfo: {
      status: 200,
      duration: 1,
      size: { totalSizeInBytes: 0, headersSizeInBytes: 0, bodySizeInBytes: 0 },
    },
  });

  /** Lets the fetch hang until it is aborted, then rejects with the given error. */
  const fetchUntilAborted = (error: () => unknown) => {
    let signal: AbortSignal | undefined;
    vi.spyOn(httpService, 'fetchAsync').mockImplementation((_prepared, _recorder, abortSignal) => {
      signal = abortSignal;
      return new Promise((_, reject) => {
        abortSignal?.addEventListener('abort', () => reject(error()));
      });
    });
    return () => signal;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    httpService = new HttpService({ get: async () => mockAgent });
    vi.spyOn(CollectionStateService.instance, 'prepareRequest').mockResolvedValue({
      request,
      model,
      scripts: {},
    });
  });

  it('sends the prepared request', async () => {
    // Arrange
    const prepared = {
      request,
      model,
      textBody: Readable.from('body'),
      scripts: {},
    };
    vi.mocked(CollectionStateService.instance.prepareRequest).mockResolvedValue(prepared);
    const fetchAsync = vi.spyOn(httpService, 'fetchAsync').mockResolvedValue(makeResponse());

    // Act
    await httpService.sendRequest(request.id);

    // Assert
    expect(CollectionStateService.instance.prepareRequest).toHaveBeenCalledWith(request.id);
    expect(fetchAsync).toHaveBeenCalledWith(prepared, expect.anything(), expect.any(AbortSignal));
  });

  it('fails without sending if the request cannot be prepared', async () => {
    // Arrange
    const failure = new Error('Request missing does not exist');
    vi.mocked(CollectionStateService.instance.prepareRequest).mockRejectedValue(failure);
    const fetchAsync = vi.spyOn(httpService, 'fetchAsync');

    // Act & Assert
    await expect(httpService.sendRequest('missing')).rejects.toBe(failure);
    expect(fetchAsync).not.toHaveBeenCalled();
  });

  it('keeps the latest response body of a request alive', async () => {
    // Arrange
    const response = makeResponse();
    vi.spyOn(httpService, 'fetchAsync').mockResolvedValue(response);
    const setLatest = vi.spyOn(LatestResponseBodies.instance, 'set');

    // Act
    await httpService.sendRequest(request.id);

    // Assert
    expect(setLatest).toHaveBeenCalledWith(request.id, response.body!.id);
  });

  it('records the request in the history of the collection', async () => {
    // Arrange
    HistoryService.instance.clear(model.collection.dirPath);
    vi.spyOn(httpService, 'fetchAsync').mockResolvedValue(makeResponse());

    // Act
    await httpService.sendRequest(request.id);

    // Assert
    expect(HistoryService.instance.list(model.collection.dirPath)).toEqual([
      expect.objectContaining({
        requestId: request.id,
        outcome: expect.objectContaining({ type: 'response', status: 200 }),
      }),
    ]);
  });

  it('passes an abort signal for keyed requests and aborts it by key', async () => {
    // Arrange
    const getSignal = fetchUntilAborted(() => new Error('aborted'));
    const sending = httpService.sendRequest(request.id, 'runner-request-1');
    await vi.waitFor(() => expect(getSignal()).toBeDefined());

    // Act
    httpService.abortRequest('runner-request-1');
    await sending;

    // Assert
    expect(getSignal()?.aborted).toBe(true);
  });

  it('keeps the abort key of a later send that reuses it', async () => {
    // Arrange
    const getSignal = fetchUntilAborted(() => new Error('aborted'));
    const first = httpService.sendRequest(request.id, 'shared-key');
    await vi.waitFor(() => expect(getSignal()).toBeDefined());
    const firstSignal = getSignal();
    const second = httpService.sendRequest(request.id, 'shared-key');
    await vi.waitFor(() => expect(getSignal()).not.toBe(firstSignal));
    firstSignal?.dispatchEvent(new Event('abort'));
    await first.catch(() => undefined);

    // Act
    httpService.abortRequest('shared-key');

    // Assert
    await expect(second).resolves.toBeNull();
    expect(getSignal()?.aborted).toBe(true);
  });

  it('does not send a request that was aborted while it was being prepared', async () => {
    // Arrange: the serial queue of the collection state is busy, so preparing takes a while
    let releasePrepare!: () => void;
    const textBody = Readable.from('body');
    vi.mocked(CollectionStateService.instance.prepareRequest).mockReturnValue(
      new Promise<void>((resolve) => (releasePrepare = resolve)).then(() => ({
        request,
        model,
        textBody,
        scripts: {},
      }))
    );
    const fetchAsync = vi.spyOn(httpService, 'fetchAsync').mockResolvedValue(makeResponse());
    HistoryService.instance.clear(model.collection.dirPath);
    const sending = httpService.sendRequest(request.id, 'runner-request-3');

    // Act
    httpService.abortRequest('runner-request-3');
    releasePrepare();

    // Assert
    await expect(sending).resolves.toBeNull();
    expect(fetchAsync).not.toHaveBeenCalled();
    expect(textBody.destroyed).toBe(true);
    expect(HistoryService.instance.list(model.collection.dirPath)).toEqual([]);
  });

  it('resolves an aborted request with null instead of failing', async () => {
    // Arrange: undici rejects with a DOMException, which breaks both logging and IPC serialization
    const getSignal = fetchUntilAborted(
      () => new DOMException('This operation was aborted', 'AbortError')
    );
    const sending = httpService.sendRequest(request.id, 'runner-request-2');
    await vi.waitFor(() => expect(getSignal()).toBeDefined());

    // Act
    httpService.abortRequest('runner-request-2');

    // Assert
    await expect(sending).resolves.toBeNull();
  });

  it('closes the text body whether sending succeeds or fails', async () => {
    // Arrange
    const textBodies = [Readable.from('sent'), Readable.from('failed')];
    for (const textBody of textBodies) {
      vi.mocked(CollectionStateService.instance.prepareRequest).mockResolvedValueOnce({
        request,
        model,
        textBody,
        scripts: {},
      });
    }
    vi.spyOn(httpService, 'fetchAsync')
      .mockResolvedValueOnce(makeResponse())
      .mockRejectedValueOnce(new Error('connection refused'));

    // Act
    await httpService.sendRequest(request.id);
    await expect(httpService.sendRequest(request.id)).rejects.toThrow('connection refused');

    // Assert
    expect(textBodies.map((textBody) => textBody.destroyed)).toEqual([true, true]);
  });

  it('rethrows a non-abort failure unchanged', async () => {
    // Arrange
    const failure = new Error('connection refused');
    vi.spyOn(httpService, 'fetchAsync').mockRejectedValue(failure);

    // Act & Assert
    await expect(httpService.sendRequest(request.id, 'runner-request-3')).rejects.toBe(failure);
  });
});

function setupMockHttpService(
  url: URL,
  body: object | string | null,
  headers?: IncomingHttpHeaders
) {
  let bodyString;
  switch (typeof body) {
    case 'string':
      bodyString = body;
      break;
    case 'object':
      bodyString = JSON.stringify(body);
      break;
    default:
      bodyString = null;
  }

  const mockClient = mockAgent.get(url.origin);
  mockClient
    .intercept({ path: url.pathname })
    .reply(200, bodyString ?? undefined, { headers: headers });
  return new HttpService({ get: async () => mockAgent });
}
