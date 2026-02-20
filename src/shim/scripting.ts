import { EnvironmentMap, VariableMap } from './objects';

export interface GlobalScriptingApi {
  readonly console: Console;
  readonly trufos: {
    /** The current version of the app. */
    readonly version: string;

    /** Global variables. Can be read and written to. */
    variables: VariableMap;

    /** Environments and their variables. Can be read and written to. */
    environment: EnvironmentMap;
  };
}
