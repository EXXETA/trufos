import type { McpServer } from '@modelcontextprotocol/server';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { z } from 'zod';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { getSystemVariables } from 'main/environment/service/system-variable';
import { HistoryService } from 'main/history/history-service';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { getExistingRequest } from 'shim/collection-model';
import { MAX_HISTORY_ENTRIES } from 'shim/history';
import { RequestBodyType } from 'shim/objects/request';
import { ScriptType } from 'shim/scripting';
import { PageInput, readPage } from '../body-pages';
import { describeRequest, describeTree, searchCollection } from '../collection-views';
import { collectSecrets, maskVariables, redactHistoryEntry, redactUrl } from '../redaction';
import { jsonResult, type McpUiNotifier, readResponseBodyPage, RequestIdInput } from './shared';

const collectionState = CollectionStateService.instance;
const historyService = HistoryService.instance;
const persistenceService = PersistenceService.instance;

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/**
 * Registers the tools of the `read` permission: finding and reading the open collection, its
 * environments, the history and response bodies, and showing a request in the app.
 * @param server the server to register the tools with
 * @param notifier shows a request in the app
 */
export function registerReadTools(server: McpServer, notifier: McpUiNotifier): void {
  server.registerTool(
    'list_collections',
    {
      description:
        'Lists the recently opened collections of Trufos. All other tools act on the open ' +
        'collection, see `get_collection`; only the user can open another one.',
      annotations: READ_ONLY,
    },
    async () => jsonResult(await collectionState.listCollections())
  );

  server.registerTool(
    'get_collection',
    {
      description:
        'Returns the open collection: its folders and requests as a tree, its environments and ' +
        'the selected environment. Use `search` to find a request by name or URL.',
      annotations: READ_ONLY,
    },
    async () =>
      jsonResult(
        await collectionState.read((model) => ({
          id: model.collection.id,
          title: model.collection.title,
          dirPath: model.collection.dirPath,
          environments: Object.keys(model.collection.environments),
          selectedEnvironment: model.selectedEnvironmentKey ?? null,
          tree: describeTree(model),
        }))
      )
  );

  server.registerTool(
    'search',
    {
      description:
        'Finds the requests and folders of the open collection whose title, URL or method contain ' +
        'all words of the query, ignoring case. URLs are searched as stored, with their ' +
        '`{{variables}}`. Bodies and scripts are not searched.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Words to search for, separated by spaces.'),
        limit: z.int().min(1).max(200).default(50).describe('The maximum number of results.'),
      }),
      annotations: READ_ONLY,
    },
    async ({ query, limit }) =>
      jsonResult(await collectionState.read((model) => searchCollection(model, query, limit)))
  );

  server.registerTool(
    'get_request',
    {
      description:
        'Returns a request of the open collection: method, URL, headers, body type and ' +
        'authorization, with credentials masked. Unsaved changes (drafts) are included. The text ' +
        'body and scripts are read with `get_request_body` and `get_request_script`.',
      inputSchema: z.object({ requestId: RequestIdInput }),
      annotations: READ_ONLY,
    },
    async ({ requestId }) =>
      jsonResult(
        await collectionState.read((model) =>
          describeRequest(model, getExistingRequest(model, requestId))
        )
      )
  );

  server.registerTool(
    'get_request_body',
    {
      description:
        'Reads a page of the text body of a request, decoded as UTF-8. Read the next page from ' +
        '`nextOffset` until it is null.',
      inputSchema: z.object({ requestId: RequestIdInput, ...PageInput }),
      annotations: READ_ONLY,
    },
    async ({ requestId, offset, length }) =>
      jsonResult(
        await collectionState.readExistingRequest(requestId, async (request) => {
          if (request.body.type !== RequestBodyType.TEXT) {
            throw new Error(`The request has no text body, its body type is ${request.body.type}.`);
          }
          const totalSize = await persistenceService.getTextBodySize(request);
          const range = { start: offset, end: offset + length - 1 };
          // a text body that was never written is empty
          const page =
            (await persistenceService.loadTextBodyOfRequest(request, undefined, range)) ??
            Readable.from([]);
          return await readPage(page, offset, totalSize);
        })
      )
  );

  server.registerTool(
    'get_request_script',
    {
      description:
        'Reads the pre-request or post-response script of a request. It is empty if the request ' +
        'has no such script.',
      inputSchema: z.object({ requestId: RequestIdInput, scriptType: z.enum(ScriptType) }),
      annotations: READ_ONLY,
    },
    async ({ requestId, scriptType }) => {
      const script = await collectionState.readExistingRequest(requestId, async (request) => {
        const stream = await persistenceService.loadScript(request, scriptType);
        return stream == null ? '' : await text(stream);
      });
      return jsonResult({ requestId, scriptType, script });
    }
  );

  server.registerTool(
    'list_environments',
    {
      description:
        'Lists the environments of the open collection with the keys of their variables, and ' +
        'which environment is selected.',
      annotations: READ_ONLY,
    },
    async () =>
      jsonResult(
        await collectionState.read(({ collection, selectedEnvironmentKey }) => ({
          selectedEnvironment: selectedEnvironmentKey ?? null,
          environments: Object.entries(collection.environments).map(([key, environment]) => ({
            key,
            variables: Object.keys(environment.variables),
          })),
        }))
      )
  );

  server.registerTool(
    'get_variables',
    {
      description:
        'Returns the variables requests can use as `{{key}}`: those of an environment, of the ' +
        'collection and the system variables. An environment variable overrides a collection ' +
        'variable with the same key. Values of secret variables are masked.',
      inputSchema: z.object({
        environment: z
          .string()
          .optional()
          .describe('The key of an environment. Defaults to the selected environment.'),
      }),
      annotations: READ_ONLY,
    },
    async ({ environment }) =>
      jsonResult(
        await collectionState.read(({ collection, selectedEnvironmentKey }) => {
          const key = environment ?? selectedEnvironmentKey;
          const selected = key != null ? collection.environments[key] : undefined;
          if (environment != null && selected == null) {
            throw new Error(`The open collection has no environment ${environment}.`);
          }
          return {
            environment: selected != null ? key : null,
            environmentVariables: maskVariables(Object.entries(selected?.variables ?? {})),
            collectionVariables: maskVariables(Object.entries(collection.variables)),
            systemVariables: maskVariables(getSystemVariables()),
          };
        })
      )
  );

  server.registerTool(
    'get_history',
    {
      description:
        'Lists the requests sent in this session for the open collection, newest first. Use ' +
        '`get_history_entry` for headers and the response body.',
      inputSchema: z.object({
        limit: z.int().min(1).max(MAX_HISTORY_ENTRIES).default(20),
      }),
      annotations: READ_ONLY,
    },
    async ({ limit }) =>
      jsonResult(
        await collectionState.read((model) => {
          const secrets = collectSecrets(model);
          return historyService
            .list(model.collection.dirPath)
            .slice(0, limit)
            .map((summary) => ({ ...summary, url: redactUrl(summary.url, secrets) }));
        })
      )
  );

  server.registerTool(
    'get_history_entry',
    {
      description:
        'Returns a request of the history as it was sent, with variables resolved and secrets ' +
        'masked, its outcome with the response and the ID of its body (`outcome.response.body.id`), ' +
        'and the script output.',
      inputSchema: z.object({ entryId: z.string().describe('The ID from `get_history`.') }),
      annotations: READ_ONLY,
    },
    async ({ entryId }) =>
      jsonResult(
        await collectionState.read((model) => {
          const entry = historyService.get(entryId, model.collection.dirPath);
          if (entry == null) {
            throw new Error(
              `The history of the open collection has no entry with the ID ${entryId}.`
            );
          }

          const { request, ...redacted } = redactHistoryEntry(entry, collectSecrets(model));
          return {
            ...redacted,
            // the body of the sent request is not offered, only its size
            request: request && { ...request, body: undefined, bodySize: request.body?.size },
          };
        })
      )
  );

  server.registerTool(
    'read_response_body',
    {
      description:
        'Reads a page of a response body, decoded as UTF-8. Read the next page from ' +
        '`nextOffset` until it is null. Bodies are kept while the history or the latest response ' +
        'of a request holds them.',
      inputSchema: z.object({
        bodyId: z.string().describe('The `bodyId` of a response.'),
        ...PageInput,
      }),
      annotations: READ_ONLY,
    },
    async ({ bodyId, offset, length }) =>
      jsonResult(await readResponseBodyPage(bodyId, offset, length))
  );

  server.registerTool(
    'open_request',
    {
      description:
        'Shows a request in Trufos, as if the user selected it in the sidebar, e.g. to point the ' +
        'user to it. Changes no data.',
      inputSchema: z.object({ requestId: RequestIdInput }),
      annotations: { ...READ_ONLY, idempotentHint: true },
    },
    async ({ requestId }) => {
      await collectionState.read((model) => getExistingRequest(model, requestId));
      notifier.showRequest(requestId);
      return jsonResult({ shown: requestId });
    }
  );
}
