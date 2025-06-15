import { Folder } from './folder';
import { TrufosRequest } from './request';
import { VariableMap } from './variables';
import { EnvironmentMap } from './environment';

export enum CollectionType {
  Trufos = 'Trufos',
  Postman = 'Postman',
  Bruno = 'Bruno',
}

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
  children: (Folder | TrufosRequest)[];
};
