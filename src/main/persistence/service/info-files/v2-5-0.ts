import {
  TrufosURL,
  RequestBody,
  VariableMap,
  EnvironmentMap,
  RequestMethod,
  TrufosHeader,
  AuthorizationInformation,
  AuthorizationInformationNoInherit,
  Assertion,
} from 'shim/objects';
import { ClientCertificate } from 'shim/objects/collection';
import { SemVer } from 'main/util/semver';
import { AbstractInfoFileMigrator } from './migrator';
import { InfoFile as OldInfoFile, VERSION as OLD_VERSION } from './v2-4-0';
import z from 'zod';

export const VERSION = new SemVer(2, 5, 0);

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
  assertions: Assertion.array().optional(),
});
export type RequestInfoFile = z.infer<typeof RequestInfoFile>;

export const FolderInfoFile = InfoFileBase;
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
 * - Adds optional `assertions` field to RequestInfoFile for no-code response assertions.
 */
export class InfoFileMigrator extends AbstractInfoFileMigrator<OldInfoFile, InfoFile> {
  public readonly fromVersion = OLD_VERSION.toString();

  async migrate(old: OldInfoFile): Promise<InfoFile> {
    return Object.assign(old, { version: VERSION.toString() });
  }
}
