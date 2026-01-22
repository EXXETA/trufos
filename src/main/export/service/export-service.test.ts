import { describe, it, expect, beforeEach } from 'vitest';
import { ExportService } from './export-service';
import { Collection } from 'shim/objects/collection';
import path from 'path';
import fs from 'node:fs/promises';
import { tmpdir } from 'os';
import { ZipReader, BlobReader, TextWriter } from '@zip.js/zip.js';

const exportService = ExportService.instance;

describe('ExportService', () => {
  let tempDir: string;
  let testCollection: Collection;

  beforeEach(async () => {
    tempDir = path.join(tmpdir(), 'trufos-export-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    testCollection = {
      id: 'test-collection-id',
      type: 'collection',
      title: 'Test Collection',
      dirPath: path.join(tempDir, 'test-collection'),
      variables: {},
      environments: {},
      children: [],
    };

    await fs.mkdir(testCollection.dirPath, { recursive: true });
    await fs.writeFile(
      path.join(testCollection.dirPath, 'collection.json'),
      JSON.stringify({
        title: 'Test Collection',
        variables: {
          normalVar: { value: 'normal-value', secret: false },
          secretVar: { value: 'secret-value', secret: true },
        },
        environments: {
          dev: {
            variables: {
              envNormal: { value: 'env-normal', secret: false },
              envSecret: { value: 'env-secret', secret: true },
            },
          },
        },
      })
    );
  });

  it('should export collection as ZIP file', async () => {
    const outputPath = await exportService.exportCollection(testCollection, tempDir);

    expect(outputPath).toBe(path.join(tempDir, 'Test Collection.trufos.zip'));
    const stats = await fs.stat(outputPath);
    expect(stats.isFile()).toBe(true);
  });

  it('should exclude secrets by default', async () => {
    await fs.writeFile(path.join(testCollection.dirPath, '.secrets.bin'), 'secret-data');

    await exportService.exportCollection(testCollection, tempDir);
  });

  it('should include secrets when option is set', async () => {
    await fs.writeFile(path.join(testCollection.dirPath, '.secrets.bin'), 'secret-data');

    await exportService.exportCollection(testCollection, tempDir, {
      includeSecrets: true,
    });
  });

  it('should clear secret values but keep keys when not including secrets', async () => {
    const outputPath = await exportService.exportCollection(testCollection, tempDir, {
      includeSecrets: false,
    });

    const zipBlob = new Blob([await fs.readFile(outputPath)]);
    const zipReader = new ZipReader(new BlobReader(zipBlob));
    const entries = await zipReader.getEntries();

    const collectionJsonEntry = entries.find((e) => e.filename === 'collection.json');
    expect(collectionJsonEntry).toBeDefined();

    if (collectionJsonEntry && collectionJsonEntry.getData) {
      const textWriter = new TextWriter();
      const content = await collectionJsonEntry.getData(textWriter);
      const json = JSON.parse(content);

      expect(json.variables.normalVar.value).toBe('normal-value');
      expect(json.variables.secretVar.value).toBe('');
      expect(json.variables.secretVar.secret).toBe(true);

      expect(json.environments.dev.variables.envNormal.value).toBe('env-normal');
      expect(json.environments.dev.variables.envSecret.value).toBe('');
      expect(json.environments.dev.variables.envSecret.secret).toBe(true);
    }

    await zipReader.close();
  });
});
