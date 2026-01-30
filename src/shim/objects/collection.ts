import { Folder } from './folder';
import { TrufosRequest } from './request';
import { VariableMap } from './variables';
import { EnvironmentMap } from './environment';
import { AuthorizationInformationNoInherit } from './auth';
import z from 'zod';

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
  isDefault: z.boolean().optional(),
  variables: VariableMap,
  environments: EnvironmentMap,
  auth: AuthorizationInformationNoInherit.optional(),
  children: z.discriminatedUnion('type', [Folder, TrufosRequest]).array(),
});
export type Collection = z.infer<typeof Collection>;
