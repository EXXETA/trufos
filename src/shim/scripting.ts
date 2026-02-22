import { EnvironmentObject, VariableObject } from './objects';

export interface GlobalScriptingApi {
  readonly trufos: {
    /** The current version of the app. */
    readonly version: string;

    getCollectionVariable(name: string): string | undefined;

    setCollectionVariable(name: string, value: string | VariableObject): void;

    getEnvironmentVariable(environment: string | undefined, name: string): string | undefined;

    setEnvironmentVariable(
      environment: string | undefined,
      name: string,
      value: string | VariableObject
    ): void;
  };
}
