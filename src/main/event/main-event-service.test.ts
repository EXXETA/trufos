import { MainEventService } from './main-event-service';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fs } from 'memfs';

jest.mock(
  'electron',
  () => ({
    ipcMain: {
      handle: jest.fn(),
    },
    app: {
      getPath: jest.fn().mockReturnValue(''),
    },
  }),
);

const eventService = MainEventService.instance;

const TEST_STRING = 'Hello, World!';
const TEST_FILE_PATH = path.join(tmpdir(), 'test.txt');

describe('MainEventService', () => {
  beforeAll(() => {
    fs.writeFileSync(TEST_FILE_PATH, TEST_STRING);
  });

  it('should register event functions on the backend', async () => {
    expect((await import('electron')).ipcMain.handle).toHaveBeenCalled();
  });

  it('should read the file correctly providing no parameters', async () => {

    // Act
    const buffer = await eventService.readFile(TEST_FILE_PATH);

    // Assert
    expect(Buffer.from(buffer).toString()).toBe(TEST_STRING);
  });

  it('should read the file correctly with offset', async () => {

    // Act
    const buffer = await eventService.readFile(TEST_FILE_PATH, 1);

    // Assert
    expect(Buffer.from(buffer).toString()).toBe(TEST_STRING.substring(1));
  });

  it('should read the file correctly with offset and length', async () => {

    // Act
    const buffer = await eventService.readFile(TEST_FILE_PATH, 1, 2);

    // Assert
    expect(Buffer.from(buffer).toString()).toBe(TEST_STRING.substring(1, 3));
  });

});
