import tmp from 'tmp';
import fs from 'fs/promises';
import { MainEventService } from './main-event-service';

jest.mock(
  'electron',
  () => ({
    ipcMain: {
      handle: jest.fn()
    },
    app: {
      getPath: jest.fn().mockReturnValue('')
    }
  })
);

const eventService = MainEventService.instance;

const TEST_STRING = 'Hello, World!';
const TEST_FILE_PATH = tmp.fileSync().name;

describe('MainEventService', () => {
  beforeAll(async () => {
    await fs.writeFile(TEST_FILE_PATH, TEST_STRING);
  });

  it('should register event functions on the backend', () => {
    expect(require('electron').ipcMain.handle).toHaveBeenCalled();
  });

  it('should get the file info correctly', async () => {

    // Act
    const fileInfo = await eventService.getFileInfo(TEST_FILE_PATH);

    // Assert
    expect(fileInfo.isFile).toBe(true);
    expect(fileInfo.isDirectory).toBe(false);
    expect(fileInfo.size).toBe(13);
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
