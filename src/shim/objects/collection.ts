import { Folder } from './folder';
import { TrufosRequest } from './request';
import { VariableMap } from './variables';
import { EnvironmentMap } from './environment';
import { AuthorizationInformation, InheritAuthorizationInformation } from './auth';

/** Minimal information about a collection. */
export type CollectionBase = {
  id: string;
  title: string;
  dirPath: string;
};

/** A collection of folders and requests. */
export type Collection = CollectionBase & {
  type: 'collection';
  variables: VariableMap;
  environments: EnvironmentMap;
  auth?: Exclude<AuthorizationInformation, InheritAuthorizationInformation>;
  children: (Folder | TrufosRequest)[];
};
