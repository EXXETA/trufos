import { HttpService } from './http-service';
import { MockAgent } from 'undici';
import fs from 'node:fs';
import { Request } from 'shim/http';

jest.mock('electron', () => {
  return {
    app: {
      getPath: jest.fn().mockReturnValue('')
    }
  };
});

describe('HttpService', () => {
  it('fetchAsync should make an HTTP call and return the body on read', async () => {

    // Arrange
    const text = 'Hello, world!';
    const url = new URL('https://example.com/api/data');
    const mockAgent = new MockAgent({ connections: 1 });
    const mockClient = mockAgent.get(url.origin);
    mockClient.intercept({ path: url.pathname }).reply(200, text);

    const httpService = new HttpService(mockAgent);
    const request: Request = {
      url: url.toString(),
      method: 'GET',
      headers: {},
      body: null,
      dirPath: ''
    };

    // Act
    const result = await httpService.fetchAsync(request);

    // Assert
    expect(result.status).toEqual(200);
    expect(result.duration).toBeGreaterThanOrEqual(0);

    const responseBody = fs.readFileSync(result.bodyFilePath, 'utf8').toString();
    expect(responseBody).toEqual(text);
  });
});
