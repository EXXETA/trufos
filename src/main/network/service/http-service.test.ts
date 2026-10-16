import { HttpService, PreparedRequest } from './http-service';
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
import { EnvironmentService } from 'main/environment/service/environment-service';
import { DisplayableError } from 'shim/error/DisplayableError';
import { TemplateReplaceStream, UnmatchedVariableError } from 'template-replace-stream';
import { BodyStore } from 'main/network/service/body-store';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { ScriptingService } from 'main/scripting/scripting-service';
import { Readable } from 'node:stream';
import { text as readText } from 'node:stream/consumers';
import type { RequestRecorder } from 'main/network/service/request-recorder';
import type { BodyCopy } from 'main/network/service/request-body-copy';
import { ScriptType } from 'shim/scripting';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { normalizeCollection } from 'shim/collection-model';
import { freeze } from 'immer';
import { HistoryService } from 'main/history/history-service';
import { LatestResponseBodies } from 'main/network/service/latest-response-bodies';
import type { TrufosResponse } from 'shim/objects/response';

const mockAgent = new MockAgent({ connections: 1 });
const recorder = { sent: vi.fn(), scriptLog: vi.fn() } satisfies RequestRecorder;
const environmentService = EnvironmentService.instance;
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

/** Prepares a request the way `CollectionStateService.prepareRequest()` does. */
async function prepare(request: TrufosRequest): Promise<PreparedRequest> {
  return {
    request,
    collectionId: model.collection.id,
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
    // @ts-expect-error loadScript mock returns null but type expects ReadStream | null
    vi.spyOn(PersistenceService.instance, 'loadScript').mockResolvedValue(null);
    vi.spyOn(PersistenceService.instance, 'loadTextBodyOfRequest').mockResolvedValue(undefined);
    vi.spyOn(CollectionStateService.instance, 'model', 'get').mockReturnValue(model);
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
    expect(lastCall.headers.authorization).toEqual(expectedAuthHeader);
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

    const spy = vi
      .spyOn(environmentService, 'setVariablesInString')
      .mockImplementation((input: string) =>
        TemplateReplaceStream.replaceStringAsync(input, variables)
      );

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
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.origin + lastCall.path).toEqual(expectedFinalUrl);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('fetchAsync() should convert an undefined URL variable into a DisplayableError', async () => {
    // Arrange
    const spy = vi
      .spyOn(environmentService, 'setVariablesInString')
      .mockRejectedValue(new UnmatchedVariableError('baseUrl'));
    const httpService = new HttpService(() => Promise.resolve(mockAgent));
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
    spy.mockRestore();
  });

  it('fetchAsync() should replace variables inside header values', async () => {
    // Arrange
    const variables = new Map([
      ['apiVersion', 'v1'],
      ['token', 'staging-token'],
    ]);
    const spy = vi
      .spyOn(environmentService, 'setVariablesInString')
      .mockImplementation((input: string) =>
        TemplateReplaceStream.replaceStringAsync(input, variables)
      );

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
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers['x-api-version']).toEqual(['v1']);
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers.authorization).toEqual(['Bearer staging-token']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('fetchAsync() should support multiple header values with variable replacement', async () => {
    // Arrange
    const variables = new Map([
      ['trace1', 'abc'],
      ['trace2', 'def'],
    ]);
    const spy = vi
      .spyOn(environmentService, 'setVariablesInString')
      .mockImplementation((input: string) =>
        TemplateReplaceStream.replaceStringAsync(input, variables)
      );

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
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers['x-trace-id']).toEqual(['abc', 'def']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
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

  it('fetchAsync() should send form data with text fields', async () => {
    // Arrange
    const url = new URL('https://example.com/formtext');
    const mockClient = mockAgent.get(url.origin);
    mockClient.intercept({ path: url.pathname, method: 'POST' }).reply(200, 'OK');
    const httpService = new HttpService(() => Promise.resolve(mockAgent));
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
    const httpService = new HttpService(() => Promise.resolve(mockAgent));

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
    const spy = vi
      .spyOn(environmentService, 'setVariablesInString')
      .mockImplementation((input: string) =>
        TemplateReplaceStream.replaceStringAsync(input, variables)
      );

    const url = new URL('https://example.com/formvars');
    const mockClient = mockAgent.get(url.origin);
    mockClient.intercept({ path: url.pathname, method: 'POST' }).reply(200, 'OK');
    const httpService = new HttpService(() => Promise.resolve(mockAgent));
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
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    // @ts-expect-error getCallHistory() return type may not have lastCall
    const lastCall = mockAgent.getCallHistory().lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    const body: FormData = lastCall.body as unknown as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(spy).toHaveBeenCalled();
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
    const httpService = new HttpService(() => Promise.resolve(mockAgent));
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
      .mockResolvedValue(undefined);
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
    const dispatcherProvider = vi.fn(() => Promise.resolve<Dispatcher>(mockAgent));
    const httpService = new HttpService(dispatcherProvider);
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
    const prepared = { ...(await prepare(request)), collectionId: 'closed-collection' };

    // Act & Assert
    await expect(httpService.fetchAsync(prepared, recorder)).rejects.toMatchObject({
      title: 'Collection Changed',
    });
    expect(executeSpy).toHaveBeenCalledWith(
      'pre',
      ScriptType.PRE_REQUEST,
      expect.any(Function),
      'closed-collection'
    );
    expect(dispatcherProvider).not.toHaveBeenCalled();
    expect(recorder.sent).not.toHaveBeenCalled();
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
          authorization: expect.stringMatching(/^Basic /),
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
    const httpService = new HttpService(() => Promise.resolve(mockAgent));
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
    expect(recorder.sent.mock.calls[0]?.[0].headers['content-length']).toBe('12');
    const bodyCopy: BodyCopy | undefined = recorder.sent.mock.calls[0]?.[1];
    await bodyCopy?.done;
    expect(await readText(responseBodyService.openBody(bodyCopy!.id)!)).toEqual('file content');
  });

  it('fetchAsync() should use the client certificate of the collection', async () => {
    // Arrange
    const url = new URL('https://example.com/api/certificate');
    mockAgent.get(url.origin).intercept({ path: url.pathname }).reply(200, 'OK');
    const dispatcherProvider = vi.fn(() => Promise.resolve(mockAgent));
    const httpService = new HttpService(dispatcherProvider);
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
    vi.spyOn(CollectionStateService.instance, 'model', 'get').mockReturnValue({
      ...model,
      collection: { ...model.collection, clientCertificate },
    });

    // Act
    await httpService.fetchAsync(await prepare(request), recorder);

    // Assert
    expect(dispatcherProvider).toHaveBeenCalledWith(clientCertificate);
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
    httpService = new HttpService(() => Promise.resolve(mockAgent));
    vi.spyOn(CollectionStateService.instance, 'model', 'get').mockReturnValue(model);
    vi.spyOn(CollectionStateService.instance, 'prepareRequest').mockResolvedValue({
      request,
      collectionId: model.collection.id,
      scripts: {},
    });
  });

  it('sends the prepared request', async () => {
    // Arrange
    const prepared = {
      request,
      collectionId: model.collection.id,
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
        collectionId: model.collection.id,
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
  return new HttpService(() => Promise.resolve(mockAgent));
}
