import { Readable } from 'node:stream';
import { TemplateReplaceStream } from 'template-replace-stream';
import { VariableObject } from 'shim/objects/variables';
import { getSystemVariable, getSystemVariables } from './system-variable';
import { AuthorizationInformation, AuthorizationInformationNoInherit } from 'shim/objects';
import { createAuthStrategy } from 'main/network/authentication/auth-strategy-factory';
import { AuthRequestContext } from 'main/network/authentication/auth-strategy';
import { CollectionModel, type SentHeader } from 'shim/collection-model';

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

/**
 * Returns what a template variable is replaced with: its value, `{{name}}` for a secret one that is
 * kept, or undefined if it is not defined.
 */
function getVariableValue(
  model: CollectionModel,
  { keepSecrets = false }: Pick<ResolveVariablesOptions, 'keepSecrets'> = {}
) {
  return (key: string) => {
    const variable = getVariable(model, key);
    return keepSecrets && variable?.secret === true ? `{{${key}}}` : variable?.value;
  };
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

/** How the variables are resolved, e.g. by {@link resolveVariablesInString}. */
export interface ResolveVariablesOptions {
  /**
   * If true, an {@link UnmatchedVariableError} is thrown when the string references a variable that
   * is not defined, instead of leaving the template in place.
   */
  throwOnUndefinedVariable?: boolean;
  /**
   * If true, secret variables are not resolved but written as `{{name}}`, e.g. to show a request
   * without revealing its secrets.
   */
  keepSecrets?: boolean;
}

/**
 * Replaces any `{{ $someVariable }}` template variables in the given string with their values.
 *
 * @param model The model to read the variables from.
 * @param string The string to replace the variables in.
 * @param options How the variables are resolved, see {@link ResolveVariablesOptions}.
 * @returns The string with the variables replaced.
 */
export function resolveVariablesInString(
  model: CollectionModel,
  string: string,
  { throwOnUndefinedVariable = false, keepSecrets = false }: ResolveVariablesOptions = {}
): Promise<string> {
  return TemplateReplaceStream.replaceStringAsync(
    string,
    getVariableValue(model, { keepSecrets }),
    {
      throwOnUnmatchedTemplate: throwOnUndefinedVariable,
    }
  );
}

/**
 * Replaces the template variables in the values of the inherited and own headers a request sends.
 * Automatic headers are final, see `resolveHeaders()`.
 *
 * @param model The model to read the variables from.
 * @param headers The headers the request sends.
 * @param options How the variables are resolved, see {@link ResolveVariablesOptions}.
 * @returns The headers with the variables replaced.
 */
export async function resolveVariablesInHeaders(
  model: CollectionModel,
  headers: SentHeader[],
  options: ResolveVariablesOptions = {}
): Promise<SentHeader[]> {
  return await Promise.all(
    headers.map(async (header) =>
      header.isAutomatic || header.value == null
        ? header
        : { ...header, value: await resolveVariablesInString(model, header.value, options) }
    )
  );
}

/**
 * Returns a copy of the authorization with the variables resolved in its top-level string fields.
 * Nested objects, i.e. the retrieved OAuth tokens, are deliberately kept as they are: they come from
 * the token endpoint and hold no templates. (An earlier version resolved them recursively.)
 *
 * @param model The model to read the variables from.
 * @param auth The authorization to resolve the variables in.
 * @param options How the variables are resolved, see {@link ResolveVariablesOptions}.
 */
export async function resolveVariablesInAuth<T extends AuthorizationInformation>(
  model: CollectionModel,
  auth: T,
  options: ResolveVariablesOptions = {}
): Promise<T> {
  const resolved = { ...auth };
  for (const [key, value] of Object.entries(auth)) {
    if (typeof value === 'string') {
      Object.assign(resolved, { [key]: await resolveVariablesInString(model, value, options) });
    }
  }
  return resolved;
}

/**
 * Returns the authorization header for the given authorization. An inherited authorization has to
 * be resolved first, see `resolveAuthorization()`.
 * @param model The model to read the variables from.
 * @param auth The authorization information to get the header for.
 * @param context Information about the request being sent, used by strategies
 * that sign the request (OAuth 1.0) or answer a challenge (Digest).
 * @returns The authorization header as a string, or undefined if no authorization is set.
 */
export async function getAuthorizationHeader(
  model: CollectionModel,
  auth: AuthorizationInformationNoInherit | undefined,
  context: AuthRequestContext
): Promise<string | undefined> {
  if (auth == null) return;
  const resolved = await resolveVariablesInAuth(model, auth);
  return await createAuthStrategy(resolved).getAuthHeader(context);
}
