import path from 'node:path';
import { tmpdir } from 'node:os';
import { fs } from 'memfs';
import { vi, describe, it, beforeEach, expect } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn().mockReturnValue(''),
  },
}));

vi.mock('./stream-events', () => ({}));

const TEST_STRING = 'Hello, World!';
const TEST_FILE_PATH = path.join(tmpdir(), 'test.txt');

describe('MainEventService', () => {
  beforeEach(() => {
    fs.writeFileSync(TEST_FILE_PATH, TEST_STRING);
  });

  it('should register event functions on the backend', async () => {
    await import('./main-event-service');
    expect((await import('electron')).ipcMain.handle).toHaveBeenCalled();
  });
});
