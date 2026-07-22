import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { TrufosObject } from 'shim/objects';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { ScriptType } from 'shim/scripting';
import { USER_DATA_DIR } from 'main/util/fs-util';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { ZipExporter } from './zip-exporter';

const persistenceService = PersistenceService.instance;

/**
 * Round-trip canary: builds a collection through the persistence layer using every artifact type
 * (variables incl. secrets, environments, custom child order, request body, scripts, drafts),
 * exports it, unzips the archive, and loads it back as a collection. If the persistence layer ever
 * gains an artifact that the collection serializer does not emit, this test fails.
 */
describe('ZIP export round-trip', () => {
  it('re-imports an exported collection identically (minus secrets)', async () => {
    // Arrange: build the source collection with every artifact type
    const collection: Collection = {
      id: randomUUID(),
      type: 'collection',
      lastModified: Date.now(),
      title: 'round trip',
      isDefault: false,
      children: [],
      variables: {
        plainVar: { value: 'plain', description: 'kept' },
        secretVar: { value: 's3cr3t', secret: true },
      },
      environments: { dev: { variables: { apiUrl: { value: 'https://dev.example.com' } } } },
      dirPath: path.join(USER_DATA_DIR, 'collections', randomUUID()),
    };
    const folder: Folder = {
      id: randomUUID(),
      type: 'folder',
      lastModified: Date.now(),
      title: 'my folder',
      children: [],
      parentId: collection.id,
    };
    const folderRequest: TrufosRequest = {
      id: randomUUID(),
      url: { base: 'https://example.com', query: [{ key: 'q', value: '1', isActive: true }] },
      headers: [{ key: 'Accept', value: 'application/json', isActive: true }],
      type: 'request',
      lastModified: Date.now(),
      title: 'folder request',
      draft: false,
      parentId: folder.id,
      method: RequestMethod.POST,
      body: { type: RequestBodyType.TEXT, mimeType: 'application/json' },
    };
    folder.children.push(folderRequest);
    const rootRequest: TrufosRequest = {
      ...folderRequest,
      id: randomUUID(),
      title: 'root request',
      parentId: collection.id,
      method: RequestMethod.GET,
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };
    collection.children.push(folder, rootRequest);

    await fs.mkdir(collection.dirPath, { recursive: true });
    await persistenceService.saveCollection(collection, true);
    await persistenceService.saveRequest(folderRequest, '{"hello":"world"}');
    await persistenceService.saveScript(folderRequest, ScriptType.PRE_REQUEST, 'pre();');
    await persistenceService.saveScript(folderRequest, ScriptType.POST_RESPONSE, 'post();');
    await persistenceService.reorderItem(collection, rootRequest.id, 0); // custom order

    // capture the canonical saved model BEFORE adding a draft overlay: loadCollection() merges
    // drafts into the model, while the export is saved-only by design
    const source = await persistenceService.loadCollection(collection.dirPath);

    // a draft overlay that must not survive the round trip
    await persistenceService.saveRequest(
      { ...rootRequest, draft: true, title: 'draft title' },
      'draft body'
    );

    // Act: export -> unzip -> load
    const targetPath = path.join(
      await fs.mkdtemp(path.join(tmpdir(), 'round-trip-')),
      'export.zip'
    );
    await new ZipExporter().exportCollection(collection.dirPath, targetPath);

    const importDir = await fs.mkdtemp(path.join(tmpdir(), 'round-trip-import-'));
    const reader = new ZipReader(
      new Uint8ArrayReader(new Uint8Array(await fs.readFile(targetPath)))
    );
    try {
      for (const entry of await reader.getEntries()) {
        if (entry.directory) continue;
        const filePath = path.join(importDir, entry.filename);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, await entry.getData(new Uint8ArrayWriter()));
      }
    } finally {
      await reader.close();
    }
    const imported = await persistenceService.loadCollection(importDir);

    // Assert: identical structure and data, minus secrets (excluded by default)
    expect(normalize(imported)).toEqual(withoutSecrets(normalize(source)));

    // body and scripts survive the round trip (loaded through the regular persistence API)
    const importedFolderRequest = findRequest(imported, folderRequest.id);
    expect(
      await streamToString(await persistenceService.loadTextBodyOfRequest(importedFolderRequest))
    ).toBe('{"hello":"world"}');
    expect(
      await streamToString(
        await persistenceService.loadScript(importedFolderRequest, ScriptType.PRE_REQUEST)
      )
    ).toBe('pre();');
    expect(
      await streamToString(
        await persistenceService.loadScript(importedFolderRequest, ScriptType.POST_RESPONSE)
      )
    ).toBe('post();');

    // the draft overlay did not survive
    const importedRootRequest = findRequest(imported, rootRequest.id);
    expect(importedRootRequest.title).toBe('root request');
    expect(imported.children.map((child) => child.id)).toEqual([rootRequest.id, folder.id]);
  });
});

/** Recursively strips volatile fields (lastModified, dirPath, isDefault, index) for comparison. */
function normalize(object: TrufosObject): Record<string, unknown> {
  const result: Record<string, unknown> = { ...object };
  delete result.lastModified;
  delete result.dirPath;
  delete result.isDefault;
  delete result.index;
  if (object.type !== 'request') {
    result.children = object.children.map(normalize);
  }
  return result;
}

/** Removes secret-flagged variables, mirroring an export without includeSecrets. */
function withoutSecrets(normalized: Record<string, unknown>): Record<string, unknown> {
  const variables = Object.fromEntries(
    Object.entries(normalized.variables as Record<string, { secret?: boolean }>).filter(
      ([, variable]) => !variable.secret
    )
  );
  return { ...normalized, variables };
}

function findRequest(collection: Collection, id: string): TrufosRequest {
  const stack = [...collection.children];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === 'request' && node.id === id) return node;
    if (node.type === 'folder') stack.push(...node.children);
  }
  throw new Error(`Request ${id} not found`);
}

async function streamToString(stream?: NodeJS.ReadableStream) {
  if (stream == null) return undefined;
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks).toString('utf-8');
}
