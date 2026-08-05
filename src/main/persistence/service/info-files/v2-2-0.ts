import {
  TrufosURL,
  VariableMap,
  EnvironmentMap,
  RequestMethod,
  TrufosHeader,
  TrufosObjectType,
  AuthorizationInformation,
  AuthorizationInformationNoInherit,
} from 'shim/objects';
import { SemVer } from 'main/util/semver';
import { AbstractInfoFileMigrator } from './migrator';
import {
  InfoFile as OldInfoFile,
  RequestInfoFile as OldRequestInfoFile,
  FolderInfoFile as OldFolderInfoFile,
  VERSION as OLD_VERSION,
} from './v2-1-0';
import { z } from 'zod';

export const VERSION = new SemVer(2, 2, 0);

export enum RequestBodyType {
  TEXT = 'text',
  FILE = 'file',
}

export const TextBody = z.object({
  type: z.literal(RequestBodyType.TEXT),
  text: z.string().optional(),
  mimeType: z.string(),
});
export type TextBody = z.infer<typeof TextBody>;

export const FileBody = z.object({
  type: z.literal(RequestBodyType.FILE),
  filePath: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
});
export type FileBody = z.infer<typeof FileBody>;

export enum FormDataValueType {
  TEXT = 'text',
  FILE = 'file',
}

export const RequestBody = z.discriminatedUnion('type', [TextBody, FileBody]);
export type RequestBody = z.infer<typeof RequestBody>;

export const InfoFileBase = z.object({
  id: z.string(),
  version: z.literal(VERSION.string),
  title: z.string(),
});
export type InfoFileBase = z.infer<typeof InfoFileBase>;

export const RequestInfoFile = InfoFileBase.extend({
  url: TrufosURL,
  method: z.enum(RequestMethod),
  headers: TrufosHeader.array(),
  body: RequestBody,
  auth: AuthorizationInformation.optional(),
});
export type RequestInfoFile = z.infer<typeof RequestInfoFile>;

export const FolderInfoFile = InfoFileBase;
export type FolderInfoFile = z.infer<typeof FolderInfoFile>;

export const CollectionInfoFile = InfoFileBase.extend({
  environments: EnvironmentMap,
  variables: VariableMap,
  auth: AuthorizationInformationNoInherit.optional(),
});
export type CollectionInfoFile = z.infer<typeof CollectionInfoFile>;

export const InfoFile = z.union([RequestInfoFile, FolderInfoFile, CollectionInfoFile]);
export type InfoFile = z.infer<typeof InfoFile>;

/**
 * Migrates schema `v2.1.0` to `v2.2.0`.
 *
 * Changes:
 * - Drops index property from info files as it's not persisted in a separate file on parent level
 */
export class InfoFileMigrator extends AbstractInfoFileMigrator<OldInfoFile, InfoFile> {
  public readonly fromVersion = OLD_VERSION.toString();

  async migrate(old: OldInfoFile, type: TrufosObjectType, _filePath: string): Promise<InfoFile> {
    if (type !== 'collection') {
      // just drop index as frontend doesn't support reordering yet anyway
      delete (old as OldRequestInfoFile | OldFolderInfoFile).index;
    }
    return Object.assign(old, { version: VERSION.toString() });
  }
}
