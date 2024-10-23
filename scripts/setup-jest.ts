import streams from 'web-streams-polyfill';
import { TextDecoder, TextEncoder } from 'node:util';
import { homedir, tmpdir } from 'node:os';
import { fs, vol } from 'memfs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

Object.assign(global, streams);
Object.assign(global, {
  TextDecoder,
  TextEncoder,
  setImmediate: setTimeout,
  clearImmediate: clearTimeout,
});

jest.mock('electron', () => ({
  app: {
    whenReady: () => Promise.resolve(),
    getPath: () => tmpdir(),
    getName: () => 'DiagClient',
  },
  safeStorage: {
    encryptString: (plainText: string) => Buffer.from(plainText).toString('base64'),
    decryptString: (encrypted: Buffer) => Buffer.from(encrypted.toString(), 'base64').toString(),
  },
}));
jest.mock('node:fs', () => fs);
jest.mock('node:fs/promises', () => fs.promises);

jest.mock('tmp', () => ({
  fileSync: () => {
    const name = path.join(tmpdir(), randomUUID());
    const fd = vol.openSync(name, 'w+');
    const removeCallback = () => vol.unlinkSync(name);
    return { name, fd, removeCallback };
  },
}));

beforeEach(() => {
  vol.reset();
  vol.mkdirSync(tmpdir(), { recursive: true });
  vol.mkdirSync(homedir(), { recursive: true });
});
