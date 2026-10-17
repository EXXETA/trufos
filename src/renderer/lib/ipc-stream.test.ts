import { describe, expect, it, vi } from 'vitest';

type IpcListener = (event: unknown, ...args: unknown[]) => void;

const { listeners, invoke } = vi.hoisted(() => {
  const listeners = new Map<string, IpcListener>();
  const invoke = vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        on: (channel: string, listener: IpcListener) => listeners.set(channel, listener),
        send: vi.fn(),
        invoke,
      },
    },
  });
  return { listeners, invoke };
});

import { IpcPushStream } from './ipc-stream';

/** Simulates a message from the main process. */
function receive(channel: string, ...args: unknown[]) {
  listeners.get(channel)?.(undefined, ...args);
}

async function openStream(id: number) {
  invoke.mockResolvedValueOnce(id);
  return await IpcPushStream.open('/some/file', 'utf-8');
}

describe('IpcPushStream.readAll()', () => {
  it('resolves with all chunks once the stream ended', async () => {
    const stream = await openStream(1);
    const result = stream.readAll();

    receive('stream-data', 1, 'Hello, ');
    receive('stream-data', 1, 'world!');
    receive('stream-end', 1, false);

    await expect(result).resolves.toBe('Hello, world!');
  });

  it('resolves with undefined when the stream was canceled', async () => {
    const stream = await openStream(2);
    const result = stream.readAll();

    receive('stream-data', 2, 'partial');
    receive('stream-end', 2, true);

    await expect(result).resolves.toBeUndefined();
  });

  it('rejects when the stream failed', async () => {
    const stream = await openStream(3);
    const result = stream.readAll();
    const error = new Error('broken');

    receive('stream-error', 3, error);

    await expect(result).rejects.toBe(error);
  });
});
