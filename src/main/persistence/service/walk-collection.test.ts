import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it } from 'vitest';
import { USER_DATA_DIR } from 'main/util/fs-util';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { ScriptType } from 'shim/scripting';
import { PersistenceService } from './persistence-service';
import { RequestSnapshot } from './snapshot';

const persistenceService = PersistenceService.instance;

function getExampleCollection(): Collection {
  return {
    id: randomUUID(),
    type: 'collection',
    lastModified: Date.now(),
    title: 'collection',
    isDefault: false,
    children: [],
    variables: {},
    environments: {},
    dirPath: path.join(USER_DATA_DIR, 'collections', randomUUID()),
  };
}

function getExampleFolder(parentId: string, title = 'folder'): Folder {
  return {
    id: randomUUID(),
    type: 'folder',
    lastModified: Date.now(),
    title,
    children: [],
    parentId,
  };
}

function getExampleRequest(parentId: string, title = 'request'): TrufosRequest {
  return {
    id: randomUUID(),
    url: { base: 'https://example.com', query: [] },
    headers: [],
    type: 'request',
    lastModified: Date.now(),
    title,
    draft: false,
    parentId,
    method: RequestMethod.GET,
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
  };
}

async function streamToString(stream?: Readable) {
  if (stream == null) return undefined;
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

describe('PersistenceService.walkCollection()', () => {
  let collection: Collection;

  beforeEach(async () => {
    collection = getExampleCollection();
    await mkdir(collection.dirPath, { recursive: true });
  });

  it('returns a hydrated, ordered snapshot with bodies, scripts, and secrets', async () => {
    // Arrange
    collection.variables = {
      plainVar: { value: 'plain' },
      secretVar: { value: 's3cr3t', secret: true },
    };
    const folder = getExampleFolder(collection.id, 'my folder');
    const folderRequest = getExampleRequest(folder.id, 'folder request');
    folder.children.push(folderRequest);
    const rootRequest = getExampleRequest(collection.id, 'root request');
    collection.children.push(folder, rootRequest);

    await persistenceService.saveCollection(collection, true);
    await persistenceService.saveRequest(folderRequest, 'hello body');
    await persistenceService.saveScript(folderRequest, ScriptType.PRE_REQUEST, 'console.log(1)');
    // move the root request before the folder to create a custom order
    await persistenceService.reorderItem(collection, rootRequest.id, 0);

    // Act
    const snapshot = await persistenceService.walkCollection(collection.dirPath);

    // Assert
    expect(snapshot.id).toBe(collection.id);
    expect(snapshot.variables).toEqual(collection.variables); // secrets merged back in-memory
    expect(snapshot.children.map((child) => child.id)).toEqual([rootRequest.id, folder.id]);

    const folderSnapshot = snapshot.children[1];
    if (folderSnapshot.type !== 'folder') throw new Error('expected folder snapshot');
    const requestSnapshot = folderSnapshot.children[0] as RequestSnapshot;
    expect(requestSnapshot.id).toBe(folderRequest.id);
    expect(await streamToString(await requestSnapshot.getBodyContent())).toBe('hello body');
    expect(
      await streamToString(await requestSnapshot.getScriptContent(ScriptType.PRE_REQUEST))
    ).toBe('console.log(1)');
    expect(await requestSnapshot.getScriptContent(ScriptType.POST_RESPONSE)).toBeUndefined();

    const rootSnapshot = snapshot.children[0] as RequestSnapshot;
    expect(await rootSnapshot.getBodyContent()).toBeUndefined();
  });

  it('uses the saved state of a request, ignoring its draft overlay', async () => {
    // Arrange
    const request = getExampleRequest(collection.id, 'saved title');
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.saveRequest(request, 'saved body');
    await persistenceService.saveRequest(
      { ...request, draft: true, title: 'draft title' },
      'draft body'
    );

    // Act
    const snapshot = await persistenceService.walkCollection(collection.dirPath);

    // Assert
    const requestSnapshot = snapshot.children[0] as RequestSnapshot;
    expect(requestSnapshot.title).toBe('saved title');
    expect(requestSnapshot.draft).toBe(false);
    expect(await streamToString(await requestSnapshot.getBodyContent())).toBe('saved body');
  });

  it('skips draft-only requests that were never saved', async () => {
    // Arrange
    const saved = getExampleRequest(collection.id, 'saved');
    collection.children.push(saved);
    await persistenceService.saveCollection(collection, true);
    const draftOnly: TrufosRequest = {
      ...getExampleRequest(collection.id, 'draft only'),
      draft: true,
    };
    await persistenceService.saveRequest(draftOnly, 'never committed');

    // Act
    const snapshot = await persistenceService.walkCollection(collection.dirPath);

    // Assert
    expect(snapshot.children.map((child) => child.id)).toEqual([saved.id]);
  });

  it('regenerates consistent ids with freshIds without touching the id-to-path mapping', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    const request = getExampleRequest(folder.id);
    folder.children.push(request);
    collection.children.push(folder);
    await persistenceService.saveCollection(collection, true);

    // Act
    const preserved = await persistenceService.walkCollection(collection.dirPath);
    const fresh = await persistenceService.walkCollection(collection.dirPath, { freshIds: true });

    // Assert
    expect(preserved.id).toBe(collection.id);
    expect(fresh.id).not.toBe(collection.id);
    const freshFolder = fresh.children[0];
    if (freshFolder.type !== 'folder') throw new Error('expected folder snapshot');
    expect(freshFolder.id).not.toBe(folder.id);
    expect(freshFolder.parentId).toBe(fresh.id);
    expect(freshFolder.children[0].id).not.toBe(request.id);
    expect(freshFolder.children[0].parentId).toBe(freshFolder.id);

    const idToPathMap = (persistenceService as unknown as { idToPathMap: Map<string, string> })
      .idToPathMap;
    expect(idToPathMap.has(fresh.id)).toBe(false);
    expect(idToPathMap.has(freshFolder.id)).toBe(false);
  });
});
