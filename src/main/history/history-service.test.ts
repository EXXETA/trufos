import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ResponseBodyService } from 'main/network/service/response-body-service';
import { MAX_HISTORY_ENTRIES } from 'shim/history';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosResponse } from 'shim/objects/response';
import { parseUrl } from 'shim/objects/url';
import { ScriptType } from 'shim/scripting';
import { HistoryService } from './history-service';

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

function createResponse(bodyId?: string): TrufosResponse {
  return {
    type: 'response',
    id: bodyId as string,
    headers: { 'content-type': 'application/json' },
    metaInfo: {
      status: 200,
      duration: 12,
      size: { totalSizeInBytes: 10, headersSizeInBytes: 5, bodySizeInBytes: 5 },
    },
  };
}

describe('HistoryService', () => {
  let history: HistoryService;
  let remove: MockInstance<ResponseBodyService['remove']>;

  beforeEach(() => {
    history = new HistoryService();
    remove = vi.spyOn(ResponseBodyService.instance, 'remove').mockImplementation(() => {});
  });

  it('should record a request with its sent request, response and script output', async () => {
    // Arrange
    const request = createRequest();
    const changed = vi.fn();
    history.on('changed', changed);

    // Act
    await history.record(request, async () => {
      history.recordScriptLog({ script: ScriptType.PRE_REQUEST, level: 'info', args: ['token'] });
      history.recordSentRequest({
        method: 'GET',
        url: 'https://example.com/users?page=1',
        headers: { authorization: 'Bearer secret' },
      });
      return createResponse('body-1');
    });

    // Assert
    const [summary] = history.list();
    expect(summary).toEqual({
      id: expect.any(String),
      requestId: request.id,
      requestTitle: 'Get Users',
      timestamp: expect.any(Number),
      method: RequestMethod.GET,
      url: 'https://example.com/users?page=1',
      status: 200,
      duration: 12,
      error: undefined,
    });
    expect(history.get(summary.id)).toMatchObject({
      request: { headers: { authorization: 'Bearer secret' } },
      response: { body: { id: 'body-1', size: 5 } },
      scriptLogs: [{ script: ScriptType.PRE_REQUEST, level: 'info', args: ['token'] }],
    });
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
  });

  it('should record aborted requests', async () => {
    // Act
    await history.record(createRequest(), async () => null);

    // Assert
    expect(history.list()[0].error).toBe('The request was aborted.');
  });

  it('should ignore output outside of a recorded request', () => {
    // Act
    history.recordScriptLog({ level: 'info', args: ['lost'] });

    // Assert
    expect(history.recordSentRequest({ method: 'GET', url: 'x', headers: {} })).toBeUndefined();
    expect(history.list()).toEqual([]);
  });

  it('should store script arguments that cannot be cloned as strings', async () => {
    // Act
    await history.record(createRequest(), async () => {
      history.recordScriptLog({ level: 'info', args: [() => 1, { a: 1 }] });
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

  it('should evict the oldest entries and delete their bodies', async () => {
    // Arrange
    await history.record(createRequest(), async () => {
      history.recordSentRequest({ method: 'POST', url: 'x', headers: {} })!.request!.body = {
        id: 'request-body',
        size: 1,
      };
      return createResponse('old-response');
    });

    // Act
    for (let i = 0; i < MAX_HISTORY_ENTRIES; i++) {
      await history.record(createRequest(), async () => null);
    }

    // Assert
    expect(history.list()).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(remove).toHaveBeenCalledWith('request-body');
    // still the latest response of its request, so it is still shown in the response panel
    expect(remove).not.toHaveBeenCalledWith('old-response');
  });

  it('should delete an evicted response body once a newer response replaced it', async () => {
    // Arrange
    const request = createRequest();
    await history.record(request, async () => createResponse('old-response'));
    for (let i = 0; i < MAX_HISTORY_ENTRIES; i++) {
      await history.record(createRequest(), async () => null);
    }

    // Act
    await history.record(request, async () => createResponse('new-response'));

    // Assert
    expect(remove).toHaveBeenCalledWith('old-response');
    expect(remove).not.toHaveBeenCalledWith('new-response');
  });

  it('should keep a replaced response body while its entry is in the history', async () => {
    // Arrange
    const request = createRequest();
    await history.record(request, async () => createResponse('old-response'));

    // Act
    await history.record(request, async () => createResponse('new-response'));

    // Assert
    expect(remove).not.toHaveBeenCalled();
  });

  it('should clear all entries and keep only the latest responses', async () => {
    // Arrange
    const request = createRequest();
    await history.record(request, async () => createResponse('old-response'));
    await history.record(request, async () => createResponse('new-response'));

    // Act
    history.clear();

    // Assert
    expect(history.list()).toEqual([]);
    expect(remove).toHaveBeenCalledWith('old-response');
    expect(remove).not.toHaveBeenCalledWith('new-response');
  });
});
