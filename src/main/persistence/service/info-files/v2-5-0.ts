import {
  TrufosURL,
  RequestBody,
  VariableMap,
  EnvironmentMap,
  RequestMethod,
  TrufosHeader,
  TrufosObjectType,
  AuthorizationInformation,
  AuthorizationInformationNoInherit,
} from 'shim/objects';
import { ClientCertificate } from 'shim/objects/collection';
import { SemVer } from 'main/util/semver';
import { AbstractInfoFileMigrator } from './migrator';
import { InfoFile as OldInfoFile, VERSION as OLD_VERSION } from './v2-4-0';
import { GIT_IGNORE_LINES as OLD_GIT_IGNORE_LINES } from './v2-0-0';
import { ensureGitIgnore } from '../git-ignore';
import { REPLACEMENT_FILE_GIT_IGNORE_PATTERN } from 'main/filesystem/filesystem-service';
import { z } from 'zod';
import path from 'node:path';

export const VERSION = new SemVer(2, 5, 0);

/** The lines of a collection `.gitignore` file: drafts, secrets and temporary files of writes. */
export const GIT_IGNORE_LINES = [...OLD_GIT_IGNORE_LINES, REPLACEMENT_FILE_GIT_IGNORE_PATTERN];

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

export const FolderInfoFile = InfoFileBase.extend({
  auth: AuthorizationInformationNoInherit.optional(),
});
export type FolderInfoFile = z.infer<typeof FolderInfoFile>;

export const CollectionInfoFile = InfoFileBase.extend({
  environments: EnvironmentMap,
  variables: VariableMap,
  auth: AuthorizationInformationNoInherit.optional(),
  clientCertificate: ClientCertificate.optional(),
});
export type CollectionInfoFile = z.infer<typeof CollectionInfoFile>;

export const InfoFile = z.union([RequestInfoFile, FolderInfoFile, CollectionInfoFile]);
export type InfoFile = z.infer<typeof InfoFile>;

/**
 * Migrates schema `v2.4.0` to `v2.5.0`.
 *
 * Changes:
 * - Adds optional `auth` field to FolderInfoFile. Requests inherit it from their closest folder.
 * - Ignores the temporary files of atomic writes in the `.gitignore` of the collection.
 */
export class InfoFileMigrator extends AbstractInfoFileMigrator<OldInfoFile, InfoFile> {
  public readonly fromVersion = OLD_VERSION.toString();

  async migrate(old: OldInfoFile, type: TrufosObjectType, filePath: string): Promise<InfoFile> {
    if (type === 'collection') await ensureGitIgnore(path.dirname(filePath), GIT_IGNORE_LINES);
    return Object.assign(old, { version: VERSION.toString() });
  }
}
