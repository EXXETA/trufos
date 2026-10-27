import type { McpServer } from '@modelcontextprotocol/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  CollectionStateService,
  type CommandPlan,
} from 'main/collection-state/collection-state-service';
import {
  type CollectionModel,
  CommandType,
  getExistingRequest,
  newFolder,
  newRequest,
  type RequestChanges,
} from 'shim/collection-model';
import { AuthorizationInformation } from 'shim/objects/auth';
import { TrufosHeader } from 'shim/objects/headers';
import { TrufosId } from 'shim/objects/id';
import { FileBody, FormDataBody, NoBody, RequestBodyType, TextBody } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { parseUrl } from 'shim/objects/url';
import { ScriptType } from 'shim/scripting';
import { hasMaskedCredential, MASK } from '../redaction';
import { AbsolutePath, jsonResult, RequestIdInput } from './shared';

/*
 * The commands validate themselves when they are applied, e.g. that a request or a parent exists,
 * so these tools only build them. A command that cannot be applied fails the tool call with the
 * reason.
 */

const collectionState = CollectionStateService.instance;

const EDIT = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DESTRUCTIVE = { ...EDIT, destructiveHint: true } as const;

const DRAFT_NOTE =
  'The change is a draft, like an unsaved edit in the app, until `save_request` saves it.';

const ParentIdInput = TrufosId.optional().describe(
  'The ID of a folder, or of the collection. Defaults to the top level of the collection.'
);
const IndexInput = z
  .int()
  .nonnegative()
  .optional()
  .describe('The position among the children of the parent. Defaults to the end.');

/** A request body as a client sets it. A text body's text is set with `edit_request_body`. */
const BodyInput = z.discriminatedUnion('type', [
  NoBody,
  TextBody.omit({ text: true }),
  FileBody.extend({
    filePath: AbsolutePath.describe('The absolute path of the file that is sent as the body.'),
  }),
  FormDataBody,
]);

/**
 * Applies a command planned from the open collection, see {@link CollectionStateService.applyTo}.
 * @param plan plans the command
 * @returns the model after the command was applied
 */
function apply(plan: CommandPlan): Promise<CollectionModel> {
  return collectionState.applyTo(collectionState.model.collection.id, plan);
}

/** Rejects an authorization that contains a credential masked by `get_request`. */
function assertNoMaskedCredentials(auth: AuthorizationInformation | null | undefined) {
  if (auth != null && hasMaskedCredential(auth)) {
    throw new Error(
      `The authorization contains the masked value ${MASK}. Pass the real value or a ` +
        '`{{variable}}` instead.'
    );
  }
}

/**
 * Registers the tools of the `edit` permission. Every change is a command of the open collection,
 * so it is persisted and shown in the app like an edit of the user.
 * @param server the server to register the tools with
 */
export function registerEditTools(server: McpServer): void {
  server.registerTool(
    'create_request',
    {
      description: `Creates a request in the open collection. ${DRAFT_NOTE}`,
      inputSchema: z.object({
        title: z.string().min(1),
        parentId: ParentIdInput,
        method: z.enum(RequestMethod).optional(),
        url: z.string().optional(),
        index: IndexInput,
      }),
      annotations: EDIT,
    },
    async ({ parentId, index, ...fields }) => {
      const id = randomUUID();
      await apply((model) => ({
        type: CommandType.CREATE_REQUEST,
        request: newRequest({ id, parentId: parentId ?? model.collection.id, ...fields }),
        index,
      }));
      return jsonResult({ id });
    }
  );

  server.registerTool(
    'create_folder',
    {
      description: 'Creates a folder in the open collection.',
      inputSchema: z.object({
        title: z.string().min(1),
        parentId: ParentIdInput,
        index: IndexInput,
      }),
      annotations: EDIT,
    },
    async ({ title, parentId, index }) => {
      const id = randomUUID();
      await apply((model) => ({
        type: CommandType.CREATE_FOLDER,
        folder: newFolder({ id, parentId: parentId ?? model.collection.id, title }),
        index,
      }));
      return jsonResult({ id });
    }
  );

  server.registerTool(
    'update_request',
    {
      description:
        'Changes the URL, method, headers, body type or authorization of a request. Omitted ' +
        'fields stay as they are. The text of a text body is set with `edit_request_body`; a ' +
        'large body can be sent from a file with a body of type `file`. Values can use ' +
        `\`{{variables}}\`. ${DRAFT_NOTE}`,
      inputSchema: z.object({
        requestId: RequestIdInput,
        url: z.string().optional().describe('The URL including the query string.'),
        method: z.enum(RequestMethod).optional(),
        headers: TrufosHeader.array().optional().describe('Replaces all headers of the request.'),
        disabledHeaders: z
          .string()
          .array()
          .nullable()
          .optional()
          .describe('The keys of automatic and inherited headers not to send. `null` sends all.'),
        body: BodyInput.optional(),
        auth: AuthorizationInformation.nullable()
          .optional()
          .describe('`null` removes the authorization, type `inherit` inherits it.'),
      }),
      annotations: EDIT,
    },
    async ({ requestId, url, ...rest }) => {
      assertNoMaskedCredentials(rest.auth);
      const changes: RequestChanges = { ...rest, url: url != null ? parseUrl(url) : undefined };
      await apply(() => ({ type: CommandType.EDIT_REQUEST, id: requestId, changes }));
      return jsonResult({ updated: requestId });
    }
  );

  server.registerTool(
    'edit_request_body',
    {
      description:
        'Replaces the text of the text body of a request. The request needs a body of type ' +
        `\`text\`, see \`update_request\`. ${DRAFT_NOTE}`,
      inputSchema: z.object({ requestId: RequestIdInput, text: z.string() }),
      annotations: EDIT,
    },
    async ({ requestId, text }) => {
      await apply((model) => {
        // the command itself allows any body type, as the editor of the app may still send the
        // text after the user chose another type; a client would set a text it cannot send
        const { body } = getExistingRequest(model, requestId);
        if (body.type !== RequestBodyType.TEXT) {
          throw new Error(
            `The body of the request has the type ${body.type}. Change it to \`text\` with ` +
              '`update_request` first.'
          );
        }
        return { type: CommandType.SET_TEXT_BODY, id: requestId, text };
      });
      return jsonResult({ updated: requestId });
    }
  );

  server.registerTool(
    'edit_request_script',
    {
      description:
        'Replaces the pre-request or post-response script of a request. Scripts run when the ' +
        `request is sent. An empty script removes it. ${DRAFT_NOTE}`,
      inputSchema: z.object({
        requestId: RequestIdInput,
        scriptType: z.enum(ScriptType),
        text: z.string(),
      }),
      annotations: EDIT,
    },
    async ({ requestId, scriptType, text }) => {
      await apply(() => ({ type: CommandType.SET_SCRIPT, id: requestId, scriptType, text }));
      return jsonResult({ updated: requestId });
    }
  );

  server.registerTool(
    'rename',
    {
      description: 'Renames a request or folder of the open collection.',
      inputSchema: z.object({ id: TrufosId, title: z.string().min(1) }),
      annotations: EDIT,
    },
    async ({ id, title }) => {
      await apply(() => ({ type: CommandType.RENAME, id, title }));
      return jsonResult({ renamed: id });
    }
  );

  server.registerTool(
    'move',
    {
      description:
        'Moves requests and folders, in the given order, into a folder. None of them may be ' +
        'inside another one that is moved.',
      inputSchema: z.object({
        ids: TrufosId.array().min(1),
        parentId: ParentIdInput,
        index: IndexInput,
      }),
      annotations: EDIT,
    },
    async ({ ids, parentId, index }) => {
      await apply((model) => ({
        type: CommandType.MOVE,
        ids,
        parentId: parentId ?? model.collection.id,
        index,
      }));
      return jsonResult({ moved: ids });
    }
  );

  server.registerTool(
    'delete',
    {
      description:
        'Deletes requests and folders of the open collection, folders with everything inside ' +
        'them. None of them may be inside another one that is deleted.',
      inputSchema: z.object({ ids: TrufosId.array().min(1) }),
      annotations: DESTRUCTIVE,
    },
    async ({ ids }) => {
      await apply(() => ({ type: CommandType.DELETE, ids }));
      return jsonResult({ deleted: ids });
    }
  );

  server.registerTool(
    'save_request',
    {
      description: 'Saves the draft of a request, i.e. its unsaved changes, to the collection.',
      inputSchema: z.object({ requestId: RequestIdInput }),
      annotations: EDIT,
    },
    async ({ requestId }) => {
      await apply(() => ({ type: CommandType.SAVE_REQUEST, id: requestId }));
      return jsonResult({ saved: requestId });
    }
  );

  server.registerTool(
    'discard_request',
    {
      description:
        'Discards the unsaved changes of a request. A request that was never saved is deleted.',
      inputSchema: z.object({ requestId: RequestIdInput }),
      annotations: DESTRUCTIVE,
    },
    async ({ requestId }) => {
      await apply(() => ({ type: CommandType.DISCARD_REQUEST, id: requestId }));
      return jsonResult({ discarded: requestId });
    }
  );

  server.registerTool(
    'select_environment',
    {
      description:
        'Selects the environment whose variables requests are sent with, also in the app.',
      inputSchema: z.object({
        environment: z.string().nullable().describe('The key of an environment, `null` for none.'),
      }),
      annotations: EDIT,
    },
    async ({ environment }) => {
      await apply(() => ({
        type: CommandType.UPDATE_COLLECTION,
        changes: {},
        selectedEnvironmentKey: environment,
      }));
      return jsonResult({ selectedEnvironment: environment });
    }
  );
}
