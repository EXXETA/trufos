import { HttpService } from './http-service';
import { MockAgent } from 'undici';
import fs from 'node:fs';
import { RufusRequest } from 'shim/objects/request';
import { randomUUID } from 'node:crypto';
import { RequestMethod } from 'shim/objects/requestMethod';
import { IncomingHttpHeaders } from 'undici/types/header';

describe('HttpService', () => {
  it('fetchAsync should make an HTTP call and return the body on read', async () => {

    // Arrange
    const text = 'Hello, world!';
    const url = new URL('https://example.com/api/data');
    const httpService = setupMockHttpService(url, RequestMethod.get, text);
    const request: RufusRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      title: 'Test Request',
      url: url.toString(),
      method: RequestMethod.get,
      headers: [],
      body: null,
    };

    // Act
    const result = await httpService.fetchAsync(request);

    // Assert
    expect(result.metaInfo.status).toEqual(200);
    expect(result.metaInfo.duration).toBeGreaterThanOrEqual(0);

    const responseBody = fs.readFileSync(result.bodyFilePath, 'utf8').toString();
    expect(responseBody).toEqual(text);
  });

  it('fetchAsync should calculate the request size', async () => {
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
    const httpService = setupMockHttpService(url, RequestMethod.get, responseBodyMock, responseHeadersMock);
    const request: RufusRequest = {
      id: randomUUID(),
      parentId: randomUUID(),
      type: 'request',
      title: 'Test Request',
      url: url.toString(),
      method: RequestMethod.get,
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

});

function setupMockHttpService(url: URL, method: RequestMethod, body: object | string | null, headers?: IncomingHttpHeaders) {
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
  const mockAgent = new MockAgent({ connections: 1 });
  const mockClient = mockAgent.get(url.origin);
  mockClient.intercept({ path: url.pathname }).reply(200, bodyString, { headers: headers });
  return new HttpService(mockAgent);
}
