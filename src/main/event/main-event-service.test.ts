import path from 'node:path';
import { tmpdir } from 'node:os';
import { fs } from 'memfs';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Collection } from 'shim/objects/collection';
import { TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { RequestBodyType } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';

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

  describe('reorderItem', () => {
    it('should delegate to persistence service reorderItem', async () => {
      // Arrange
      const { MainEventService } = await import('./main-event-service');
      const { PersistenceService } = await import('../persistence/service/persistence-service');

      const collection: Collection = {
        id: randomUUID(),
        type: 'collection',
        title: 'Test Collection',
        isDefault: false,
        children: [],
        variables: {},
        environments: {},
        dirPath: '/test/path',
      };

      const reorderItemSpy = vi
        .spyOn(PersistenceService.instance, 'reorderItem')
        .mockResolvedValue(collection);

      const eventService = new MainEventService();

      // Act
      await eventService.reorderItem(collection, 'child-id', 0);

      // Assert
      expect(reorderItemSpy).toHaveBeenCalledWith(collection, 'child-id', 0);
    });
  });

  describe('moveItem', () => {
    it('should delegate to persistence service moveChild', async () => {
      // Arrange
      const { MainEventService } = await import('./main-event-service');
      const { PersistenceService } = await import('../persistence/service/persistence-service');

      const collection: Collection = {
        id: randomUUID(),
        type: 'collection',
        title: 'Test Collection',
        isDefault: false,
        children: [],
        variables: {},
        environments: {},
        dirPath: '/test/path',
      };

      const folder: Folder = {
        id: randomUUID(),
        type: 'folder',
        title: 'Test Folder',
        parentId: collection.id,
        children: [],
      };

      const request: TrufosRequest = {
        id: randomUUID(),
        type: 'request',
        title: 'Test Request',
        parentId: collection.id,
        method: RequestMethod.GET,
        url: { base: 'http://example.com', query: [] },
        headers: [],
        body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
        draft: false,
      };

      const moveChildSpy = vi
        .spyOn(PersistenceService.instance, 'moveChild')
        .mockResolvedValue(undefined);

      const eventService = new MainEventService();

      // Act
      await eventService.moveItem(request, collection, folder, 0);

      // Assert
      expect(moveChildSpy).toHaveBeenCalledWith(request, collection, folder, 0);
    });
  });

  describe('saveRequest', () => {
    it('should delegate to persistence service saveRequest', async () => {
      // Arrange
      const { MainEventService } = await import('./main-event-service');
      const { PersistenceService } = await import('../persistence/service/persistence-service');

      const request: TrufosRequest = {
        id: randomUUID(),
        type: 'request',
        title: 'New Request',
        parentId: randomUUID(),
        method: RequestMethod.GET,
        url: { base: 'http://example.com', query: [] },
        headers: [],
        body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
        draft: false,
      };

      const saveRequestSpy = vi
        .spyOn(PersistenceService.instance, 'saveRequest')
        .mockResolvedValue(request);

      const eventService = new MainEventService();

      // Act
      await eventService.saveRequest(request, 'body text');

      // Assert
      expect(saveRequestSpy).toHaveBeenCalledWith(request, 'body text');
    });
  });
});
