import { VariableMap } from './variables';

/** A map of environments as `Record` */
export type EnvironmentMap = Record<EnvironmentObject['key'], EnvironmentObject>;

/** An environment with variables. */
export type EnvironmentObject = {
  key: string;
  variables: VariableMap;
};
