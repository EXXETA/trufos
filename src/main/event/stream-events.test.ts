import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { ipcMain } from 'electron';
import { BodyStore } from 'main/network/service/body-store';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));

vi.mock('main/persistence/service/persistence-service', () => ({
  PersistenceService: { instance: {} },
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
});
