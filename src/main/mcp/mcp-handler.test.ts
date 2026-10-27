import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { McpHttpHandler } from '@modelcontextprotocol/server';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { HistoryService } from 'main/history/history-service';
import { BodyStore } from 'main/network/service/body-store';
import { HttpService } from 'main/network/service/http-service';
import { LatestResponseBodies } from 'main/network/service/latest-response-bodies';
import { DEFAULT_APP_SETTINGS } from 'shim/app-settings';
import {
  type CollectionCommand,
  applyCommandWithPatches,
  type CollectionModel,
  CommandType,
  normalizeCollection,
} from 'shim/collection-model';
import { type HistoryEntry, summarizeHistoryEntry } from 'shim/history';
import type { McpPermissions } from 'shim/mcp';
import { AuthorizationType } from 'shim/objects/auth';
import { RequestBodyType } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { ScriptType } from 'shim/scripting';
import type { TrufosResponse } from 'shim/objects/response';
import { makeCollection, makeFolder, makeRequest } from 'shim/__mocks__/collection-fixtures';
import { createTrufosMcpHandler } from './mcp-handler';
import type { BodyPage } from './body-pages';
import type { RequestDescription, TreeEntry } from './collection-views';
import { MASK, type MaskedVariable } from './redaction';

const collectionState = CollectionStateService.instance;

interface VariablesResult {
  environment: string | null;
  environmentVariables: MaskedVariable[];
  collectionVariables: MaskedVariable[];
}

interface HistoryEntryResult {
  url: string;
  request: { headers: Record<string, string>; body?: unknown; bodySize?: number };
  scriptLogs: { args: unknown[] }[];
}
const bodyStore = BodyStore.instance;

const ALL_PERMISSIONS: McpPermissions = {
  read: true,
  execute: true,
  edit: true,
  writeFiles: true,
};

/**
 * col
 * ├── Users (folder)
 * │   ├── List users  GET  {{baseUrl}}/users   bearer auth with a token
 * │   └── Admin (folder)
 * │       └── Delete user  DELETE  {{baseUrl}}/users/1
 * └── Health  GET  http://localhost/health  (no body)
 */
function createModel(): CollectionModel {
  return normalizeCollection(
    makeCollection(
      'col',
      [
        makeFolder('users', 'col', [
          makeRequest('list', 'users', {
            title: 'List users',
            url: { base: '{{baseUrl}}/users', query: [] },
            auth: { type: AuthorizationType.BEARER, token: 'super-secret-token' },
          }),
          {
            ...makeFolder('admin', 'users', [
              makeRequest('delete', 'admin', {
                title: 'Delete user',
                method: RequestMethod.DELETE,
                url: { base: '{{baseUrl}}/users/1', query: [] },
              }),
            ]),
            title: 'Admin',
          },
        ]),
        makeRequest('health', 'col', {
          title: 'Health',
          url: { base: 'http://localhost/health', query: [] },
          body: { type: RequestBodyType.NONE },
        }),
      ],
      {
        variables: {
          baseUrl: { value: 'https://api.example.com' },
          apiKey: { value: 'secret-api-key', secret: true },
        },
        environments: { dev: { variables: { baseUrl: { value: 'http://localhost:8080' } } } },
      }
    )
  );
}

/** Stores a body in the body store, so tools can read it. */
async function storeBody(content: string): Promise<string> {
  const { id, stream } = bodyStore.create({ 'content-type': 'text/plain' });
  await pipeline(Readable.from([content]), stream);
  return id;
}

describe('createTrufosMcpHandler', () => {
  let model: CollectionModel;
  let permissions: McpPermissions;
  let commands: CollectionCommand[];
  const notifier = { responseReceived: vi.fn(), showRequest: vi.fn() };
  let handler: McpHttpHandler;
  let nextId = 1;

  /** Sends a JSON-RPC request the way a client of the 2025 protocol revisions does. */
  async function rpc(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const response = await handler.fetch(
      new Request('http://127.0.0.1:7357/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-06-18',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
      })
    );
    const body = await response.text();
    // the response is a single JSON message or an SSE stream of them
    const json = body.startsWith('{')
      ? body
      : body
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice('data:'.length))
          .join('');
    const message: { result?: unknown; error?: { message: string } } = JSON.parse(json);
    if (message.error != null) throw new Error(message.error.message);
    return message.result;
  }

  async function listTools(): Promise<string[]> {
    const result = (await rpc('tools/list')) as { tools: { name: string }[] };
    return result.tools.map((tool) => tool.name);
  }

  /** Calls a tool and returns its JSON result. Rejects with the message of an error result. */
  async function callTool<T = unknown>(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    const result = (await rpc('tools/call', { name, arguments: args })) as {
      content: { type: string; text: string }[];
      isError?: boolean;
    };
    const text = result.content[0]?.text ?? '';
    if (result.isError === true) throw new Error(text);
    return JSON.parse(text);
  }

  beforeEach(() => {
    model = createModel();
    permissions = { ...ALL_PERMISSIONS };
    commands = [];
    vi.spyOn(collectionState, 'model', 'get').mockImplementation(() => model);
    vi.spyOn(collectionState, 'read').mockImplementation(async (reader) => await reader(model));
    // commands are validated and applied like in the app, but not persisted
    vi.spyOn(collectionState, 'applyTo').mockImplementation(async (_collectionId, plan) => {
      const command = plan(model);
      if (command == null) return model;
      [model] = applyCommandWithPatches(model, { commandId: 'id', timestamp: 0, command });
      commands.push(command);
      return model;
    });
    handler = createTrufosMcpHandler(() => permissions, notifier);
  });

  afterEach(async () => {
    await handler.close();
    vi.restoreAllMocks();
  });

  describe('permissions', () => {
    it('should only offer the read tools by default', async () => {
      permissions = { ...DEFAULT_APP_SETTINGS.mcpServer.permissions };

      const tools = await listTools();

      expect(tools).toEqual(expect.arrayContaining(['search', 'get_request', 'open_request']));
      expect(tools).not.toContain('send_request');
      expect(tools).not.toContain('update_request');
      expect(tools).not.toContain('save_response_body');
    });

    it('should offer the tools of every permitted permission', async () => {
      const tools = await listTools();

      expect(tools).toEqual(
        expect.arrayContaining(['search', 'send_request', 'update_request', 'save_response_body'])
      );
    });

    it('should offer the tools of the permissions at the time of the request', async () => {
      permissions = { ...ALL_PERMISSIONS, execute: false };
      expect(await listTools()).not.toContain('send_request');

      permissions = { ...ALL_PERMISSIONS };
      expect(await listTools()).toContain('send_request');
    });

    it('should reject calls of tools that are not permitted', async () => {
      permissions = { ...ALL_PERMISSIONS, edit: false };

      await expect(callTool('delete', { ids: ['health'] })).rejects.toThrow();
      expect(commands).toEqual([]);
    });
  });

  describe('read', () => {
    it('should find requests by all words of the query, with their folder path', async () => {
      const results = await callTool('search', { query: 'delete USERS' });

      expect(results).toEqual([
        {
          type: 'request',
          id: 'delete',
          title: 'Delete user',
          method: RequestMethod.DELETE,
          url: '{{baseUrl}}/users/1',
          folderPath: 'users / Admin',
        },
      ]);
    });

    it('should list the recently opened collections', async () => {
      const collections = [{ id: 'col', title: 'Test', dirPath: '/col' }];
      vi.spyOn(collectionState, 'listCollections').mockResolvedValue(collections);

      await expect(callTool('list_collections')).resolves.toEqual(collections);
    });

    it('should return the tree of the open collection', async () => {
      const collection = await callTool<{ environments: string[]; tree: TreeEntry[] }>(
        'get_collection'
      );

      expect(collection.environments).toEqual(['dev']);
      expect(collection.tree.map((entry: { id: string }) => entry.id)).toEqual(['users', 'health']);
    });

    it('should mask the credentials of a request', async () => {
      const request = await callTool<RequestDescription>('get_request', { requestId: 'list' });

      expect(request.auth).toEqual({ type: AuthorizationType.BEARER, token: MASK });
      expect(JSON.stringify(request)).not.toContain('super-secret-token');
    });

    it('should fail for a request the open collection does not have', async () => {
      await expect(callTool('get_request', { requestId: 'missing' })).rejects.toThrow(
        'Request missing does not exist'
      );
    });

    it('should mask the values of secret variables', async () => {
      const variables = await callTool<VariablesResult>('get_variables');

      expect(variables.collectionVariables).toEqual(
        expect.arrayContaining([
          { key: 'apiKey', value: MASK, secret: true },
          { key: 'baseUrl', value: 'https://api.example.com' },
        ])
      );
    });

    it('should return the variables of the given environment', async () => {
      const variables = await callTool<VariablesResult>('get_variables', { environment: 'dev' });

      expect(variables.environment).toBe('dev');
      expect(variables.environmentVariables).toEqual([
        { key: 'baseUrl', value: 'http://localhost:8080' },
      ]);
    });

    it('should show a request in the app', async () => {
      await callTool('open_request', { requestId: 'health' });

      expect(notifier.showRequest).toHaveBeenCalledWith('health');
    });

    it('should not show a request the open collection does not have', async () => {
      await expect(callTool('open_request', { requestId: 'missing' })).rejects.toThrow();
      expect(notifier.showRequest).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    function recordEntry(): HistoryEntry {
      const entry: HistoryEntry = {
        id: 'entry',
        requestId: 'list',
        requestTitle: 'List users',
        timestamp: 0,
        method: RequestMethod.GET,
        url: 'https://api.example.com/users?key=secret-api-key',
        request: {
          method: 'GET',
          url: 'https://api.example.com/users?key=secret-api-key',
          headers: { Authorization: 'Bearer super-secret-token', 'x-api-key': 'secret-api-key' },
          body: { id: 'request-body', size: 4 },
        },
        outcome: { type: 'aborted' },
        scriptLogs: [
          { script: ScriptType.PRE_REQUEST, level: 'info', args: ['key secret-api-key', 1] },
        ],
      };
      vi.spyOn(HistoryService.instance, 'list').mockReturnValue([summarizeHistoryEntry(entry)]);
      vi.spyOn(HistoryService.instance, 'get').mockReturnValue(entry);
      return entry;
    }

    it('should mask secrets in the requests of the history', async () => {
      recordEntry();

      const entry = await callTool<HistoryEntryResult>('get_history_entry', { entryId: 'entry' });
      const summaries = await callTool('get_history');

      expect(entry.url).toBe(`https://api.example.com/users?key=${MASK}`);
      expect(entry.request.headers).toEqual({ Authorization: MASK, 'x-api-key': MASK });
      expect(entry.request.body).toBeUndefined();
      expect(entry.request.bodySize).toBe(4);
      expect(entry.scriptLogs[0].args).toEqual([`key ${MASK}`, 1]);
      expect(JSON.stringify([entry, summaries])).not.toMatch(/super-secret-token|secret-api-key/);
    });

    it('should not return entries of other collections', async () => {
      const get = vi.spyOn(HistoryService.instance, 'get').mockReturnValue(undefined);

      await expect(callTool('get_history_entry', { entryId: 'entry' })).rejects.toThrow();
      expect(get).toHaveBeenCalledWith('entry', '/col');
    });
  });

  describe('response bodies', () => {
    it('should read a response body page by page', async () => {
      const bodyId = await storeBody('0123456789');
      vi.spyOn(LatestResponseBodies.instance, 'has').mockReturnValue(true);

      const first = await callTool<BodyPage>('read_response_body', { bodyId, length: 4 });
      const last = await callTool('read_response_body', { bodyId, offset: first.nextOffset });

      expect(first).toEqual({ text: '0123', offset: 0, nextOffset: 4, totalSize: 10 });
      expect(last).toEqual({ text: '456789', offset: 4, nextOffset: null, totalSize: 10 });
    });

    it('should not read bodies that are no response bodies', async () => {
      const bodyId = await storeBody('request body');

      await expect(callTool('read_response_body', { bodyId })).rejects.toThrow('not available');
    });

    it('should save a response body to a new file only', async () => {
      const bodyId = await storeBody('saved');
      vi.spyOn(HistoryService.instance, 'hasResponseBody').mockReturnValue(true);
      const target = path.join(tmpdir(), 'response.txt');

      await expect(callTool('save_response_body', { bodyId, path: target })).resolves.toEqual({
        path: target,
        size: 5,
      });
      expect(fs.readFileSync(target, 'utf8')).toBe('saved');
      await expect(callTool('save_response_body', { bodyId, path: target })).rejects.toThrow(
        'exists already'
      );
      await expect(
        callTool('save_response_body', { bodyId, path: 'relative.txt' })
      ).rejects.toThrow();
    });
  });

  describe('execute', () => {
    it('should send a request, show its response and preview the body', async () => {
      const bodyId = await storeBody('{"users":[]}');
      // the app keeps the latest response of a request
      vi.spyOn(LatestResponseBodies.instance, 'has').mockReturnValue(true);
      const response: TrufosResponse = {
        type: 'response',
        headers: { 'content-type': 'application/json' },
        metaInfo: {
          status: 200,
          duration: 12,
          size: { totalSizeInBytes: 40, headersSizeInBytes: 28, bodySizeInBytes: 12 },
        },
        body: { id: bodyId, size: 12 },
      };
      const sendRequest = vi.spyOn(HttpService.instance, 'sendRequest').mockResolvedValue(response);

      const result = await callTool('send_request', { requestId: 'list' });

      expect(sendRequest).toHaveBeenCalledWith('list', expect.any(String));
      expect(notifier.responseReceived).toHaveBeenCalledWith('list', response);
      expect(result).toMatchObject({
        status: 200,
        contentType: 'application/json',
        bodyId,
        preview: '{"users":[]}',
        previewIsComplete: true,
      });
    });

    it('should report an aborted request', async () => {
      vi.spyOn(HttpService.instance, 'sendRequest').mockResolvedValue(null);

      await expect(callTool('send_request', { requestId: 'list' })).resolves.toEqual({
        aborted: true,
      });
      expect(notifier.responseReceived).not.toHaveBeenCalled();
    });

    it('should report why sending failed', async () => {
      vi.spyOn(HttpService.instance, 'sendRequest').mockRejectedValue(
        new Error('Connection refused')
      );

      await expect(callTool('send_request', { requestId: 'list' })).rejects.toThrow(
        'Connection refused'
      );
    });
  });

  describe('edit', () => {
    it('should create a draft request at the top level by default', async () => {
      const { id } = await callTool<{ id: string }>('create_request', {
        title: 'New',
        url: 'http://x?a=1',
      });

      expect(commands).toEqual([
        {
          type: CommandType.CREATE_REQUEST,
          index: undefined,
          request: expect.objectContaining({
            id,
            parentId: 'col',
            title: 'New',
            method: RequestMethod.GET,
            url: { base: 'http://x', query: [{ key: 'a', value: '1', isActive: true }] },
            draft: true,
          }),
        },
      ]);
    });

    it('should not create a request in a parent that does not exist', async () => {
      await expect(callTool('create_request', { title: 'New', parentId: 'list' })).rejects.toThrow(
        'Parent list does not exist'
      );
      expect(commands).toEqual([]);
    });

    it('should change a request', async () => {
      await callTool('update_request', {
        requestId: 'list',
        url: 'https://example.com/a?b=c',
        method: RequestMethod.POST,
        body: { type: RequestBodyType.TEXT, mimeType: 'application/json' },
      });

      expect(commands).toEqual([
        {
          type: CommandType.EDIT_REQUEST,
          id: 'list',
          changes: {
            url: {
              base: 'https://example.com/a',
              query: [{ key: 'b', value: 'c', isActive: true }],
            },
            method: RequestMethod.POST,
            body: { type: RequestBodyType.TEXT, mimeType: 'application/json' },
          },
        },
      ]);
    });

    it('should not store a masked credential', async () => {
      await expect(
        callTool('update_request', {
          requestId: 'list',
          auth: { type: AuthorizationType.BEARER, token: MASK },
        })
      ).rejects.toThrow('masked');
      expect(commands).toEqual([]);
    });

    it('should only edit text bodies', async () => {
      await callTool('edit_request_body', { requestId: 'list', text: '{}' });
      await expect(
        callTool('edit_request_body', { requestId: 'health', text: '{}' })
      ).rejects.toThrow('update_request');

      expect(commands).toEqual([{ type: CommandType.SET_TEXT_BODY, id: 'list', text: '{}' }]);
    });

    it('should move items to the end of a folder by default', async () => {
      await callTool('move', { ids: ['health'], parentId: 'users' });

      expect(model.childIds.get('users')).toEqual(['list', 'admin', 'health']);
    });

    it('should delete folders with their content', async () => {
      await callTool('delete', { ids: ['users'] });

      expect(model.requests.has('delete')).toBe(false);
      expect(model.childIds.get('col')).toEqual(['health']);
    });

    it('should report why a command cannot be applied', async () => {
      await expect(callTool('delete', { ids: ['users', 'delete'] })).rejects.toThrow(
        'descendant of another'
      );
      expect(commands).toEqual([]);
    });

    it('should select an environment that exists', async () => {
      await callTool('select_environment', { environment: 'dev' });
      await expect(callTool('select_environment', { environment: 'prod' })).rejects.toThrow();

      expect(commands).toEqual([
        { type: CommandType.UPDATE_COLLECTION, changes: {}, selectedEnvironmentKey: 'dev' },
      ]);
    });
  });
});
