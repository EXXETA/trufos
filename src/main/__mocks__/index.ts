import { homedir, tmpdir } from 'node:os';
import { vol } from 'memfs';
import { vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: () => tmpdir(),
    getName: () => 'Trufos',
  },
}));
vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('tmp');

beforeEach(() => {
  vol.reset();
  vol.mkdirSync(tmpdir(), { recursive: true });
  vol.mkdirSync(homedir(), { recursive: true });
});
