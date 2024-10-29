import { EventEmitter } from '@/lib/event-emitter';

const { ipcRenderer } = window.electron;

const streams = new Map<number, IpcPushStream>();

export interface IpcPushStream {
  on(event: 'data', listener: (chunk: string) => void): this;

  on(event: 'end', listener: () => void): this;

  on(event: 'error', listener: (error: Error) => void): this;
}

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

  public static async open(filePath: string) {
    return new IpcPushStream(await window.electron.ipcRenderer.invoke('stream-open', filePath));
  }

  public close() {
    streams.delete(this.id);
    ipcRenderer.send('stream-close', this.id);
  }
}
