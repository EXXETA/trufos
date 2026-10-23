import { randomUUID } from 'node:crypto';
import type {
  Collection,
  CollectionExporter,
  CollectionImporter,
  PluginActivate,
  PluginFileSystem,
} from 'shim/plugin';

/** Reads a JSON file with a `title` into an empty collection with that title. */
function titleImporter(fs: PluginFileSystem): CollectionImporter {
  return {
    async importCollection(srcFilePath: string): Promise<Collection> {
      const { title } = JSON.parse(await fs.readFile(srcFilePath, 'utf8'));
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
}

/** Writes a JSON file with the directory of the exported collection. */
function titleExporter(fs: PluginFileSystem): CollectionExporter {
  return {
    async exportCollection(dirPath: string, targetPath: string): Promise<void> {
      await fs.writeFile(targetPath, JSON.stringify({ dirPath }));
    },
  };
}

export const activate: PluginActivate = (host) => ({
  importers: { title: titleImporter(host.fs) },
  exporters: { title: titleExporter(host.fs) },
});
