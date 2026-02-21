import { EnvironmentObject, VariableMap } from './objects';

export interface GlobalScriptingApi {
  readonly trufos: {
    /** The current version of the app. */
    readonly version: string;

    /** Global variables. Can be read and written to. */
    variables: VariableMap;

    /** Current environment and its variables. Can be read and written to. */
    readonly environment?: EnvironmentObject;
  };
}
