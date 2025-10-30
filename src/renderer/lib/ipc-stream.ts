import { EventEmitter } from '@/lib/event-emitter';
import { StreamInput, StringBufferEncoding } from 'shim/ipc-stream';

const { ipcRenderer } = window.electron;

const streams = new Map<number, IpcPushStream>();

export interface IpcPushStream {
  on(event: 'data', listener: (chunk: string) => void): this;

  on(event: 'end', listener: () => void): this;

  on(event: 'error', listener: (error: Error) => void): this;
}

/**
 * A stream that can be used to push data from the main process to the renderer process.
 */
export class IpcPushStream extends EventEmitter {
  static {
    ipcRenderer.on('stream-data', (event, id: number, chunk: string) => {
      streams.get(id)?.emit('data', chunk);
    });

    ipcRenderer.on('stream-end', (event, id: number) => {
      streams.get(id)?.emit('end');
      streams.delete(id);
    });

    ipcRenderer.on('stream-error', (event, id: number, error: Error) => {
      streams.get(id)?.emit('error', error);
      streams.delete(id);
    });
  }

  private constructor(private readonly id: number) {
    super();
    streams.set(id, this);
  }

  public static async open(input: StreamInput, encoding: StringBufferEncoding) {
    return new IpcPushStream(
      await window.electron.ipcRenderer.invoke('stream-open', input, encoding)
    );
  }

  public close() {
    streams.delete(this.id);
    ipcRenderer.send('stream-close', this.id);
  }

  /**
   * Collect all data from the stream and return it as a single string.
   * @returns The string in the configured encoding.
   */
  public readAll() {
    const chunks = [] as string[];
    this.on('data', (chunk) => chunks.push(chunk));
    return new Promise<string>((resolve, reject) => {
      this.on('end', () => resolve(chunks.join('')));
      this.on('error', (error) => reject(error));
    });
  }
}
