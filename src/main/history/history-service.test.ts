import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer, text } from 'node:stream/consumers';
import { BodyStore } from 'main/network/service/body-store';
import { copyRequestBody } from 'main/network/service/request-body-copy';
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
    body: { id, size: 2 },
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

const COLLECTION = '/collections/first';
const OTHER_COLLECTION = '/collections/second';

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
    await history.record(request, COLLECTION, async (recorder) => {
      recorder.scriptLog({ script: ScriptType.PRE_REQUEST, level: 'info', args: ['token'] });
      const [body, copy] = copyRequestBody(Readable.from(['{"name":', '"Ada"}']), {});
      recorder.sent({ ...SENT, headers: { authorization: 'Bearer secret' } }, copy);
      await text(body as Readable);
      return response;
    });

    // Assert
    const [summary] = history.list(COLLECTION);
    expect(summary).toEqual({
      id: expect.any(String),
      requestId: request.id,
      requestTitle: 'Get Users',
      timestamp: expect.any(Number),
      method: RequestMethod.GET,
      url: SENT.url,
      outcome: { type: 'response', status: 200, duration: 12 },
    });
    const entry = history.get(summary.id)!;
    expect(entry).toMatchObject({
      request: {
        headers: { authorization: 'Bearer secret' },
        body: { id: expect.any(String), size: 14 },
      },
      outcome: { type: 'response', response: { body: response.body } },
      scriptLogs: [{ script: ScriptType.PRE_REQUEST, level: 'info', args: ['token'] }],
    });
    expect((await readBody(entry.request!.body!.id)).toString()).toBe('{"name":"Ada"}');
    expect(changed).toHaveBeenCalledOnce();
  });

  it('should record the error and rethrow it if the request failed', async () => {
    // Act
    await expect(
      history.record(createRequest(), COLLECTION, () =>
        Promise.reject(new Error('connect ECONNREFUSED'))
      )
    ).rejects.toThrow('connect ECONNREFUSED');

    // Assert
    expect(history.list(COLLECTION)[0]).toMatchObject({
      url: 'https://example.com/users',
      outcome: { type: 'error', message: 'connect ECONNREFUSED' },
    });
    expect(history.get(history.list(COLLECTION)[0].id)?.outcome).toEqual({
      type: 'error',
      message: 'connect ECONNREFUSED',
    });
  });

  it('should record aborted requests', async () => {
    // Act
    await history.record(createRequest(), COLLECTION, async () => null);

    // Assert
    expect(history.list(COLLECTION)[0].outcome).toEqual({ type: 'aborted' });
    expect(history.get(history.list(COLLECTION)[0].id)?.outcome).toEqual({ type: 'aborted' });
  });

  it('should store the entry instead of waiting for a body that is never sent', async () => {
    // Act: e.g. undici rejected the request before sending its body
    await expect(
      history.record(createRequest(), COLLECTION, async (recorder) => {
        const [, copy] = copyRequestBody(Readable.from(['never sent']), {});
        recorder.sent(SENT, copy);
        throw new Error('invalid header');
      })
    ).rejects.toThrow('invalid header');

    // Assert
    expect(history.get(history.list(COLLECTION)[0].id)?.request?.body?.size).toBe(0);
  });

  it('should store script arguments that cannot be cloned as strings', async () => {
    // Act
    await history.record(createRequest(), COLLECTION, async (recorder) => {
      recorder.scriptLog({
        script: ScriptType.POST_RESPONSE,
        level: 'info',
        args: [() => 1, { a: 1 }],
      });
      return null;
    });

    // Assert
    expect(history.get(history.list(COLLECTION)[0].id)?.scriptLogs[0].args).toEqual([
      '[Function (anonymous)]',
      { a: 1 },
    ]);
  });

  it('should keep a history per collection', async () => {
    // Act
    await history.record({ ...createRequest(), title: 'first' }, COLLECTION, async () => null);
    await history.record(
      { ...createRequest(), title: 'second' },
      OTHER_COLLECTION,
      async () => null
    );

    // Assert
    expect(history.list(COLLECTION).map((entry) => entry.requestTitle)).toEqual(['first']);
    expect(history.list(OTHER_COLLECTION).map((entry) => entry.requestTitle)).toEqual(['second']);
  });

  it('should only clear the history of the given collection', async () => {
    // Arrange
    await history.record(createRequest(), COLLECTION, async () => null);
    await history.record(createRequest(), OTHER_COLLECTION, async () => null);
    const changed = vi.fn();
    history.on('changed', changed);

    // Act
    history.clear(COLLECTION);

    // Assert
    expect(history.list(COLLECTION)).toEqual([]);
    expect(history.list(OTHER_COLLECTION)).toHaveLength(1);
    expect(changed).toHaveBeenCalledOnce();
  });

  it('should list the newest entry first', async () => {
    // Act
    for (const title of ['first', 'second']) {
      await history.record({ ...createRequest(), title }, COLLECTION, async () => null);
    }

    // Assert
    expect(history.list(COLLECTION).map((entry) => entry.requestTitle)).toEqual([
      'second',
      'first',
    ]);
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
      await history.record(createRequest(), COLLECTION, async (recorder) => {
        const [body, copy] = copyRequestBody(Readable.from(['body']), {});
        recorder.sent(SENT, copy);
        await text(body as Readable);
        return response;
      });
      const entry = history.get(history.list(COLLECTION)[0].id)!;
      return { requestBody: entry.request!.body!.id, responseBody: response.body!.id };
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
        await history.record(createRequest(), COLLECTION, async () => null);
      }

      expect(history.list(COLLECTION)).toHaveLength(MAX_HISTORY_ENTRIES);
      expect(release).toHaveBeenCalledWith(requestBody);
      expect(release).toHaveBeenCalledWith(responseBody);
    });

    it('should evict the oldest entries of all collections together', async () => {
      const { requestBody } = await recordWithBodies();

      for (let i = 0; i < MAX_HISTORY_ENTRIES; i++) {
        await history.record(createRequest(), OTHER_COLLECTION, async () => null);
      }

      expect(history.list(COLLECTION)).toEqual([]);
      expect(history.list(OTHER_COLLECTION)).toHaveLength(MAX_HISTORY_ENTRIES);
      expect(release).toHaveBeenCalledWith(requestBody);
    });

    it('should release the bodies of all entries when cleared', async () => {
      const { requestBody, responseBody } = await recordWithBodies();

      history.clear(COLLECTION);

      expect(history.list(COLLECTION)).toEqual([]);
      expect(release).toHaveBeenCalledWith(requestBody);
      expect(release).toHaveBeenCalledWith(responseBody);
    });
  });
});
