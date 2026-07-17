import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { AuthorizationType } from 'shim/objects/auth';
import { RequestBodyType } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { ScriptType } from 'shim/scripting';
import { serializeCollection, SerializeOptions } from './collection-serializer';
import { VERSION } from './info-files/latest';
import { CollectionSnapshot, RequestSnapshot } from './snapshot';

function makeRequestSnapshot(
  parentId: string,
  title: string,
  overrides: Partial<RequestSnapshot> = {}
): RequestSnapshot {
  return {
    id: randomUUID(),
    parentId,
    type: 'request',
    lastModified: Date.now(),
    title,
    url: { base: 'https://example.com', query: [] },
    method: RequestMethod.GET,
    headers: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    draft: false,
    getBodyContent: async () => undefined,
    getScriptContent: async () => undefined,
    ...overrides,
  };
}

function makeCollectionSnapshot(overrides: Partial<CollectionSnapshot> = {}): CollectionSnapshot {
  return {
    id: randomUUID(),
    type: 'collection',
    lastModified: Date.now(),
    title: 'my collection',
    isDefault: false,
    dirPath: '/somewhere/my-collection',
    variables: {},
    environments: {},
    children: [],
    ...overrides,
  };
}

/** Serializes the snapshot and collects all entries into a path -> text map. */
async function collectEntries(snapshot: CollectionSnapshot, options?: SerializeOptions) {
  const entries: Record<string, string> = {};
  for await (const entry of serializeCollection(snapshot, options)) {
    let text: string;
    if (typeof entry.data === 'string') {
      text = entry.data;
    } else {
      const chunks: Uint8Array[] = [];
      for await (const chunk of entry.data) chunks.push(chunk as Uint8Array);
      text = Buffer.concat(chunks).toString('utf-8');
    }
    expect(entries[entry.path]).toBeUndefined(); // no duplicate paths
    entries[entry.path] = text;
  }
  return entries;
}

describe('serializeCollection()', () => {
  it('emits the canonical collection layout with ordered children', async () => {
    const snapshot = makeCollectionSnapshot({
      variables: { plainVar: { value: 'plain' }, secretVar: { value: 's3cr3t', secret: true } },
    });
    const requestA = makeRequestSnapshot(snapshot.id, 'My Request', {
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain', text: 'inline body' },
      getBodyContent: async () => Readable.from(Buffer.from('inline body')),
      getScriptContent: async (type) =>
        type === ScriptType.PRE_REQUEST ? Readable.from(Buffer.from('script!')) : undefined,
    });
    const requestB = makeRequestSnapshot(snapshot.id, 'My Request'); // duplicate title
    const folder = {
      id: randomUUID(),
      parentId: snapshot.id,
      type: 'folder' as const,
      lastModified: Date.now(),
      title: 'My Folder',
      children: [],
    };
    snapshot.children.push(requestA, requestB, folder);

    const entries = await collectEntries(snapshot);
    const names = Object.keys(entries);

    expect(entries['.gitignore']).toBe('.draft\n.secrets.bin');
    expect(JSON.parse(entries['order.json'])).toEqual([requestA.id, requestB.id, folder.id]);
    expect(names).toContain('my-request/request.json');
    expect(names).toContain('my-request-2/request.json'); // duplicate title suffixed
    expect(names).toContain('my-folder/folder.json');
    expect(names).not.toContain('my-folder/order.json'); // no children, no order file

    const collectionInfo = JSON.parse(entries['collection.json']);
    expect(collectionInfo.version).toBe(VERSION.toString());
    expect(collectionInfo.children).toBeUndefined();
    expect(collectionInfo.variables).toEqual({ plainVar: { value: 'plain' } }); // secret stripped

    expect(entries['my-request/request-body.txt']).toBe('inline body');
    expect(entries['my-request/pre-request-script.js']).toBe('script!');

    const requestInfo = JSON.parse(entries['my-request/request.json']);
    expect(requestInfo.getBodyContent).toBeUndefined();
    expect(requestInfo.getScriptContent).toBeUndefined();
    expect(requestInfo.scripts).toBeUndefined();
    expect(requestInfo.body.text).toBeUndefined(); // normalized into request-body.txt
  });

  it('emits secrets as plaintext JSON only when includeSecrets is set', async () => {
    const snapshot = makeCollectionSnapshot({
      variables: { secretVar: { value: 's3cr3t', secret: true } },
      environments: { dev: { variables: { envSecret: { value: 'env-s3cr3t', secret: true } } } },
    });
    const request = makeRequestSnapshot(snapshot.id, 'authorized', {
      auth: { type: AuthorizationType.BEARER, token: 'bearer-token' },
    });
    snapshot.children.push(request);

    const withSecrets = await collectEntries(snapshot, { includeSecrets: true });
    const collectionSecrets = JSON.parse(withSecrets['.secrets.bin']);
    expect(collectionSecrets.variables.secretVar.value).toBe('s3cr3t');
    expect(collectionSecrets.environments.dev.variables.envSecret.value).toBe('env-s3cr3t');
    const requestSecrets = JSON.parse(withSecrets['authorized/.secrets.bin']);
    expect(requestSecrets.auth.token).toBe('bearer-token');
    const requestInfo = JSON.parse(withSecrets['authorized/request.json']);
    expect(requestInfo.auth).toBeUndefined(); // auth lives only in the secrets entry

    const withoutSecrets = await collectEntries(snapshot);
    expect(Object.keys(withoutSecrets).some((name) => name.endsWith('.secrets.bin'))).toBe(false);
  });

  it('does not mutate the snapshot while serializing', async () => {
    const snapshot = makeCollectionSnapshot({
      variables: { secretVar: { value: 's3cr3t', secret: true } },
    });
    const request = makeRequestSnapshot(snapshot.id, 'req', {
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain', text: 'inline' },
      getBodyContent: async () => Readable.from(Buffer.from('inline')),
      auth: { type: AuthorizationType.BEARER, token: 'token' },
    });
    snapshot.children.push(request);

    await collectEntries(snapshot, { includeSecrets: true });

    expect(snapshot.variables.secretVar).toEqual({ value: 's3cr3t', secret: true });
    expect(request.auth).toEqual({ type: AuthorizationType.BEARER, token: 'token' });
    expect(request.body).toEqual({
      type: RequestBodyType.TEXT,
      mimeType: 'text/plain',
      text: 'inline',
    });
  });
});
