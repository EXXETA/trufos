import type { CollectionModel } from 'shim/collection-model';
import {
  type AuthorizationInformation,
  AuthorizationType,
  OAuth1Method,
  OAuth2Method,
} from 'shim/objects/auth';

/*
 * The secrets of a collection: the values that must not end up where they are not needed, e.g. in
 * the context of an AI agent. The request history records them per request, and the MCP server
 * masks them, see `main/mcp/redaction.ts`.
 */

/** The fields of authorizations that hold a credential, see {@link mapCredentials}. */
export type CredentialField =
  'token' | 'password' | 'clientSecret' | 'codeVerifier' | 'consumerSecret' | 'tokenSecret';

/**
 * Maps every credential of an authorization, i.e. every field that holds a secret. The fields are
 * listed per type, so a new type of authorization does not compile until its credentials are.
 * @param auth an authorization
 * @param map maps a credential, given the field that holds it
 * @returns the authorization with the mapped credentials
 */
export function mapCredentials(
  auth: AuthorizationInformation,
  map: (credential: string, field: CredentialField) => string
): AuthorizationInformation {
  const mapOptional = (field: CredentialField, credential?: string) =>
    credential == null ? credential : map(credential, field);
  switch (auth.type) {
    case AuthorizationType.INHERIT:
      return auth;
    case AuthorizationType.BEARER:
      return { ...auth, token: map(auth.token, 'token') };
    case AuthorizationType.BASIC:
    case AuthorizationType.DIGEST:
      return { ...auth, password: map(auth.password, 'password') };
    case AuthorizationType.OAUTH2: {
      const clientSecret = map(auth.clientSecret, 'clientSecret');
      return auth.method === OAuth2Method.AUTHORIZATION_CODE_PKCE
        ? { ...auth, clientSecret, codeVerifier: mapOptional('codeVerifier', auth.codeVerifier) }
        : { ...auth, clientSecret };
    }
    case AuthorizationType.OAUTH1: {
      const consumerSecret = map(auth.consumerSecret, 'consumerSecret');
      return auth.method === OAuth1Method.EXISTING_TOKEN
        ? {
            ...auth,
            consumerSecret,
            token: mapOptional('token', auth.token),
            tokenSecret: mapOptional('tokenSecret', auth.tokenSecret),
          }
        : { ...auth, consumerSecret };
    }
  }
}

/**
 * @param auth an authorization
 * @returns the credentials of the authorization by their field, see {@link mapCredentials}
 */
export function getCredentials(auth: AuthorizationInformation): Map<CredentialField, string> {
  const credentials = new Map<CredentialField, string>();
  mapCredentials(auth, (credential, field) => {
    credentials.set(field, credential);
    return credential;
  });
  return credentials;
}

/**
 * Collects the secrets of a collection: the values of its secret variables in every environment,
 * and the credentials of every authorization.
 * @param model the collection
 */
export function collectSecrets(model: CollectionModel): ReadonlySet<string> {
  const { collection } = model;
  const secrets = new Set<string>();
  const variableMaps = [
    collection.variables,
    ...Object.values(collection.environments).map((environment) => environment.variables),
  ];
  for (const variables of variableMaps) {
    for (const variable of Object.values(variables)) {
      if (variable.secret === true) secrets.add(variable.value);
    }
  }

  const nodes = [
    collection,
    ...model.folders.values(),
    ...model.requests.values(),
    ...model.savedRequests.values(),
  ];
  for (const { auth } of nodes) {
    if (auth == null) continue;
    for (const credential of getCredentials(auth).values()) secrets.add(credential);
  }

  // an empty value is no secret, and would mask every empty value
  secrets.delete('');
  return secrets;
}
