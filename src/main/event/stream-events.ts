import { ipcMain } from 'electron';
import { createReadStream, ReadStream } from 'node:fs';

let nextId = 0;

const streams = new Map<number, ReadStream>();

ipcMain.handle('stream-open', (event, filePath: string) => {
  const { sender } = event;
  const stream = createReadStream(filePath, 'utf8');
  const id = nextId++;
  streams.set(id, stream);

  stream.on('data', (chunk: string) => {
    sender.send('stream-data', id, chunk);
  });

  stream.on('end', () => {
    sender.send('stream-end', id);
  });

  stream.on('error', (error) => {
    sender.send('stream-error', id, error);
  });

  return id;
});

ipcMain.on('stream-close', (event, id: number) => {
  streams.get(id)?.close();
  streams.delete(id);
});
