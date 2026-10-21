import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type {
  Collection,
  CollectionExporter,
  CollectionImporter,
  PluginActivate,
} from 'shim/plugin';

/** Reads a JSON file with a `title` into an empty collection with that title. */
const titleImporter: CollectionImporter = {
  async importCollection(srcFilePath: string): Promise<Collection> {
    const { title } = JSON.parse(await readFile(srcFilePath, 'utf8'));
    return {
      id: randomUUID(),
      type: 'collection',
      title,
      dirPath: '',
      lastModified: Date.now(),
      variables: {},
      environments: {},
      children: [],
    };
  },
};

/** Writes a JSON file with the directory of the exported collection. */
const titleExporter: CollectionExporter = {
  async exportCollection(dirPath: string, targetPath: string): Promise<void> {
    await writeFile(targetPath, JSON.stringify({ dirPath }));
  },
};

export const activate: PluginActivate = (host) => {
  host.log.info('Activated');
  return {
    importers: { title: titleImporter },
    exporters: { title: titleExporter },
  };
};
