import { Folder } from './folder';
import { TrufosRequest } from './request';
import { VariableMap } from './variables';
import { EnvironmentMap } from './environment';

/** A collection of folders and requests. */
export type Collection = {
  id: string;
  type: 'collection';
  title: string;
  dirPath: string;
  variables: VariableMap;
  environments: EnvironmentMap;
  children: (Folder | TrufosRequest)[];
};
