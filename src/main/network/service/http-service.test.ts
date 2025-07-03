import { HttpService } from './http-service';
import { MockAgent } from 'undici';
import fs from 'node:fs';
import { TrufosRequest } from 'shim/objects/request';
import { randomUUID } from 'node:crypto';
import { RequestMethod } from 'shim/objects/request-method';
import { IncomingHttpHeaders } from 'undici/types/header';
import { describe, it, expect, beforeAll } from 'vitest';
import { AuthorizationType } from 'shim/objects/auth';

const mockAgent = new MockAgent({ connections: 1 });

describe('HttpService', () => {
  beforeAll(() => {
    mockAgent.disableNetConnect();
    mockAgent.enableCallHistory();
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
      url: url.toString(),
      method: RequestMethod.GET,
      headers: [],
      body: null,
      queryParams: [],
    };

    // Act
    const result = await httpService.fetchAsync(request);

    // Assert
    expect(result.metaInfo.status).toEqual(200);
    expect(result.metaInfo.duration).toBeGreaterThanOrEqual(0);

    const responseBody = fs.readFileSync(result.bodyFilePath, 'utf8').toString();
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
      url: url.toString(),
      method: RequestMethod.GET,
      headers: [],
      body: null,
      queryParams: [],
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
      url: url.toString(),
      method: RequestMethod.GET,
      headers: [],
      body: null,
      queryParams: [],
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
      url: url.toString(),
      method: RequestMethod.GET,
      headers: [{ key: 'Authorization', value: authorizationValue, isActive: true }],
      body: null,
      queryParams: [],
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
