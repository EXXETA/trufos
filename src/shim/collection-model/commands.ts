import { z } from 'zod';
import { AuthorizationInformation, AuthorizationInformationNoInherit } from '../objects/auth';
import { ClientCertificate, Collection } from '../objects/collection';
import { TrufosRequest } from '../objects/request';
import { ScriptType } from '../scripting';
import { TrufosId } from '../objects/id';
import { FolderInfo } from './model';

const Index = z.int().nonnegative();

/**
 * The IDs of the folders and requests a bulk command acts on. None of them may be a descendant of
 * another, as acting on a folder already covers its descendants.
 */
const TopLevelIds = z.array(TrufosId).min(1);

/** The fields of a request that can be edited. `auth: null` removes the authorization. */
export const RequestChanges = z
  .object({
    ...TrufosRequest.pick({ url: true, method: true, headers: true, body: true }).shape,
    auth: AuthorizationInformation.nullable(),
  })
  .partial();
export type RequestChanges = z.infer<typeof RequestChanges>;

/**
 * The settings of a collection that can be changed. `null` removes the client certificate or the
 * authorization.
 */
export const CollectionChanges = z
  .object({
    ...Collection.pick({ title: true, variables: true, environments: true }).shape,
    clientCertificate: ClientCertificate.nullable(),
    auth: AuthorizationInformationNoInherit.nullable(),
  })
  .partial();
export type CollectionChanges = z.infer<typeof CollectionChanges>;

/** The type of a {@link CollectionCommand}. */
export enum CommandType {
  CREATE_REQUEST = 'createRequest',
  CREATE_FOLDER = 'createFolder',
  RENAME = 'rename',
  MOVE = 'move',
  DELETE = 'delete',
  COPY = 'copy',
  CREATE_DRAFT = 'createDraft',
  EDIT_REQUEST = 'editRequest',
  SET_TEXT_BODY = 'setTextBody',
  SET_SCRIPT = 'setScript',
  SAVE_REQUEST = 'saveRequest',
  DISCARD_REQUEST = 'discardRequest',
  UPDATE_COLLECTION = 'updateCollection',
}

/**
 * Every change the renderer or a main process service can make to the open collection. Commands
 * are applied by {@link applyCommand} in both processes, so anything non-deterministic (new IDs,
 * timestamps) must be part of the command.
 */
export const CollectionCommand = z.discriminatedUnion('type', [
  /** Creates a request. New requests usually are drafts that were never saved. */
  z.object({
    type: z.literal(CommandType.CREATE_REQUEST),
    request: TrufosRequest,
    index: Index.optional(),
  }),
  /** Creates an empty folder. */
  z.object({
    type: z.literal(CommandType.CREATE_FOLDER),
    folder: FolderInfo,
    index: Index.optional(),
  }),
  /** Renames a folder or request. */
  z.object({ type: z.literal(CommandType.RENAME), id: TrufosId, title: z.string() }),
  /**
   * Moves folders and requests, in the given order, to the given index of the given parent. The
   * index refers to the children of the parent without the moved items.
   */
  z.object({
    type: z.literal(CommandType.MOVE),
    ids: TopLevelIds,
    parentId: TrufosId,
    index: Index,
  }),
  /** Deletes folders (including their descendants) and requests. */
  z.object({ type: z.literal(CommandType.DELETE), ids: TopLevelIds }),
  /**
   * Copies folders (including their descendants) and requests, each to the end of its parent.
   * `idMap` maps the ID of every copied item and of each of its descendants to the ID of its copy.
   */
  z.object({
    type: z.literal(CommandType.COPY),
    ids: TopLevelIds,
    idMap: z.record(TrufosId, TrufosId),
  }),
  /** Turns a request into a draft, if it is none yet, e.g. as soon as its editor content changes. */
  z.object({ type: z.literal(CommandType.CREATE_DRAFT), id: TrufosId }),
  /** Changes the draft of a request, creating the draft if necessary. */
  z.object({ type: z.literal(CommandType.EDIT_REQUEST), id: TrufosId, changes: RequestChanges }),
  /** Replaces the text body of a request, creating the draft if necessary. */
  z.object({ type: z.literal(CommandType.SET_TEXT_BODY), id: TrufosId, text: z.string() }),
  /** Replaces a script of a request, creating the draft if necessary. */
  z.object({
    type: z.literal(CommandType.SET_SCRIPT),
    id: TrufosId,
    scriptType: z.enum(ScriptType),
    text: z.string(),
  }),
  /** Turns the draft of a request into its saved state. */
  z.object({ type: z.literal(CommandType.SAVE_REQUEST), id: TrufosId }),
  /** Restores the saved state of a request. A request that was never saved is deleted. */
  z.object({ type: z.literal(CommandType.DISCARD_REQUEST), id: TrufosId }),
  /** Changes the settings of the collection itself. */
  z.object({
    type: z.literal(CommandType.UPDATE_COLLECTION),
    changes: CollectionChanges,
    /**
     * The environment to select once the changes are applied, `null` for none. Undefined keeps
     * the selection, unless the selected environment is removed. The selection is not persisted,
     * so a command that only selects an environment has empty `changes`.
     */
    selectedEnvironmentKey: z.string().nullable().optional(),
  }),
]);
export type CollectionCommand = z.infer<typeof CollectionCommand>;

/** A {@link CollectionCommand} together with the information needed to apply it deterministically. */
export const CommandEnvelope = z.object({
  /** Unique ID of this command, used by the sender to recognize its own changes. */
  commandId: z.string().min(1),
  /** When the command was issued. Used as `lastModified` of the changed objects. */
  timestamp: z.number(),
  command: CollectionCommand,
});
export type CommandEnvelope = z.infer<typeof CommandEnvelope>;

/** Thrown when a command cannot be applied to the current model, e.g. its target does not exist. */
export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandError';
  }
}
