import { HttpService } from './http-service';
import { MockAgent, FormData } from 'undici';
import fs from 'node:fs';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { parseUrl } from 'shim/objects/url';
import { randomUUID } from 'node:crypto';
import { RequestMethod } from 'shim/objects/request-method';
import { IncomingHttpHeaders } from 'undici/types/header';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { AuthorizationType } from 'shim/objects';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { TemplateReplaceStream } from 'template-replace-stream';
import { ResponseBodyService } from 'main/network/service/response-body-service';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { ScriptingService } from 'main/scripting/scripting-service';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';

const mockAgent = new MockAgent({ connections: 1 });
const environmentService = EnvironmentService.instance;
const responseBodyService = ResponseBodyService.instance;
const fileSystemService = FileSystemService.instance;

describe('HttpService', () => {
  beforeAll(() => {
    mockAgent.disableNetConnect();
    mockAgent.enableCallHistory();
  });

  beforeEach(() => {
    // @ts-expect-error loadScript mock returns null but type expects ReadStream | null
    vi.spyOn(PersistenceService.instance, 'loadScript').mockResolvedValue(null);
    vi.spyOn(environmentService, 'currentCollection', 'get').mockReturnValue({
      clientCertificate: null,
    } as never);
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
      title: 'Test Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      // @ts-expect-error body: null is not in RequestBody union but used in tests
      body: null,
    };

    // Act
    const result = await httpService.fetchAsync(request);

    // Assert
    expect(result.metaInfo.status).toEqual(200);
    expect(result.metaInfo.duration).toBeGreaterThanOrEqual(0);
    expect(result.id).toBeDefined();

    const filePath = responseBodyService.getFilePath(result.id);
    expect(filePath).toBeDefined();
    const responseBody = fs.readFileSync(filePath!, 'utf8').toString();
    expect(responseBody).toEqual(text);
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
      title: 'Test Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      // @ts-expect-error body: null is not in RequestBody union but used in tests
      body: null,
    };

    // Act
    const result = await httpService.fetchAsync(request);

    // Assert: bodySizeInBytes must reflect the real file size, not the fake content-length
    const filePath = responseBodyService.getFilePath(result.id);
    const actualBodySize = fs.statSync(filePath!).size;
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
      title: 'Test Authenticated Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      // @ts-expect-error body: null is not in RequestBody union but used in tests
      body: null,
      auth: { type: AuthorizationType.BASIC, username, password },
    };
    const httpService = setupMockHttpService(url, null);
    const expectedAuthHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

    // Act
    await httpService.fetchAsync(request);

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
      title: 'Test Authenticated Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [{ key: 'Authorization', value: authorizationValue, isActive: true }],
      // @ts-expect-error body: null is not in RequestBody union but used in tests
      body: null,
      auth: { type: AuthorizationType.BASIC, username, password },
    };
    const httpService = setupMockHttpService(url, null);

    // Act
    await httpService.fetchAsync(request);

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
      title: 'Variable URL Request',
      url: parseUrl(rawUrl),
      method: RequestMethod.GET,
      headers: [],
      // @ts-expect-error body: null is not in RequestBody union but used in tests
      body: null,
    };

    // Act
    await httpService.fetchAsync(request);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.origin + lastCall.path).toEqual(expectedFinalUrl);
    expect(spy).toHaveBeenCalled();
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
      title: 'Header Variable Request',
      url: parseUrl(finalUrl.toString()),
      method: RequestMethod.GET,
      headers: [
        { key: 'X-Api-Version', value: '{{ apiVersion }}', isActive: true },
        { key: 'Authorization', value: 'Bearer {{ token }}', isActive: true },
      ],
      // @ts-expect-error body: null is not in RequestBody union but used in tests
      body: null,
    };

    // Act
    await httpService.fetchAsync(request);

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
      title: 'Multi Header Variable Request',
      url: parseUrl('https://example.com/multi'),
      method: RequestMethod.GET,
      headers: [
        { key: 'X-Trace-Id', value: '{{ trace1 }}', isActive: true },
        { key: 'X-Trace-Id', value: '{{ trace2 }}', isActive: true },
      ],
      // @ts-expect-error body: null is not in RequestBody union but used in tests
      body: null,
    };

    // Act
    await httpService.fetchAsync(request);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers['x-trace-id']).toEqual(['abc', 'def']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
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
    await httpService.fetchAsync(request);

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
    vi.spyOn(fileSystemService, 'readFile').mockResolvedValue(
      Readable.from([fileContent]) as fs.ReadStream
    );
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: fileContent.length } as fs.Stats);

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
    await httpService.fetchAsync(request);

    // Assert
    // @ts-expect-error getCallHistory() return type may not have lastCall
    const lastCall = mockAgent.getCallHistory().lastCall();
    expect(lastCall).toBeDefined();
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    const body: FormData = lastCall.body as unknown as FormData;
    expect(body).toBeInstanceOf(FormData);
    const file = body.get('file') as Blob as File;
    expect(file).toBeInstanceOf(File);
    expect(await file.arrayBuffer()).toEqual(Buffer.from(fileContent).buffer);
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
    await httpService.fetchAsync(request);

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
      title: 'Scripted Request',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      // @ts-expect-error body: null is not in RequestBody union but used in tests
      body: null,
    };

    // Act
    await httpService.fetchAsync(request);

    // Assert
    expect(executeSpy).toHaveBeenCalledTimes(2);
    expect(executeSpy.mock.calls[0]?.[0]).toEqual(preScript);
    expect(executeSpy.mock.calls[1]?.[0]).toEqual(postScript);
  });

  it('fetchAsync() should serialize GraphQL POST requests', async () => {
    const url = new URL('https://example.com/graphql');
    const httpService = setupMockHttpService(url, { data: { hello: 'world' } }, undefined, 'POST');
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: Date.now(),
      title: 'GraphQL POST',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: {
        type: RequestBodyType.GRAPHQL,
        query: 'query Hello($name: String!) { hello(name: $name) }',
        variables: '{"name":"Ada"}',
        operationName: 'Hello',
      },
    };

    await httpService.fetchAsync(request);

    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    expect(lastCall?.method).toEqual('POST');
    // @ts-expect-error lastCall may be undefined, expect() asserts it is defined
    expect(lastCall.headers['content-type']).toEqual('application/json');
    expect(JSON.parse(await text(lastCall?.body as unknown as Readable))).toEqual({
      query: 'query Hello($name: String!) { hello(name: $name) }',
      variables: { name: 'Ada' },
      operationName: 'Hello',
    });
  });

  it('fetchAsync() should accept pasted GraphQL JSON bodies', async () => {
    const url = new URL('https://example.com/graphql');
    const httpService = setupMockHttpService(url, { data: { getAllTcps: [] } }, undefined, 'POST');
    const query =
      'query { getAllTcps(where: { treasuryCompassSC: { tcId: { eq: 19 } } }) { id status } }';
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: Date.now(),
      title: 'GraphQL pasted JSON',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: {
        type: RequestBodyType.GRAPHQL,
        query: JSON.stringify({ query }),
        variables: '{}',
      },
    };

    await httpService.fetchAsync(request);

    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    expect(JSON.parse(await text(lastCall?.body as unknown as Readable))).toEqual({
      query,
      variables: {},
    });
  });

  it('fetchAsync() should serialize GraphQL query requests over GET', async () => {
    const url = new URL('https://example.com/graphql');
    const query = 'query Hello { hello }';
    const path = `/graphql?${new URLSearchParams({
      query,
      variables: '{}',
      operationName: 'Hello',
    }).toString()}`;
    const httpService = setupMockHttpService(
      url,
      { data: { hello: 'world' } },
      undefined,
      'GET',
      path
    );
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: Date.now(),
      title: 'GraphQL GET',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: {
        type: RequestBodyType.GRAPHQL,
        query,
        variables: '{}',
        operationName: 'Hello',
      },
    };

    await httpService.fetchAsync(request);

    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    expect(lastCall?.method).toEqual('GET');
    expect(lastCall?.body).toBeUndefined();
  });

  it('fetchAsync() should reject GraphQL mutations over GET', async () => {
    const url = new URL('https://example.com/graphql');
    const httpService = new HttpService(() => Promise.resolve(mockAgent));
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: Date.now(),
      title: 'GraphQL GET Mutation',
      url: parseUrl(url.toString()),
      method: RequestMethod.GET,
      headers: [],
      body: {
        type: RequestBodyType.GRAPHQL,
        query: 'mutation Save { saveThing }',
        variables: '{}',
      },
    };

    await expect(httpService.fetchAsync(request)).rejects.toThrow(
      'GraphQL mutations cannot be sent over GET'
    );
  });

  it('fetchAsync() should reject invalid GraphQL variables JSON', async () => {
    const url = new URL('https://example.com/graphql');
    const httpService = new HttpService(() => Promise.resolve(mockAgent));
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: Date.now(),
      title: 'GraphQL Invalid Variables',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: {
        type: RequestBodyType.GRAPHQL,
        query: 'query Hello { hello }',
        variables: '{',
      },
    };

    await expect(httpService.fetchAsync(request)).rejects.toThrow(
      'GraphQL variables must be valid JSON'
    );
  });

  it('fetchAsync() should expose GraphQL errors returned with HTTP 200', async () => {
    const responseBody = { data: null, errors: [{ message: 'Nope' }, { message: 'Still nope' }] };
    const url = new URL('https://example.com/graphql');
    const httpService = setupMockHttpService(url, responseBody, undefined, 'POST');
    const request: TrufosRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      lastModified: Date.now(),
      title: 'GraphQL Errors',
      url: parseUrl(url.toString()),
      method: RequestMethod.POST,
      headers: [],
      body: {
        type: RequestBodyType.GRAPHQL,
        query: 'query Hello { hello }',
        variables: '{}',
      },
    };

    const response = await httpService.fetchAsync(request);

    expect(response.metaInfo.status).toEqual(200);
    expect(response.metaInfo.graphqlErrors).toEqual(2);
  });
});

function setupMockHttpService(
  url: URL,
  body: object | string | null,
  headers?: IncomingHttpHeaders,
  method = 'GET',
  path = url.pathname
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
  mockClient.intercept({ path, method }).reply(200, bodyString ?? undefined, { headers: headers });
  return new HttpService(() => Promise.resolve(mockAgent));
}
