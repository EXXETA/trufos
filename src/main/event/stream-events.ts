import { ipcMain } from 'electron';
import { createReadStream, ReadStream } from 'node:fs';
import { TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { ResponseBodyService } from 'main/network/service/response-body-service';

let nextId = 0;

const streams = new Map<number, ReadStream>();

const persistenceService = PersistenceService.instance;
const responseBodyService = ResponseBodyService.instance;

type StreamInput = string | TrufosRequest | TrufosResponse;

ipcMain.handle('stream-open', async (event, input: StreamInput) => {
  const { sender } = event;
  const id = nextId++;

  let stream: ReadStream;

  if (typeof input === 'string') {
    stream = createReadStream(input, 'utf8');
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
    stream = createReadStream(filePath, 'utf8');
  } else if ((stream = await persistenceService.loadTextBodyOfRequest(input, 'utf8')) == null) {
    setImmediate(() => sender.send('stream-end', id));
    return id;
  }

  streams.set(id, stream);
  stream.on('data', (chunk: string) => sender.send('stream-data', id, chunk));
  stream.on('end', () => sender.send('stream-end', id));
  stream.on('error', (error) => sender.send('stream-error', id, error));
  return id;
});

ipcMain.on('stream-close', (event, id: number) => {
  streams.get(id)?.close();
  streams.delete(id);
});
