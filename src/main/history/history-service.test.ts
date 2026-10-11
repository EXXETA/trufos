import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer, text } from 'node:stream/consumers';
import { FormData } from 'undici';
import { BodyStore } from 'main/network/service/body-store';
import { MAX_HISTORY_ENTRIES } from 'shim/history';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosResponse } from 'shim/objects/response';
import { parseUrl } from 'shim/objects/url';
import { ScriptType } from 'shim/scripting';
import { HistoryService } from './history-service';

const bodyStore = BodyStore.instance;
const SENT = { method: 'POST', url: 'https://example.com/users?page=1', headers: {} };

function createRequest(id = randomUUID()): TrufosRequest {
  return {
    id,
    parentId: randomUUID(),
    type: 'request',
    lastModified: 0,
    title: 'Get Users',
    url: parseUrl('https://example.com/users'),
    method: RequestMethod.GET,
    headers: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
  };
}

function createResponse(): TrufosResponse {
  const { id, stream } = bodyStore.create();
  stream.end('{}');
  return {
    type: 'response',
    id,
    headers: { 'content-type': 'application/json' },
    metaInfo: {
      status: 200,
      duration: 12,
      size: { totalSizeInBytes: 7, headersSizeInBytes: 5, bodySizeInBytes: 2 },
    },
  };
}

function readBody(id: string) {
  return buffer(bodyStore.openBody(id)!);
}

describe('HistoryService', () => {
  let history: HistoryService;

  beforeEach(() => {
    history = new HistoryService();
  });

  it('should record a request with its sent request, response and script output', async () => {
    // Arrange
    const request = createRequest();
    const response = createResponse();
    const changed = vi.fn();
    history.on('changed', changed);

    // Act
    await history.record(request, async () => {
      history.recordScriptLog({ script: ScriptType.PRE_REQUEST, level: 'info', args: ['token'] });
      const body = history.recordSentRequest(
        { ...SENT, headers: { authorization: 'Bearer secret', 'content-length': undefined } },
        Readable.from(['{"name":', '"Ada"}'])
      );
      await text(body as Readable);
      return response;
    });

    // Assert
    const [summary] = history.list();
    expect(summary).toEqual({
      id: expect.any(String),
      requestId: request.id,
      requestTitle: 'Get Users',
      timestamp: expect.any(Number),
      method: RequestMethod.GET,
      url: SENT.url,
      status: 200,
      duration: 12,
    });
    const entry = history.get(summary.id)!;
    expect(entry).toMatchObject({
      request: {
        headers: { authorization: 'Bearer secret' },
        body: { id: expect.any(String), size: 14 },
      },
      outcome: { type: 'response', response: { body: { id: response.id, size: 2 } } },
      scriptLogs: [{ script: ScriptType.PRE_REQUEST, level: 'info', args: ['token'] }],
    });
    expect(entry.request?.headers).not.toHaveProperty('content-length');
    expect((await readBody(entry.request!.body!.id)).toString()).toBe('{"name":"Ada"}');
    expect(changed).toHaveBeenCalledOnce();
  });

  it('should record the error and rethrow it if the request failed', async () => {
    // Act
    await expect(
      history.record(createRequest(), () => Promise.reject(new Error('connect ECONNREFUSED')))
    ).rejects.toThrow('connect ECONNREFUSED');

    // Assert
    expect(history.list()[0]).toMatchObject({
      url: 'https://example.com/users',
      error: 'connect ECONNREFUSED',
    });
    expect(history.get(history.list()[0].id)?.outcome).toEqual({
      type: 'error',
      message: 'connect ECONNREFUSED',
    });
  });

  it('should record aborted requests', async () => {
    // Act
    await history.record(createRequest(), async () => null);

    // Assert
    expect(history.list()[0].aborted).toBe(true);
    expect(history.get(history.list()[0].id)?.outcome).toEqual({ type: 'aborted' });
  });

  it('should pass bodies through untouched outside of a recorded request', () => {
    // Arrange
    const body = Readable.from(['body']);

    // Act
    history.recordScriptLog({ script: ScriptType.PRE_REQUEST, level: 'info', args: ['lost'] });
    const sent = history.recordSentRequest(SENT, body);

    // Assert
    expect(sent).toBe(body);
    expect(history.list()).toEqual([]);
  });

  it('should store script arguments that cannot be cloned as strings', async () => {
    // Act
    await history.record(createRequest(), async () => {
      history.recordScriptLog({
        script: ScriptType.POST_RESPONSE,
        level: 'info',
        args: [() => 1, { a: 1 }],
      });
      return null;
    });

    // Assert
    expect(history.get(history.list()[0].id)?.scriptLogs[0].args).toEqual([
      '[Function (anonymous)]',
      { a: 1 },
    ]);
  });

  it('should list the newest entry first', async () => {
    // Act
    for (const title of ['first', 'second']) {
      await history.record({ ...createRequest(), title }, async () => null);
    }

    // Assert
    expect(history.list().map((entry) => entry.requestTitle)).toEqual(['second', 'first']);
  });

  describe('request bodies', () => {
    it('should copy binary bodies byte by byte', async () => {
      // Arrange
      const bytes = Buffer.from([0, 255, 1, 254]);

      // Act
      await history.record(createRequest(), async () => {
        await buffer(history.recordSentRequest(SENT, Readable.from([bytes])) as Readable);
        return null;
      });

      // Assert
      const entry = history.get(history.list()[0].id)!;
      expect(await readBody(entry.request!.body!.id)).toEqual(bytes);
    });

    it('should store form data as multipart body', async () => {
      // Arrange
      const form = new FormData();
      form.append('name', 'Ada');
      form.append('avatar', new File(['abc'], 'ada.png'));

      // Act
      await history.record(createRequest(), async () => {
        expect(history.recordSentRequest(SENT, form)).toBe(form);
        return null;
      });

      // Assert
      const id = history.get(history.list()[0].id)!.request!.body!.id;
      const body = (await readBody(id)).toString();
      expect(body).toContain('name="name"\r\n\r\nAda');
      expect(body).toContain('filename="ada.png"');
      expect(bodyStore.getHeaders(id)?.['content-type']).toMatch(
        /^multipart\/form-data; boundary=/
      );
    });

    it('should store the sent part of a body that undici never read completely', async () => {
      // Act: e.g. undici rejected the request before sending its body
      await expect(
        history.record(createRequest(), async () => {
          history.recordSentRequest(SENT, Readable.from(['never sent']));
          throw new Error('invalid header');
        })
      ).rejects.toThrow('invalid header');

      // Assert: the entry is stored instead of waiting for the body forever
      expect(history.get(history.list()[0].id)?.request?.body?.size).toBe(0);
    });

    it('should not throw an uncaught error if undici destroys the body of a failed request', async () => {
      // Arrange
      const uncaught = vi.fn();
      process.on('uncaughtException', uncaught);
      const source = Readable.from(['partial body']);

      // Act: like undici on a refused connection, destroy the sent body with the error
      await expect(
        history.record(createRequest(), async () => {
          const body = history.recordSentRequest(SENT, source) as Readable;
          const error = new Error('connect ECONNREFUSED');
          body.destroy(error);
          throw error;
        })
      ).rejects.toThrow('connect ECONNREFUSED');
      await vi.waitFor(() => expect(source.destroyed).toBe(true));
      process.off('uncaughtException', uncaught);

      // Assert
      expect(uncaught).not.toHaveBeenCalled();
      expect(history.get(history.list()[0].id)?.request?.body).toBeDefined();
    });
  });

  describe('body references', () => {
    let retain: MockInstance<BodyStore['retain']>;
    let release: MockInstance<BodyStore['release']>;

    beforeEach(() => {
      retain = vi.spyOn(bodyStore, 'retain');
      release = vi.spyOn(bodyStore, 'release');
    });

    async function recordWithBodies() {
      const response = createResponse();
      await history.record(createRequest(), async () => {
        await text(history.recordSentRequest(SENT, Readable.from(['body'])) as Readable);
        return response;
      });
      const entry = history.get(history.list()[0].id)!;
      return { requestBody: entry.request!.body!.id, responseBody: response.id };
    }

    it('should retain the bodies of an entry while it is in the history', async () => {
      const { requestBody, responseBody } = await recordWithBodies();

      expect(retain).toHaveBeenCalledWith(requestBody);
      expect(retain).toHaveBeenCalledWith(responseBody);
      expect(release).not.toHaveBeenCalled();
    });

    it('should release the bodies of evicted entries', async () => {
      const { requestBody, responseBody } = await recordWithBodies();

      for (let i = 0; i < MAX_HISTORY_ENTRIES; i++) {
        await history.record(createRequest(), async () => null);
      }

      expect(history.list()).toHaveLength(MAX_HISTORY_ENTRIES);
      expect(release).toHaveBeenCalledWith(requestBody);
      expect(release).toHaveBeenCalledWith(responseBody);
    });

    it('should release the bodies of all entries when cleared', async () => {
      const { requestBody, responseBody } = await recordWithBodies();

      history.clear();

      expect(history.list()).toEqual([]);
      expect(release).toHaveBeenCalledWith(requestBody);
      expect(release).toHaveBeenCalledWith(responseBody);
    });
  });
});
