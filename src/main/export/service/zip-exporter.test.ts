import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextWriter, Uint8ArrayReader, ZipReader } from '@zip.js/zip.js';
import type { ExportOptions } from 'shim/event-service';
import { Collection } from 'shim/objects/collection';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { ScriptType } from 'shim/scripting';
import { USER_DATA_DIR } from 'main/util/fs-util';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { CollectionSnapshot, RequestSnapshot } from 'main/persistence/service/snapshot';
import { ZipExporter } from './zip-exporter';

const persistenceService = PersistenceService.instance;

function getExampleCollection(): Collection {
  return {
    id: randomUUID(),
    type: 'collection',
    lastModified: Date.now(),
    title: 'my collection',
    isDefault: false,
    children: [],
    variables: {},
    environments: {},
    dirPath: path.join(USER_DATA_DIR, 'collections', randomUUID()),
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

/** Creates and persists a simple collection with one request (with body) via the persistence layer. */
async function createPersistedCollection() {
  const collection = getExampleCollection();
  const request = getExampleRequest(collection.id, 'my request');
  collection.children.push(request);
  await fs.mkdir(collection.dirPath, { recursive: true });
  await persistenceService.saveCollection(collection, true);
  await persistenceService.saveRequest(request, 'hello world');
  return { collection, request };
}

/** Exports the given collection directory to a temporary zip and returns the raw archive bytes. */
async function exportToZip(collectionDir: string, options?: ExportOptions): Promise<Uint8Array> {
  const targetPath = path.join(await fs.mkdtemp(path.join(tmpdir(), 'export-out-')), 'export.zip');
  await new ZipExporter().exportCollection(collectionDir, targetPath, options);
  return new Uint8Array(await fs.readFile(targetPath));
}

/** Reads every file entry of an (optionally password-protected) archive as text via zip.js. */
async function readEntries(buffer: Uint8Array, password?: string): Promise<Record<string, string>> {
  const reader = new ZipReader(new Uint8ArrayReader(buffer));
  try {
    const result: Record<string, string> = {};
    for (const entry of await reader.getEntries()) {
      if (entry.directory) continue;
      result[entry.filename] = await entry.getData(
        new TextWriter(),
        password == null ? undefined : { password }
      );
    }
    return result;
  } finally {
    await reader.close();
  }
}

describe('ZipExporter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('archives the serialized collection layout without drafts or secrets by default', async () => {
    const { collection, request } = await createPersistedCollection();
    collection.variables = { secretVar: { value: 's3cr3t', secret: true } };
    await persistenceService.saveCollection(collection);
    // add a draft overlay that must not end up in the archive
    await persistenceService.saveRequest({ ...request, draft: true, title: 'draft' }, 'draft body');

    const entries = await readEntries(await exportToZip(collection.dirPath));
    const names = Object.keys(entries);

    expect(names).toContain('collection.json');
    expect(names).toContain('order.json');
    expect(names).toContain('.gitignore');
    expect(entries['my-request/request-body.txt']).toBe('hello world');
    expect(JSON.parse(entries['order.json'])).toEqual([request.id]);

    expect(names.some((name) => name.includes('.draft'))).toBe(false);
    expect(names.some((name) => name.endsWith('.secrets.bin'))).toBe(false);
    expect(JSON.parse(entries['collection.json']).variables).toEqual({});
  });

  it('includes scripts in the archive', async () => {
    const { collection, request } = await createPersistedCollection();
    await persistenceService.saveScript(request, ScriptType.POST_RESPONSE, 'trufos.log()');

    const entries = await readEntries(await exportToZip(collection.dirPath));
    expect(entries['my-request/post-response-script.js']).toBe('trufos.log()');
  });

  it('includes secrets as plaintext JSON when includeSecrets is set', async () => {
    const { collection } = await createPersistedCollection();
    collection.variables = { secretVar: { value: 's3cr3t', secret: true } };
    await persistenceService.saveCollection(collection);

    const entries = await readEntries(
      await exportToZip(collection.dirPath, { includeSecrets: true })
    );

    expect(JSON.parse(entries['.secrets.bin']).variables.secretVar.value).toBe('s3cr3t');
    expect(JSON.parse(entries['collection.json']).variables).toEqual({});
  });

  it('encrypts the archive with AES-256 when a password is provided', async () => {
    const { collection } = await createPersistedCollection();

    const buffer = await exportToZip(collection.dirPath, { password: 'hunter2' });

    const reader = new ZipReader(new Uint8ArrayReader(buffer));
    try {
      const entries = await reader.getEntries();
      const body = entries.find((e) => e.filename === 'my-request/request-body.txt');
      expect(body).toBeDefined();
      expect(body?.encrypted).toBe(true);
      expect(body?.zipCrypto).toBe(false); // AES, not legacy ZipCrypto
      if (body == null || body.directory) throw new Error('unexpected directory entry');
      const text = await body.getData(new TextWriter(), { password: 'hunter2' });
      expect(text).toBe('hello world');
    } finally {
      await reader.close();
    }
  });

  it('cannot decrypt the archive with a wrong password', async () => {
    const { collection } = await createPersistedCollection();

    const buffer = await exportToZip(collection.dirPath, { password: 'correct-password' });

    const reader = new ZipReader(new Uint8ArrayReader(buffer));
    try {
      const entries = await reader.getEntries();
      const entry = entries.find((e) => e.filename === 'collection.json');
      if (entry == null || entry.directory) throw new Error('unexpected directory entry');
      await expect(
        entry.getData(new TextWriter(), { password: 'wrong-password' })
      ).rejects.toThrow();
    } finally {
      await reader.close();
    }
  });

  it('deletes the partial archive and rethrows when streaming fails mid-export', async () => {
    const { collection } = await createPersistedCollection();
    const targetPath = path.join(
      await fs.mkdtemp(path.join(tmpdir(), 'export-out-')),
      'export.zip'
    );

    // Force a failure while reading an entry's content, after the target file has been created.
    const failingSnapshot: CollectionSnapshot = {
      ...collection,
      children: [
        {
          ...getExampleRequest(collection.id, 'boom'),
          getBodyContent: async (): Promise<Readable> => {
            throw new Error('boom');
          },
          getScriptContent: async () => undefined,
        } as RequestSnapshot,
      ],
    };
    vi.spyOn(persistenceService, 'walkCollection').mockResolvedValue(failingSnapshot);

    await expect(
      new ZipExporter().exportCollection(collection.dirPath, targetPath)
    ).rejects.toThrow('boom');
    await expect(fs.access(targetPath)).rejects.toThrow();
  });
});
