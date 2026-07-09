import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HistoryService } from './history-service';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { USER_DATA_DIR, exists } from 'main/util/fs-util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TrufosRequest, TrufosResponse, RequestMethod } from 'shim';
import type { Collection } from 'shim/objects/collection';

const testCollectionDir = path.join(USER_DATA_DIR, 'test-history-collection');

describe('HistoryService', () => {
  beforeEach(async () => {
    // Reset/Mock EnvironmentService collection dir
    const testCollection: Collection = {
      id: 'test-col-id',
      type: 'collection',
      title: 'Test Collection',
      dirPath: testCollectionDir,
      variables: {},
      environments: {},
      children: [],
    };
    (
      EnvironmentService.instance as unknown as { _currentCollection: Collection }
    )._currentCollection = testCollection;

    if (await exists(testCollectionDir)) {
      await fs.rm(testCollectionDir, { recursive: true, force: true });
    }
    await fs.mkdir(testCollectionDir, { recursive: true });
  });

  afterEach(async () => {
    if (await exists(testCollectionDir)) {
      await fs.rm(testCollectionDir, { recursive: true, force: true });
    }
  });

  it('records history entries and redacts sensitive headers', async () => {
    const request: TrufosRequest = {
      id: 'req-1',
      parentId: 'col-1',
      type: 'request',
      lastModified: Date.now(),
      title: 'My Request',
      url: { base: 'https://example.com/api', query: [] },
      method: RequestMethod.GET,
      headers: [
        { key: 'Content-Type', value: 'application/json', isActive: true },
        { key: 'Authorization', value: 'Bearer super-secret-token', isActive: true },
      ],
      body: { type: 'text', mimeType: 'application/json', text: 'hello body' },
    };

    const response: TrufosResponse = {
      type: 'response',
      metaInfo: {
        status: 200,
        duration: 120,
        size: { totalSizeInBytes: 150, headersSizeInBytes: 50, bodySizeInBytes: 100 },
      },
      headers: {},
      id: 'resp-1',
    };

    await HistoryService.instance.recordEntry(request, response);

    const entries = await HistoryService.instance.loadEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].request.method).toBe('GET');
    expect(entries[0].request.url).toBe('https://example.com/api');

    // Headers should have Authorization redacted, Content-Type kept
    const authHeader = entries[0].request.headers.find((h) => h.key === 'Authorization');
    expect(authHeader?.value).toBe('***REDACTED***');

    const typeHeader = entries[0].request.headers.find((h) => h.key === 'Content-Type');
    expect(typeHeader?.value).toBe('application/json');

    expect(entries[0].response.status).toBe(200);
    expect(entries[0].response.duration).toBe(120);
    expect(entries[0].response.size).toBe(150);
  });

  it('records error entries correctly', async () => {
    const request: TrufosRequest = {
      id: 'req-1',
      parentId: 'col-1',
      type: 'request',
      lastModified: Date.now(),
      title: 'My Request',
      url: { base: 'https://example.com/api', query: [] },
      method: RequestMethod.GET,
      headers: [],
      body: { type: 'text', mimeType: 'application/json', text: '' },
    };

    await HistoryService.instance.recordEntry(request, {
      error: 'Failed to connect',
      duration: 450,
    });

    const entries = await HistoryService.instance.loadEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].response.status).toBe(0);
    expect(entries[0].response.duration).toBe(450);
    expect(entries[0].response.error).toBe('Failed to connect');
  });

  it('enforces retention limit by keeping newest 100 entries', async () => {
    const request: TrufosRequest = {
      id: 'req-1',
      parentId: 'col-1',
      type: 'request',
      lastModified: Date.now(),
      title: 'My Request',
      url: { base: 'https://example.com/api', query: [] },
      method: RequestMethod.GET,
      headers: [],
      body: { type: 'text', mimeType: 'application/json', text: '' },
    };

    const response: TrufosResponse = {
      type: 'response',
      metaInfo: {
        status: 200,
        duration: 100,
        size: { totalSizeInBytes: 50, headersSizeInBytes: 0, bodySizeInBytes: 50 },
      },
      headers: {},
      id: 'resp-1',
    };

    // Record 105 entries
    for (let i = 0; i < 105; i++) {
      // Mock Date.now to increments to avoid exact collisions
      vi.spyOn(Date, 'now').mockReturnValue(1700000000000 + i * 10);
      await HistoryService.instance.recordEntry(request, response);
    }
    vi.spyOn(Date, 'now').mockRestore();

    const entries = await HistoryService.instance.loadEntries();
    expect(entries).toHaveLength(100);
    // Newest timestamp should be 1700000000000 + 1040
    expect(entries[0].timestamp).toBe(1700000000000 + 104 * 10);
  });

  it('clears history correctly', async () => {
    const request: TrufosRequest = {
      id: 'req-1',
      parentId: 'col-1',
      type: 'request',
      lastModified: Date.now(),
      title: 'My Request',
      url: { base: 'https://example.com/api', query: [] },
      method: RequestMethod.GET,
      headers: [],
      body: { type: 'text', mimeType: 'application/json', text: '' },
    };

    const response: TrufosResponse = {
      type: 'response',
      metaInfo: {
        status: 200,
        duration: 100,
        size: { totalSizeInBytes: 50, headersSizeInBytes: 0, bodySizeInBytes: 50 },
      },
      headers: {},
      id: 'resp-1',
    };

    await HistoryService.instance.recordEntry(request, response);
    let entries = await HistoryService.instance.loadEntries();
    expect(entries).toHaveLength(1);

    await HistoryService.instance.clearHistory();
    entries = await HistoryService.instance.loadEntries();
    expect(entries).toHaveLength(0);
  });
});
