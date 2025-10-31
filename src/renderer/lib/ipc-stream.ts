import { EventEmitter } from '@/lib/event-emitter';
import { StreamInput, StringBufferEncoding } from 'shim/ipc-stream';

const { ipcRenderer } = window.electron;

/**
 * A stream that can be used to push data from the main process to the renderer process.
 */
export class IpcPushStream extends EventEmitter<{
  data: (chunk: string) => void;
  end: (canceled: boolean) => void;
  error: (error: Error) => void;
}> {
  private static streams = new Map<number, IpcPushStream>();

  static {
    ipcRenderer.on('stream-data', (event, id: number, chunk: string) => {
      IpcPushStream.streams.get(id)?.emit('data', chunk);
    });

    ipcRenderer.on('stream-end', (event, id: number) => {
      IpcPushStream.streams.get(id)?.emit('end', false);
      IpcPushStream.streams.delete(id);
    });

    ipcRenderer.on('stream-error', (event, id: number, error: Error) => {
      IpcPushStream.streams.get(id)?.emit('error', error);
      IpcPushStream.streams.delete(id);
    });
  }

  private constructor(private readonly id: number) {
    super();
    IpcPushStream.streams.set(id, this);
  }

  public static async open(input: StreamInput, encoding: StringBufferEncoding) {
    return new IpcPushStream(
      await window.electron.ipcRenderer.invoke('stream-open', input, encoding)
    );
  }

  public close() {
    IpcPushStream.streams.delete(this.id);
    ipcRenderer.send('stream-close', this.id);
    this.emit('end', true);
  }

  /**
   * Collect all data from the stream and return it as a single string.
   * @returns The string in the configured encoding or undefined if the stream was closed prematurely.
   */
  public readAll() {
    const chunks: string[] = [];
    this.on('data', (chunk) => chunks.push(chunk));
    return new Promise<string>((resolve, reject) => {
      this.on('end', (canceled) => (canceled ? undefined : resolve(chunks.join(''))));
      this.on('error', reject);
    });
  }
}
