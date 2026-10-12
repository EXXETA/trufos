import { z } from 'zod';
import { AuthorizationInformation, AuthorizationInformationNoInherit } from '../objects/auth';
import { ClientCertificate } from '../objects/collection';
import { EnvironmentMap } from '../objects/environment';
import { TrufosRequest } from '../objects/request';
import { VariableMap } from '../objects/variables';
import { ScriptType } from '../scripting';
import { FolderInfo } from './model';

const Id = z.string().min(1);
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
 * Every change the renderer or a main process service can make to the open collection. Commands
 * are applied by {@link applyCommand} in both processes, so anything non-deterministic (new IDs,
 * timestamps) must be part of the command.
 */
export const CollectionCommand = z.discriminatedUnion('type', [
  /** Creates a request. New requests usually are drafts that were never saved. */
  z.object({ type: z.literal('createRequest'), request: TrufosRequest, index: Index.optional() }),
  /** Creates an empty folder. */
  z.object({ type: z.literal('createFolder'), folder: FolderInfo, index: Index.optional() }),
  /** Renames a folder or request. */
  z.object({ type: z.literal('rename'), id: Id, title: z.string() }),
  /**
   * Moves a folder or request to the given index of the given parent. Within the same parent, the
   * index refers to the children without the moved item.
   */
  z.object({ type: z.literal('move'), id: Id, parentId: Id, index: Index }),
  /** Deletes a folder (including its descendants) or a request. */
  z.object({ type: z.literal('delete'), id: Id }),
  /**
   * Copies a folder (including its descendants) or a request to the end of its parent.
   * `idMap` maps the ID of the copied item and of each of its descendants to the ID of its copy.
   */
  z.object({ type: z.literal('copy'), id: Id, idMap: z.record(Id, Id) }),
  /** Changes the draft of a request, creating the draft if necessary. */
  z.object({ type: z.literal('editRequest'), id: Id, changes: RequestChanges }),
  /** Replaces the text body of a request, creating the draft if necessary. */
  z.object({ type: z.literal('setTextBody'), id: Id, text: z.string() }),
  /** Replaces a script of a request, creating the draft if necessary. */
  z.object({
    type: z.literal('setScript'),
    id: Id,
    scriptType: z.enum(ScriptType),
    text: z.string(),
  }),
  /** Turns the draft of a request into its saved state. */
  z.object({ type: z.literal('saveRequest'), id: Id }),
  /** Restores the saved state of a request. A request that was never saved is deleted. */
  z.object({ type: z.literal('discardRequest'), id: Id }),
  z.object({ type: z.literal('renameCollection'), title: z.string() }),
  z.object({ type: z.literal('setVariables'), variables: VariableMap }),
  z.object({ type: z.literal('setEnvironments'), environments: EnvironmentMap }),
  z.object({ type: z.literal('selectEnvironment'), key: z.string().optional() }),
  z.object({
    type: z.literal('setClientCertificate'),
    clientCertificate: ClientCertificate.optional(),
  }),
  z.object({
    type: z.literal('setCollectionAuth'),
    auth: AuthorizationInformationNoInherit.optional(),
  }),
]);
export type CollectionCommand = z.infer<typeof CollectionCommand>;

/** A {@link CollectionCommand} together with the information needed to apply it deterministically. */
export const CommandEnvelope = z.object({
  /** Unique ID of this command, used by the sender to recognize its own changes. */
  commandId: Id,
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
