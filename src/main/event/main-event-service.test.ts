import path from 'node:path';
import { tmpdir } from 'node:os';
import { fs } from 'memfs';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Collection } from 'shim/objects/collection';
import { TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { RequestBodyType } from 'shim/objects/request';

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

  describe('moveItem', () => {
    it('should call reorderItem on persistence service', async () => {
      // Arrange
      const { MainEventService } = await import('./main-event-service');
      const { PersistenceService } = await import('../persistence/service/persistence-service');
      const { EnvironmentService } = await import('../environment/service/environment-service');

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

      collection.children.push(request);

      const reorderItemSpy = vi
        .spyOn(PersistenceService.instance, 'reorderItem')
        .mockResolvedValue(undefined);
      vi.spyOn(EnvironmentService.instance, 'currentCollection', 'get').mockReturnValue(collection);

      const eventService = new MainEventService();

      // Act
      await eventService.moveItem(request.id, collection.id, 0);

      // Assert
      expect(reorderItemSpy).toHaveBeenCalledWith(collection, request.id, collection.id, 0);
    });

    it('should update indices after moving item', async () => {
      // Arrange
      const { MainEventService } = await import('./main-event-service');
      const { PersistenceService } = await import('../persistence/service/persistence-service');
      const { EnvironmentService } = await import('../environment/service/environment-service');

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

      const persistIndicesSpy = vi
        .spyOn(PersistenceService.instance, 'persistIndices')
        .mockResolvedValue(undefined);
      vi.spyOn(PersistenceService.instance, 'reorderItem').mockResolvedValue(undefined);
      vi.spyOn(EnvironmentService.instance, 'currentCollection', 'get').mockReturnValue(collection);

      const eventService = new MainEventService();

      // Act
      await eventService.moveItem('item-id', collection.id, 0);

      // Assert
      expect(persistIndicesSpy).toHaveBeenCalled();
    });
  });

  describe('saveRequest', () => {
    it('should update parent indices after saving new request', async () => {
      // Arrange
      const { MainEventService } = await import('./main-event-service');
      const { PersistenceService } = await import('../persistence/service/persistence-service');
      const { EnvironmentService } = await import('../environment/service/environment-service');

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

      const request: TrufosRequest = {
        id: randomUUID(),
        type: 'request',
        title: 'New Request',
        parentId: collection.id,
        method: RequestMethod.GET,
        url: { base: 'http://example.com', query: [] },
        headers: [],
        body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
        draft: false,
      };

      const saveRequestSpy = vi
        .spyOn(PersistenceService.instance, 'saveRequest')
        .mockResolvedValue(request);
      const persistIndicesSpy = vi
        .spyOn(PersistenceService.instance, 'persistIndices')
        .mockResolvedValue(undefined);
      const findNodeByIdSpy = vi
        .spyOn(PersistenceService.instance, 'findNodeById')
        .mockReturnValue(collection);
      vi.spyOn(EnvironmentService.instance, 'currentCollection', 'get').mockReturnValue(collection);

      const eventService = new MainEventService();

      // Act
      await eventService.saveRequest(request);

      // Assert
      expect(saveRequestSpy).toHaveBeenCalledWith(request, undefined);
      expect(findNodeByIdSpy).toHaveBeenCalledWith(collection, request.parentId);
      expect(persistIndicesSpy).toHaveBeenCalledWith(collection);
    });
  });
});
