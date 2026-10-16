import { ipcMain } from 'electron';
import { z } from 'zod';
import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { BodyStore } from 'main/network/service/body-store';
import { StreamInput, StringBufferEncoding } from 'shim/ipc-stream';

let nextId = 0;

const streams = new Map<number, Readable>();

const persistenceService = PersistenceService.instance;
const bodyStore = BodyStore.instance;
const collectionState = CollectionStateService.instance;

ipcMain.handle(
  'stream-open',
  async (event, rawInput: unknown, rawEncoding?: unknown, rawMaxBytes?: unknown) => {
    const input = StreamInput.parse(rawInput);
    const encoding = StringBufferEncoding.optional().parse(rawEncoding);
    const maxBytes = z.number().int().positive().optional().parse(rawMaxBytes);
    const { sender } = event;
    const id = nextId++;

    let stream: Readable | undefined;
    const end = maxBytes != null ? maxBytes - 1 : undefined;

    if (typeof input === 'string') {
      stream = createReadStream(input, { encoding, end });
    } else if (input.type === 'body') {
      stream = bodyStore.openBody(input.id, { encoding, end });
      if (stream == null) logger.warn(`Body not found for ID: ${input.id}`);
    } else if (input.type === 'script') {
      stream = await collectionState.readRequest(input.requestId, (request) =>
        persistenceService.loadScript(request, input.source)
      );
    } else {
      stream = await collectionState.readRequest(input.requestId, (request) =>
        persistenceService.loadTextBodyOfRequest(request, encoding)
      );
    }

    if (stream == null) {
      setImmediate(() => sender.send('stream-end', id));
      return id;
    }

    // the renderer can't close the stream anymore once it's gone
    const destroyStream = () => stream.destroy();
    streams.set(id, stream);
    sender.once('destroyed', destroyStream);
    stream.on('data', (chunk) => sender.send('stream-data', id, chunk));
    stream.on('end', () => sender.send('stream-end', id, false));
    stream.on('error', (error) => sender.send('stream-error', id, error));
    stream.on('close', () => {
      streams.delete(id);
      sender.off('destroyed', destroyStream);
    });
    return id;
  }
);

ipcMain.on('stream-close', (event, id: number) => {
  streams.get(id)?.destroy();
  streams.delete(id);
  event.sender.send('stream-end', id, true);
});
