import { ipcMain } from 'electron';
import { createReadStream, ReadStream } from 'node:fs';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { ResponseBodyService } from 'main/network/service/response-body-service';
import { StreamInput, StringBufferEncoding } from 'shim/ipc-stream';

let nextId = 0;

const streams = new Map<number, ReadStream>();

const persistenceService = PersistenceService.instance;
const responseBodyService = ResponseBodyService.instance;

ipcMain.handle(
  'stream-open',
  async (event, input: StreamInput, encoding?: StringBufferEncoding) => {
    const { sender } = event;
    const id = nextId++;

    let stream: ReadStream;

    if (typeof input === 'string') {
      stream = createReadStream(input, encoding);
    } else if (input.type === 'response') {
      if (input.id == null) {
        logger.debug('Response has no body, sending empty stream');
        setImmediate(() => sender.send('stream-end', id));
        return id;
      }
      const filePath = responseBodyService.getFilePath(input.id);
      if (filePath == null) {
        logger.error(`Response body file path not found for ID: ${input.id}`);
        setImmediate(() => sender.send('stream-end', id));
        return id;
      }
      stream = createReadStream(filePath, encoding);
    } else if ((stream = await persistenceService.loadTextBodyOfRequest(input, encoding)) == null) {
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
  streams.get(id)?.close();
  streams.delete(id);
  event.sender.send('stream-end', id, true);
});
