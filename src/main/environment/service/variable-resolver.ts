import { Readable } from 'node:stream';
import { TemplateReplaceStream } from 'template-replace-stream';
import { VariableObject } from 'shim/objects/variables';
import { getSystemVariable, getSystemVariables } from './system-variable';
import { AuthorizationInformation, AuthorizationType } from 'shim/objects';
import { createAuthStrategy } from 'main/network/authentication/auth-strategy-factory';
import { AuthRequestContext } from 'main/network/authentication/auth-strategy';
import { CollectionModel } from 'shim/collection-model';

/*
 * Resolves the system, collection, and environment variables (the ones that can be used in the
 * request body, headers, etc.) and the authorization of a collection. Everything is resolved from
 * the given model, so whoever resolves several values of one request resolves them all from the
 * same state.
 */

/** Returns the selected environment of the collection, if any. */
function getSelectedEnvironment({ collection, selectedEnvironmentKey }: CollectionModel) {
  if (selectedEnvironmentKey == null) return;
  return collection.environments[selectedEnvironmentKey];
}

/**
 * Returns all variables of the model, including system variables. Environment variables come
 * first, then collection variables, then system variables.
 */
export function getVariables(model: CollectionModel): [string, VariableObject][] {
  return Object.entries(getSelectedEnvironment(model)?.variables ?? {})
    .concat(Object.entries(model.collection.variables))
    .concat(getSystemVariables());
}

/**
 * Returns the value of a variable. The hierarchy is as follows:
 * 1. Environment variables
 * 2. Collection variables
 * 3. System variables
 *
 * @param model The model to read the variables from.
 * @param key The key of the variable.
 * @returns The value of the variable if it exists, otherwise undefined.
 */
export function getVariable(model: CollectionModel, key: string): VariableObject | undefined {
  return (
    getSelectedEnvironment(model)?.variables[key] ??
    model.collection.variables[key] ??
    getSystemVariable(key)
  );
}

function getVariableValue(model: CollectionModel) {
  return (key: string) => getVariable(model, key)?.value;
}

/**
 * Replaces any `{{ $someVariable }}` template variables in the given stream with their values.
 *
 * @param model The model to read the variables from.
 * @param stream The stream to replace the variables in.
 * @returns The stream with the variables replaced.
 */
export function resolveVariablesInStream(model: CollectionModel, stream: Readable): Readable {
  return stream.pipe(new TemplateReplaceStream(getVariableValue(model)));
}

/**
 * Replaces any `{{ $someVariable }}` template variables in the given string with their values.
 *
 * @param model The model to read the variables from.
 * @param string The string to replace the variables in.
 * @param throwOnUndefinedVariable If true, an {@link UnmatchedVariableError} is thrown when the
 * string references a variable that is not defined, instead of leaving the template in place.
 * @returns The string with the variables replaced.
 */
export function resolveVariablesInString(
  model: CollectionModel,
  string: string,
  throwOnUndefinedVariable = false
): Promise<string> {
  return TemplateReplaceStream.replaceStringAsync(string, getVariableValue(model), {
    throwOnUnmatchedTemplate: throwOnUndefinedVariable,
  });
}

/**
 * Recursively sets variables in the given object. Only string values are processed.
 * @param object The object to set variables in.
 * @returns The object with variables set.
 */
async function resolveVariablesRecursive<T extends object>(
  model: CollectionModel,
  object: T
): Promise<T> {
  for (const [key, value] of Object.entries(object)) {
    if (typeof value === 'string') {
      // @ts-expect-error - value is a string, so this is valid
      object[key] = await resolveVariablesInString(model, value);
    } else if (typeof value === 'object' && value !== null) {
      // @ts-expect-error - value is an object, so this is valid
      object[key] = await resolveVariablesRecursive(model, value);
    }
  }

  return object;
}

/**
 * Returns the authorization header for the given object. If the object has an authorization type
 * of `INHERIT`, the authorization of the collection is used.
 * @param model The model to read the collection authorization and the variables from.
 * @param auth The authorization information to get the header for.
 * @param context Information about the request being sent, required by strategies
 * that sign the request (OAuth 1.0).
 * @returns The authorization header as a string, or undefined if no authorization is set.
 */
export async function getAuthorizationHeader(
  model: CollectionModel,
  auth?: AuthorizationInformation,
  context?: AuthRequestContext
): Promise<string | undefined> {
  if (auth == null) {
    return;
  } else if (auth.type === AuthorizationType.INHERIT) {
    return getAuthorizationHeader(model, model.collection.auth, context);
  } else {
    // the auth comes from the model, which is frozen, so the variables are set on a copy
    const resolved = await resolveVariablesRecursive(model, structuredClone(auth));
    return await createAuthStrategy(resolved).getAuthHeader(context);
  }
}
