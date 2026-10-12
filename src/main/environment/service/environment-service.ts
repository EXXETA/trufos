import { Readable } from 'node:stream';
import { TemplateReplaceStream } from 'template-replace-stream';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { VariableObject } from 'shim/objects/variables';
import { getSystemVariable, getSystemVariables } from './system-variable';
import { AuthorizationInformation, AuthorizationType } from 'shim/objects';
import { createAuthStrategy } from 'main/network/authentication/auth-strategy-factory';
import { AuthRequestContext } from 'main/network/authentication/auth-strategy';
import { EnvironmentObject } from 'shim/objects/environment';

const collectionState = CollectionStateService.instance;

/**
 * The environment service resolves the system, collection, and environment variables (the ones
 * that can be used in the request body, headers, etc.) and the authorization of the open
 * collection, see {@link CollectionStateService}.
 */
export class EnvironmentService {
  public static readonly instance: EnvironmentService = new EnvironmentService();

  /** The currently selected environment in the current collection. */
  public get currentEnvironment(): EnvironmentObject | undefined {
    const { collection, selectedEnvironmentKey } = collectionState.model;
    if (selectedEnvironmentKey == null) return;
    return collection.environments[selectedEnvironmentKey];
  }

  /**
   * Replaces any `{{ $someVariable }}` template variables in the given stream with their values.
   *
   * @param stream The stream to replace the variables in.
   * @returns The stream with the variables replaced.
   */
  public setVariablesInStream(stream: Readable): Readable {
    return stream.pipe(new TemplateReplaceStream(this.getVariableValue.bind(this)));
  }

  /**
   * Replaces any `{{ $someVariable }}` template variables in the given string with their values.
   *
   * @param string The string to replace the variables in.
   * @param throwOnUndefinedVariable If true, an {@link UnmatchedVariableError} is thrown when the
   * string references a variable that is not defined, instead of leaving the template in place.
   * @returns The string with the variables replaced.
   */
  public setVariablesInString(string: string, throwOnUndefinedVariable = false): Promise<string> {
    return TemplateReplaceStream.replaceStringAsync(string, this.getVariableValue.bind(this), {
      throwOnUnmatchedTemplate: throwOnUndefinedVariable,
    });
  }

  /**
   * Returns all variables for the current state (e.g. collection variables). This also includes
   * system variables.
   */
  public getVariables(): [string, VariableObject][] {
    return Object.entries(this.currentEnvironment?.variables ?? {})
      .concat(Object.entries(collectionState.model.collection.variables))
      .concat(getSystemVariables());
  }

  /**
   * Returns the value of a variable. The hierarchy is as follows:
   * 1. Environment variables
   * 2. Collection variables
   * 3. System variables
   *
   * @param key The key of the variable.
   * @returns The value of the variable if it exists, otherwise undefined.
   */
  public getVariable(key: string): VariableObject {
    return (
      this.currentEnvironment?.variables[key] ??
      collectionState.model.collection.variables[key] ??
      getSystemVariable(key)
    );
  }

  private getVariableValue(key: string) {
    return this.getVariable(key)?.value;
  }

  /**
   * Recursively sets variables in the given object. Only string values are processed.
   * @param object The object to set variables in.
   * @returns The object with variables set.
   */
  private async setVariablesRecursive<T extends object>(object: T): Promise<T> {
    for (const [key, value] of Object.entries(object)) {
      if (typeof value === 'string') {
        // @ts-expect-error - value is a string, so this is valid
        object[key] = await this.setVariablesInString(value);
      } else if (typeof value === 'object' && value !== null) {
        // @ts-expect-error - value is an object, so this is valid
        object[key] = await this.setVariablesRecursive(value);
      }
    }

    return object;
  }

  /**
   * Returns the authorization header for the given object. If the object has an
   * authorization type of `INHERIT`, it will recursively get the authorization header from the
   * current collection.
   * @param auth The authorization information to get the header for.
   * @param context Information about the request being sent, required by strategies
   * that sign the request (OAuth 1.0).
   * @returns The authorization header as a string, or undefined if no authorization is set.
   */
  public async getAuthorizationHeader(
    auth?: AuthorizationInformation,
    context?: AuthRequestContext
  ): Promise<string | undefined> {
    if (auth == null) {
      return;
    } else if (auth.type === AuthorizationType.INHERIT) {
      return this.getAuthorizationHeader(collectionState.model.collection.auth, context);
    } else {
      // the auth comes from the model, which is frozen, so the variables are set on a copy
      const resolved = await this.setVariablesRecursive(structuredClone(auth));
      return await createAuthStrategy(resolved).getAuthHeader(context);
    }
  }
}
