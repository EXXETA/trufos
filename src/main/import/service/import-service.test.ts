import { ImportService } from './import-service';
import fs from 'node:fs/promises';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { FALLBACK_TITLE_DIR_NAME } from 'shim/string';
import { vi, describe, it, expect } from 'vitest';
import { PluginService } from 'main/plugin/plugin-service';
import { InternalError } from 'main/error/internal-error';

vi.mock('main/persistence/service/persistence-service');

const SOURCE_FILE_PATH = '/source.json';

/** Lets the next import use an importer of a plugin that reads a collection with the given title. */
function mockPluginImporter(title = 'HTTP Status Messages') {
  vi.spyOn(PluginService.instance, 'getImporter').mockResolvedValueOnce({
    importCollection: async () => ({
      id: randomUUID(),
      type: 'collection',
      title,
      dirPath: '',
      lastModified: 0,
      variables: {},
      environments: {},
      children: [],
    }),
  });
}

describe('ImportService', () => {
  describe('collection directory', () => {
    async function importInto(targetDirPath: string, title?: string) {
      mockPluginImporter();
      // @ts-expect-error saveCollection mock returns null but type expects void
      vi.mocked(PersistenceService.instance.saveCollection).mockImplementation(async () => null);

      const result = await ImportService.instance.importCollection(
        SOURCE_FILE_PATH,
        targetDirPath,
        'plugin.importer',
        title
      );
      return result.collection.dirPath;
    }

    it('uses an empty target directory directly', async () => {
      const targetDirPath = await fs.mkdtemp(path.join(tmpdir(), 'import-empty-'));

      expect(await importInto(targetDirPath)).toBe(targetDirPath);
    });

    it('uses a target directory that does not exist yet directly', async () => {
      const targetDirPath = path.join(tmpdir(), `import-missing-${randomUUID()}`);

      expect(await importInto(targetDirPath)).toBe(targetDirPath);
    });

    it('creates a subdirectory when the target directory is already in use', async () => {
      const targetDirPath = await fs.mkdtemp(path.join(tmpdir(), 'import-used-'));
      await fs.writeFile(path.join(targetDirPath, 'some-other-file.txt'), '');

      expect(await importInto(targetDirPath)).toBe(
        path.join(targetDirPath, 'http-status-messages')
      );
    });

    it('suffixes the subdirectory when its name is already taken', async () => {
      const targetDirPath = await fs.mkdtemp(path.join(tmpdir(), 'import-collision-'));
      await fs.mkdir(path.join(targetDirPath, 'http-status-messages'));
      await fs.writeFile(path.join(targetDirPath, 'http-status-messages', 'collection.json'), '{}');

      expect(await importInto(targetDirPath)).toBe(
        path.join(targetDirPath, 'http-status-messages-2')
      );
    });

    /** Fails the save after writing part of the collection, like a full disk would. */
    function mockPartiallyFailingSave() {
      vi.mocked(PersistenceService.instance.saveCollection).mockImplementationOnce(
        async (collection) => {
          await fs.mkdir(path.join(collection.dirPath, 'half-imported'), { recursive: true });
          throw new Error('disk full');
        }
      );
    }

    it('leaves no half-imported directory behind when saving fails', async () => {
      const targetDirPath = await fs.mkdtemp(path.join(tmpdir(), 'import-fail-'));
      await fs.writeFile(path.join(targetDirPath, 'some-other-file.txt'), '');
      mockPluginImporter();
      mockPartiallyFailingSave();

      await expect(
        ImportService.instance.importCollection(SOURCE_FILE_PATH, targetDirPath, 'plugin.importer')
      ).rejects.toThrow('disk full');

      // neither the collection directory nor its staging directory survive the failure
      expect(await fs.readdir(targetDirPath)).toEqual(['some-other-file.txt']);
    });

    it('leaves a directly used target directory untouched when saving fails', async () => {
      const targetDirPath = await fs.mkdtemp(path.join(tmpdir(), 'import-fail-direct-'));
      mockPluginImporter();
      mockPartiallyFailingSave();

      await expect(
        ImportService.instance.importCollection(SOURCE_FILE_PATH, targetDirPath, 'plugin.importer')
      ).rejects.toThrow('disk full');

      // the directory the user picked is restored, only the half-imported content is gone
      expect(await fs.readdir(targetDirPath)).toEqual([]);
    });

    it('never writes into the used target directory itself, even for non-Latin titles', async () => {
      // an all-non-Latin title sanitizes to the fallback name instead of an empty string, which
      // would make the subdirectory path collapse to the target directory holding other data
      const targetDirPath = await fs.mkdtemp(path.join(tmpdir(), 'import-cyrillic-'));
      await fs.writeFile(path.join(targetDirPath, 'some-other-file.txt'), '');

      expect(await importInto(targetDirPath, 'Получить приложения')).toBe(
        path.join(targetDirPath, FALLBACK_TITLE_DIR_NAME)
      );
    });
  });

  it('should import with an importer of a plugin', async () => {
    // Arrange
    const targetDirPath = path.join(tmpdir(), randomUUID());
    const importer = {
      importCollection: vi.fn(async () => ({
        id: 'plugin-collection',
        type: 'collection' as const,
        title: 'From Plugin',
        dirPath: '',
        lastModified: 0,
        variables: {},
        environments: {},
        children: [],
      })),
      getWarnings: () => [{ message: 'Skipped something' }],
    };
    const getImporter = vi.spyOn(PluginService.instance, 'getImporter');
    getImporter.mockResolvedValueOnce(importer);

    // Act
    const result = await ImportService.instance.importCollection(
      '/source.json',
      targetDirPath,
      'my-plugin.importer'
    );

    // Assert
    expect(getImporter).toHaveBeenCalledWith('my-plugin.importer');
    expect(importer.importCollection).toHaveBeenCalledWith('/source.json');
    expect(result.collection.title).toBe('From Plugin');
    expect(result.collection.dirPath).toBe(targetDirPath);
    expect(result.warnings).toEqual([{ message: 'Skipped something' }]);
  });

  it('should throw if no importer is registered for the strategy', async () => {
    // Arrange
    vi.spyOn(PluginService.instance, 'getImporter').mockResolvedValueOnce(undefined);

    // Act
    const action = ImportService.instance.importCollection('/source.json', tmpdir(), 'unknown.x');

    // Assert
    await expect(action).rejects.toThrow(InternalError);
  });
});
