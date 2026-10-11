import { ipcMain } from 'electron';
import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { BodyStore } from 'main/network/service/body-store';
import { StreamInput, StringBufferEncoding } from 'shim/ipc-stream';

let nextId = 0;

const streams = new Map<number, Readable>();

const persistenceService = PersistenceService.instance;
const bodyStore = BodyStore.instance;

ipcMain.handle(
  'stream-open',
  async (event, input: StreamInput, encoding?: StringBufferEncoding, maxBytes?: number) => {
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
      stream = await persistenceService.loadScript(input.request, input.source);
    } else if (input.type === 'request') {
      stream = await persistenceService.loadTextBodyOfRequest(input, encoding);
    } else {
      logger.error('Invalid stream input of type', typeof input);
    }

    if (stream == null) {
      setImmediate(() => sender.send('stream-end', id));
      return id;
    }

    streams.set(id, stream);
    stream.on('data', (chunk) => sender.send('stream-data', id, chunk));
    stream.on('end', () => sender.send('stream-end', id, false));
    stream.on('error', (error) => sender.send('stream-error', id, error));
    return id;
  }
);

ipcMain.on('stream-close', (event, id: number) => {
  streams.get(id)?.destroy();
  streams.delete(id);
  event.sender.send('stream-end', id, true);
});
