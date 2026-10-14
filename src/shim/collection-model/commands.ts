import { z } from 'zod';
import { AuthorizationInformation, AuthorizationInformationNoInherit } from '../objects/auth';
import { ClientCertificate } from '../objects/collection';
import { EnvironmentMap } from '../objects/environment';
import { TrufosRequest } from '../objects/request';
import { VariableMap } from '../objects/variables';
import { ScriptType } from '../scripting';
import { TrufosId } from '../objects/id';
import { FolderInfo } from './model';

const Index = z.int().nonnegative();

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
    title: z.string(),
    variables: VariableMap,
    environments: EnvironmentMap,
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
  EDIT_REQUEST = 'editRequest',
  SET_TEXT_BODY = 'setTextBody',
  SET_SCRIPT = 'setScript',
  SAVE_REQUEST = 'saveRequest',
  DISCARD_REQUEST = 'discardRequest',
  UPDATE_COLLECTION = 'updateCollection',
  SELECT_ENVIRONMENT = 'selectEnvironment',
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
   * Moves a folder or request to the given index of the given parent. Within the same parent, the
   * index refers to the children without the moved item.
   */
  z.object({ type: z.literal(CommandType.MOVE), id: TrufosId, parentId: TrufosId, index: Index }),
  /** Deletes a folder (including its descendants) or a request. */
  z.object({ type: z.literal(CommandType.DELETE), id: TrufosId }),
  /**
   * Copies a folder (including its descendants) or a request to the end of its parent.
   * `idMap` maps the ID of the copied item and of each of its descendants to the ID of its copy.
   */
  z.object({
    type: z.literal(CommandType.COPY),
    id: TrufosId,
    idMap: z.record(TrufosId, TrufosId),
  }),
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
  z.object({ type: z.literal(CommandType.UPDATE_COLLECTION), changes: CollectionChanges }),
  /** Selects an environment, or none. The selection is not persisted. */
  z.object({ type: z.literal(CommandType.SELECT_ENVIRONMENT), key: z.string().optional() }),
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
