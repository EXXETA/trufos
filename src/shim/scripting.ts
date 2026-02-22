import { VariableObject } from './objects';

export enum ScriptType {
  /** Executed before the request is sent. */
  PRE_REQUEST = 'pre-request',

  /** Executed after the response is received. */
  POST_RESPONSE = 'post-response',
}

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
