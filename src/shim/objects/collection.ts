import { Folder } from './folder';
import { TrufosRequest } from './request';
import { VariableMap } from './variables';
import { EnvironmentMap } from './environment';
import { AuthorizationInformationNoInherit } from './auth';
import z from 'zod';

/** File paths for a client certificate used in mutual TLS (mTLS). */
export const ClientCertificate = z.object({
  certPath: z.string(),
  keyPath: z.string(),
  caPath: z.string().optional(),
});
export type ClientCertificate = z.infer<typeof ClientCertificate>;

/** Minimal information about a collection. */
export const CollectionBase = z.object({
  id: z.string(),
  title: z.string(),
  dirPath: z.string(),
});
export type CollectionBase = z.infer<typeof CollectionBase>;

/** A collection of folders and requests. */
export const Collection = CollectionBase.extend({
  type: z.literal('collection'),
  lastModified: z.number(),
  isDefault: z.boolean().optional(),
  variables: VariableMap,
  environments: EnvironmentMap,
  auth: AuthorizationInformationNoInherit.optional(),
  clientCertificate: ClientCertificate.optional(),
  children: z.discriminatedUnion('type', [Folder, TrufosRequest]).array(),
});
export type Collection = z.infer<typeof Collection>;
