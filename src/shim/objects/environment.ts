import { VariableMap } from './variables';

/** A map of environment key => environments as `Record` */
export type EnvironmentMap = Record<string, EnvironmentObject>;

/** An environment with variables. */
export type EnvironmentObject = {
  /** Variables that exist in the environment */
  variables: VariableMap;
};

export type EnvironmentObjectWithKey = EnvironmentObject & { key: string };
