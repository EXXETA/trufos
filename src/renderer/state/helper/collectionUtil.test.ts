import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { describe, expect, it, vi } from 'vitest';
import { copyFolder, copyTrufosRequest } from './collectionUtil';

vi.mock('@/lib/ipc-stream', () => {
  return {
    IpcPushStream: {},
  };
});

const MOCK_REQUEST: TrufosRequest = {
  id: 'request-1',
  parentId: 'folder-1',
  type: 'request',
  title: 'Test Request',
  url: 'https://example.com/api/data',
  method: RequestMethod.GET,
  headers: [
    { key: 'header-1', value: 'header-value-1', isActive: true },
    { key: 'header-2', value: 'value-2', isActive: true },
  ],
  queryParams: [
    { key: 'param-1', value: 'param-value-1', isActive: true },
    { key: 'param-2', value: 'param-value-2', isActive: true },
  ],
  body: {
    type: RequestBodyType.TEXT,
    text: 'Hello World',
    mimeType: 'text/plain',
  },
  draft: true,
};

const MOCK_FOLDER: Folder = {
  id: 'folder-1',
  type: 'folder',
  parentId: 'collection-1',
  title: 'Folder 1',
  children: [
    {
      ...MOCK_REQUEST,
      id: 'folder-1-request',
      title: 'Request in Folder 1',
    },
    {
      type: 'folder',
      id: 'folder-2',
      parentId: 'folder-1',
      title: 'Folder 2',
      children: [
        {
          ...MOCK_REQUEST,
          id: 'folder-2-request',
          title: 'Request in Folder 2',
        },
      ],
    },
  ],
};

describe('collectionUtil', () => {
  describe('copyTrufosRequest', () => {
    it('should copy a request and add the "(Copy)" suffix by default', () => {
      // Act
      const copiedRequest = copyTrufosRequest(MOCK_REQUEST);

      // Assert
      expect(copiedRequest).not.toEqual(MOCK_REQUEST.id);
      expect(copiedRequest).toEqual({
        ...MOCK_REQUEST,
        id: expect.any(String),
        title: 'Test Request (Copy)',
        draft: false,
      });
    });

    it('should copy a request and not add the "(Copy)" suffix', () => {
      // Act
      const copiedRequest = copyTrufosRequest(MOCK_REQUEST, false);

      // Assert
      expect(copiedRequest).not.toEqual(MOCK_REQUEST.id);
      expect(copiedRequest).toEqual({
        ...MOCK_REQUEST,
        id: expect.any(String),
        draft: false,
      });
    });

    it('should not change the original object if the copy changes', () => {
      // Arrange
      const originalRequest = { ...MOCK_REQUEST };

      // Act
      const copiedRequest = copyTrufosRequest(originalRequest, false);

      originalRequest.queryParams.pop();
      originalRequest.method = RequestMethod.POST;

      copiedRequest.title = 'Changed Title';
      copiedRequest.headers.push({ key: 'new-header', value: 'new-value', isActive: true });
      copiedRequest.body = {
        type: RequestBodyType.TEXT,
        text: 'New Text',
        mimeType: 'text/plain',
      };

      // Assert
      expect(copiedRequest.queryParams.length).not.toEqual(originalRequest.queryParams.length);
      expect(copiedRequest.method).not.toEqual(originalRequest.method);
      expect(copiedRequest.title).not.toEqual(originalRequest.title);
      expect(copiedRequest.headers.length).not.toEqual(originalRequest.headers.length);
      expect(copiedRequest.body).not.toEqual(originalRequest.body);
    });
  });

  describe('copyFolder', () => {
    it("should copy a folder and add the '(Copy)' suffix by default", () => {
      // Act
      const copiedFolder = copyFolder(MOCK_FOLDER);

      // Assert
      expect(copiedFolder.id).not.toEqual(MOCK_FOLDER.id);
      expect(copiedFolder).toEqual({
        ...MOCK_FOLDER,
        id: expect.any(String),
        title: 'Folder 1 (Copy)',
        children: expect.any(Array),
      });
      expect(copiedFolder.children[0]).toEqual({
        ...MOCK_FOLDER.children[0],
        id: expect.any(String),
        parentId: copiedFolder.id,
        draft: false,
      });
      expect(copiedFolder.children[1]).toEqual({
        ...MOCK_FOLDER.children[1],
        id: expect.any(String),
        parentId: copiedFolder.id,
        children: expect.any(Array),
      });
      expect((copiedFolder.children[1] as Folder).children[0]).toEqual({
        ...(MOCK_FOLDER.children[1] as Folder).children[0],
        id: expect.any(String),
        parentId: copiedFolder.children[1].id,
        draft: false,
      });
    });

    it("should copy a folder and not add the '(Copy)' suffix", () => {
      // Act
      const copiedFolder = copyFolder(MOCK_FOLDER, false);

      // Assert
      expect(copiedFolder.id).not.toEqual(MOCK_FOLDER.id);
      expect(copiedFolder.title).toEqual(MOCK_FOLDER.title);
    });

    it('should not change the original object if the copy changes', () => {
      // Act
      const copiedFolder = copyFolder(MOCK_FOLDER);

      copiedFolder.title = 'New Title';
      copiedFolder.children.push({
        type: 'folder',
        id: 'new-folder',
        parentId: copiedFolder.id,
        title: 'New Folder',
        children: [],
      });

      // Assert
      expect(copiedFolder.title).not.toEqual(MOCK_FOLDER.title);
      expect(copiedFolder.children.length).toEqual(MOCK_FOLDER.children.length + 1);
    });
  });
});
