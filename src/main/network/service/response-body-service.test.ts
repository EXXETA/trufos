import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResponseBodyService } from './response-body-service';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { vol } from 'memfs';

vi.mock('node:fs');

describe('ResponseBodyService', () => {
  let service: ResponseBodyService;
  const mockFilePath = '/tmp/test-response-body.txt';

  beforeEach(() => {
    service = ResponseBodyService.instance;
    vol.reset();
    vol.fromJSON({
      [mockFilePath]: 'test content',
    });
  });

  afterEach(() => {
    service.clear();
    vol.reset();
  });

  describe('register', () => {
    it('should register a file path and return a UUID', () => {
      const id = service.register(mockFilePath);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBe(36);
    });

    it('should store the file path and allow retrieval', () => {
      const id = service.register(mockFilePath);
      const retrievedPath = service.getFilePath(id);

      expect(retrievedPath).toBe(mockFilePath);
    });

    it('should generate unique IDs for different file paths', () => {
      const id1 = service.register('/tmp/file1.txt');
      const id2 = service.register('/tmp/file2.txt');

      expect(id1).not.toBe(id2);
    });
  });

  describe('getFilePath', () => {
    it('should return the file path for a registered ID', () => {
      const id = service.register(mockFilePath);
      const path = service.getFilePath(id);

      expect(path).toBe(mockFilePath);
    });

    it('should return undefined for an unregistered ID', () => {
      const path = service.getFilePath(randomUUID());

      expect(path).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('should delete the file and remove the mapping', () => {
      vol.fromJSON({
        [mockFilePath]: 'test content',
      });

      const id = service.register(mockFilePath);
      service.remove(id);

      expect(fs.existsSync(mockFilePath)).toBe(false);
      expect(service.getFilePath(id)).toBeUndefined();
    });

    it('should handle removal of non-existent file gracefully', () => {
      const nonExistentPath = '/tmp/non-existent.txt';
      const id = service.register(nonExistentPath);

      service.remove(id);

      expect(service.getFilePath(id)).toBeUndefined();
    });

    it('should do nothing when removing an unregistered ID', () => {
      const nonExistentId = randomUUID();
      const filesBefore = Object.keys(vol.toJSON());

      service.remove(nonExistentId);

      const filesAfter = Object.keys(vol.toJSON());
      expect(filesAfter).toEqual(filesBefore);
    });

    it('should handle file deletion errors gracefully', () => {
      const id = service.register(mockFilePath);

      vi.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });

      expect(() => service.remove(id)).not.toThrow();
      expect(service.getFilePath(id)).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all registered entries and delete their files', () => {
      vol.fromJSON({
        '/tmp/file1.txt': 'content 1',
        '/tmp/file2.txt': 'content 2',
        '/tmp/file3.txt': 'content 3',
      });

      const id1 = service.register('/tmp/file1.txt');
      const id2 = service.register('/tmp/file2.txt');
      const id3 = service.register('/tmp/file3.txt');

      service.clear();

      expect(fs.existsSync('/tmp/file1.txt')).toBe(false);
      expect(fs.existsSync('/tmp/file2.txt')).toBe(false);
      expect(fs.existsSync('/tmp/file3.txt')).toBe(false);
      expect(service.getFilePath(id1)).toBeUndefined();
      expect(service.getFilePath(id2)).toBeUndefined();
      expect(service.getFilePath(id3)).toBeUndefined();
    });

    it('should handle empty service', () => {
      expect(() => service.clear()).not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should clear all entries on shutdown', () => {
      vol.fromJSON({
        '/tmp/file1.txt': 'content 1',
        '/tmp/file2.txt': 'content 2',
      });

      const id1 = service.register('/tmp/file1.txt');
      const id2 = service.register('/tmp/file2.txt');

      service.shutdown();

      expect(fs.existsSync('/tmp/file1.txt')).toBe(false);
      expect(fs.existsSync('/tmp/file2.txt')).toBe(false);
      expect(service.getFilePath(id1)).toBeUndefined();
      expect(service.getFilePath(id2)).toBeUndefined();
    });
  });
});
