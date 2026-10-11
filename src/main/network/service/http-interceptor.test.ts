import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import undici, { Dispatcher, FormData, MockAgent } from 'undici';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { HistoryService } from 'main/history/history-service';
import { ResponseBodyService } from 'main/network/service/response-body-service';
import { RequestMethod } from 'shim/objects/request-method';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { parseUrl } from 'shim/objects/url';
import { httpInterceptor } from './http-interceptor';

const ORIGIN = 'https://example.com';
const mockAgent = new MockAgent();
const dispatcher = mockAgent.compose(httpInterceptor);
const history = HistoryService.instance;

/** Like a real server, the mock reads the whole request body before it replies. */
function mockReply(path: string, method = 'POST') {
  mockAgent
    .get(ORIGIN)
    .intercept({ path, method })
    .reply(200, async ({ body }) => {
      if (body instanceof Readable) await text(body);
      return 'OK';
    });
}

function createRequest(): TrufosRequest {
  return {
    id: randomUUID(),
    parentId: randomUUID(),
    type: 'request',
    lastModified: 0,
    title: 'Test',
    url: parseUrl(ORIGIN),
    method: RequestMethod.POST,
    headers: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
  };
}

/** Sends a request within a history context and returns the recorded entry. */
async function send(
  path: string,
  options: Omit<Parameters<typeof undici.request>[1], 'dispatcher'>
) {
  await history.record(createRequest(), async () => {
    const response = await undici.request(`${ORIGIN}${path}`, { dispatcher, ...options });
    await response.body.text();
    return null;
  });
  return history.get(history.list()[0].id)!;
}

function readBody(id: string) {
  return fs.readFileSync(ResponseBodyService.instance.getFilePath(id)!);
}

describe('httpInterceptor', () => {
  beforeAll(() => {
    mockAgent.disableNetConnect();
  });

  beforeEach(() => {
    history.clear();
  });

  it('should record the request exactly as it is sent, unredacted', async () => {
    // Arrange
    mockReply('/users?page=1');

    // Act
    const entry = await send('/users?page=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer secret',
        'x-multi': ['a', 'b'],
        'x-unset': undefined,
      },
      body: Readable.from(['{"name":', '"Ada"}']),
    });

    // Assert
    expect(entry.url).toBe(`${ORIGIN}/users?page=1`);
    expect(entry.request).toEqual({
      method: 'POST',
      url: `${ORIGIN}/users?page=1`,
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer secret',
        'x-multi': ['a', 'b'],
      },
      body: { id: expect.any(String), size: 14 },
    });
    expect((await readBody(entry.request!.body!.id)).toString()).toBe('{"name":"Ada"}');
  });

  it('should pass the request body through unchanged', async () => {
    // Arrange
    let received: string | undefined;
    mockAgent
      .get(ORIGIN)
      .intercept({ path: '/echo', method: 'POST' })
      .reply(200, async ({ body }) => {
        received = await text(body as Readable);
        return 'OK';
      });

    // Act
    await send('/echo', { method: 'POST', body: Readable.from(['hello ', 'world']) });

    // Assert
    expect(received).toBe('hello world');
  });

  it('should store binary bodies byte by byte', async () => {
    // Arrange
    mockReply('/upload');
    const bytes = Buffer.from([0, 255, 1, 254]);

    // Act
    const entry = await send('/upload', { method: 'POST', body: Readable.from([bytes]) });

    // Assert
    expect(await readBody(entry.request!.body!.id)).toEqual(bytes);
  });

  it('should store form data as multipart body', async () => {
    // Arrange
    mockReply('/form');
    const form = new FormData();
    form.append('name', 'Ada');
    form.append('avatar', new File(['abc'], 'ada.png'));

    // Act
    const entry = await send('/form', { method: 'POST', body: form });
    await vi.waitFor(() => expect(entry.request?.body).toBeDefined());

    // Assert
    const body = (await readBody(entry.request!.body!.id)).toString();
    expect(body).toContain('name="name"\r\n\r\nAda');
    expect(body).toContain('filename="ada.png"');
    const { headers } = ResponseBodyService.instance.getEntry(entry.request!.body!.id)!;
    expect(headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
  });

  it('should not throw an uncaught error if undici destroys the body of a failed request', async () => {
    // Arrange: like undici on a refused connection, destroy the body that is sent with the error
    const error = new Error('connect ECONNREFUSED');
    const source = Readable.from(['partial body']);
    const failingDispatch = vi.fn<Dispatcher.Dispatch>((options, handler) => {
      (options.body as Readable).destroy(error);
      handler.onResponseError?.({} as Dispatcher.DispatchController, error);
      return true;
    });
    const uncaught = vi.fn();
    process.on('uncaughtException', uncaught);

    // Act
    await history.record(createRequest(), async () => {
      httpInterceptor(failingDispatch)(
        { origin: ORIGIN, path: '/refused', method: 'POST', body: source },
        {}
      );
      return null;
    });
    await vi.waitFor(() => expect(source.destroyed).toBe(true));
    process.off('uncaughtException', uncaught);

    // Assert
    expect(uncaught).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(history.get(history.list()[0].id)?.request?.body).toBeDefined());
  });

  it('should not record anything outside of a history context', async () => {
    // Arrange
    mockReply('/untracked', 'GET');

    // Act
    const response = await undici.request(`${ORIGIN}/untracked`, { dispatcher });
    await response.body.text();

    // Assert
    expect(history.list()).toEqual([]);
  });
});
