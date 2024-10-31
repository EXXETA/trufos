import path from 'node:path';
import { tmpdir } from 'node:os';
import { fs } from 'memfs';

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  app: {
    getPath: jest.fn().mockReturnValue(''),
  },
}));

jest.mock('./stream-events', () => ({}));

const TEST_STRING = 'Hello, World!';
const TEST_FILE_PATH = path.join(tmpdir(), 'test.txt');

describe('MainEventService', () => {
  beforeEach(() => {
    fs.writeFileSync(TEST_FILE_PATH, TEST_STRING);
  });

  it('should register event functions on the backend', async () => {
    expect((await import('electron')).ipcMain.handle).toHaveBeenCalled();
  });
});
