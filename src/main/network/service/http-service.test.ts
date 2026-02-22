import { HttpService } from './http-service';
import { MockAgent } from 'undici';
import fs from 'node:fs';
import { TrufosRequest } from 'shim/objects/request';
import { parseUrl } from 'shim/objects/url';
import { randomUUID } from 'node:crypto';
import { RequestMethod } from 'shim/objects/request-method';
import { IncomingHttpHeaders } from 'undici/types/header';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { AuthorizationType } from 'shim/objects';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { TemplateReplaceStream } from 'template-replace-stream';
import { ResponseBodyService } from 'main/network/service/response-body-service';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { ScriptingService } from 'main/scripting/scripting-service';
import { Readable } from 'node:stream';

const mockAgent = new MockAgent({ connections: 1 });
const environmentService = EnvironmentService.instance;
const responseBodyService = ResponseBodyService.instance;

describe('HttpService', () => {
  beforeAll(() => {
    mockAgent.disableNetConnect();
    mockAgent.enableCallHistory();
  });

  beforeEach(() => {
    vi.spyOn(PersistenceService.instance, 'loadScript').mockResolvedValue(null);
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
    const responseBody = fs.readFileSync(filePath, 'utf8').toString();
    expect(responseBody).toEqual(text);
  });

  it('fetchAsync() should calculate the request size', async () => {
    // Arrange
    const responseBodyMock = {
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    };
    const responseHeadersMock: IncomingHttpHeaders = {
      'content-type': 'application/json',
      'content-length': '5000',
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
      body: null,
    };

    // Act
    const result = await httpService.fetchAsync(request);

    // Assert
    expect(result.metaInfo.size).toEqual({
      bodySizeInBytes: 5000,
      headersSizeInBytes: 54,
      totalSizeInBytes: 5054,
    });
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
      body: null,
      auth: { type: AuthorizationType.BASIC, username, password },
    };
    const httpService = setupMockHttpService(url, null);

    // Act
    await httpService.fetchAsync(request);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
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
      body: null,
    };

    // Act
    await httpService.fetchAsync(request);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
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
      body: null,
    };

    // Act
    await httpService.fetchAsync(request);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    expect(lastCall.headers['x-api-version']).toEqual(['v1']);
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
      body: null,
    };

    // Act
    await httpService.fetchAsync(request);

    // Assert
    const lastCall = mockAgent.getCallHistory()?.lastCall();
    expect(lastCall).toBeDefined();
    expect(lastCall.headers['x-trace-id']).toEqual(['abc', 'def']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
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
      body: null,
    };

    // Act
    await httpService.fetchAsync(request);

    // Assert
    expect(executeSpy).toHaveBeenCalledTimes(2);
    expect(executeSpy.mock.calls[0]?.[0]).toEqual(preScript);
    expect(executeSpy.mock.calls[1]?.[0]).toEqual(postScript);
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
  mockClient.intercept({ path: url.pathname }).reply(200, bodyString, { headers: headers });
  return new HttpService(mockAgent);
}
