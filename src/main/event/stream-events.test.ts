import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { ipcMain } from 'electron';
import { BodyStore } from 'main/network/service/body-store';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { ScriptType } from 'shim/scripting';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/user-data' },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));

vi.mock('main/persistence/service/persistence-service', () => ({
  PersistenceService: { instance: { loadTextBodyOfRequest: vi.fn(), loadScript: vi.fn() } },
}));

const mockState = vi.hoisted(() => ({
  requests: new Map<string, { id: string }>(),
  read: vi.fn(async <T>(reader: (model: { requests: Map<string, { id: string }> }) => Promise<T>) =>
    reader({ requests: mockState.requests })
  ),
}));

vi.mock('main/collection-state/collection-state-service', () => ({
  CollectionStateService: {
    instance: {
      read: mockState.read,
    },
  },
}));

vi.mock('main/network/service/body-store', () => ({
  BodyStore: { instance: { openBody: vi.fn() } },
}));

class Sender extends EventEmitter {
  send = vi.fn();
}

describe('stream-open', () => {
  let open: Parameters<typeof ipcMain.handle>[1];
  let body: PassThrough;
  let sender: Sender;

  beforeAll(async () => {
    await import('./stream-events.js');
    open = vi.mocked(ipcMain.handle).mock.calls.find(([channel]) => channel === 'stream-open')![1];
  });

  beforeEach(() => {
    body = new PassThrough();
    sender = new Sender();
    vi.mocked(BodyStore.instance.openBody).mockReturnValue(body);
  });

  it('destroys the stream when the renderer that opened it is destroyed', async () => {
    // @ts-expect-error minimal event with only the sender the handler uses
    await open({ sender }, { type: 'body', id: 'body-id' });

    sender.emit('destroyed');

    expect(body.destroyed).toBe(true);
  });

  it('stops watching the renderer once the stream is closed', async () => {
    // @ts-expect-error minimal event with only the sender the handler uses
    const id = await open({ sender }, { type: 'body', id: 'body-id' });
    expect(sender.listenerCount('destroyed')).toBe(1);

    body.end('content');
    body.resume();
    await new Promise((resolve) => body.once('close', resolve));

    expect(sender.send).toHaveBeenCalledWith('stream-end', id, false);
    expect(sender.listenerCount('destroyed')).toBe(0);
  });

  it('streams the text body of a request of the open collection by its ID', async () => {
    // Arrange
    const request = { id: 'request-id' };
    mockState.requests.set(request.id, request);
    // @ts-expect-error the stream is a PassThrough instead of a ReadStream
    vi.mocked(PersistenceService.instance.loadTextBodyOfRequest).mockResolvedValue(body);

    // Act
    // @ts-expect-error minimal event with only the sender the handler uses
    await open({ sender }, { type: 'request-body', requestId: request.id }, 'utf8');

    // Assert
    expect(mockState.read).toHaveBeenCalled();
    expect(PersistenceService.instance.loadTextBodyOfRequest).toHaveBeenCalledWith(request, 'utf8');
  });

  it('streams a script of a request of the open collection by its ID', async () => {
    // Arrange
    const request = { id: 'request-id' };
    mockState.requests.set(request.id, request);
    // @ts-expect-error the stream is a PassThrough instead of a ReadStream
    vi.mocked(PersistenceService.instance.loadScript).mockResolvedValue(body);

    // Act
    const input = { type: 'script', source: ScriptType.PRE_REQUEST, requestId: request.id };
    // @ts-expect-error minimal event with only the sender the handler uses
    await open({ sender }, input);

    // Assert
    expect(PersistenceService.instance.loadScript).toHaveBeenCalledWith(
      request,
      ScriptType.PRE_REQUEST
    );
  });

  it('ends the stream right away if the request does not exist', async () => {
    // Act
    // @ts-expect-error minimal event with only the sender the handler uses
    const id = await open({ sender }, { type: 'request-body', requestId: 'missing' });
    await new Promise((resolve) => setImmediate(resolve));

    // Assert
    expect(PersistenceService.instance.loadTextBodyOfRequest).not.toHaveBeenCalled();
    expect(sender.send).toHaveBeenCalledWith('stream-end', id);
  });
});
