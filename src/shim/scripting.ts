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

    /**
     * Get a variable from the current collection.
     * @param name The name of the variable.
     * @returns The current value of the variable, or `undefined` if it doesn't exist.
     */
    getCollectionVariable(name: string): string | undefined;

    /**
     * Set a variable in the current collection. If the variable doesn't exist, it will be created.
     * @param name The name of the variable.
     * @param value The value to set for the variable. Can be a string or an object with additional properties.
     * @example
     * // Set a simple string variable
     * trufos.setCollectionVariable('apiUrl', 'https://api.example.com');
     *
     * // Set a variable with additional properties
     * trufos.setCollectionVariable('userToken', {
     *   value: 'abc123',
     *   description: 'Token for authenticating API requests',
     *   secret: true, // does not appear in git and is stored encrypted
     * });
     */
    setCollectionVariable(name: string, value: string | VariableObject): void;

    /**
     * Get a variable from an environment.
     * @param name The name of the variable.
     * @param environment The name of the environment to get the variable from, or `undefined` to get it from the currently selected environment.
     * @returns The current value of the variable, or `undefined` if it doesn't exist.
     */
    getEnvironmentVariable(name: string, environment?: string): string | undefined;

    /**
     * Set a variable in an environment. If the variable doesn't exist, it will be created.
     * @param name The name of the variable.
     * @param value The value to set for the variable. Can be a string or an object with additional properties.
     * @param environment The name of the environment to set the variable in, or `undefined` to set it in the currently selected environment.
     * @example
     * // Set a simple string variable in the current environment
     * trufos.setEnvironmentVariable(undefined, 'apiUrl', 'https://api.example.com');
     *
     * // Set a variable with additional properties in a specific environment
     * trufos.setEnvironmentVariable('staging', 'userToken', {
     *   value: 'abc123',
     *   description: 'Token for authenticating API requests in staging environment',
     *   secret: true, // does not appear in git and is stored encrypted
     * });
     */
    setEnvironmentVariable(
      name: string,
      value: string | VariableObject,
      environment?: string
    ): void;
  };
}
