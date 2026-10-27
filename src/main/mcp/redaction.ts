import type { CollectionModel } from 'shim/collection-model';
import type { SentRequest } from 'shim/history';
import {
  type AuthorizationInformation,
  AuthorizationType,
  OAuth1Method,
  OAuth2Method,
} from 'shim/objects/auth';
import type { HttpHeaders } from 'shim/objects/headers';
import type { VariableObject } from 'shim/objects/variables';

/*
 * Keeps secrets out of the results of the MCP tools, so they do not end up in the context of a
 * model by default. This is no security boundary: a client that may edit and send requests can
 * send a secret anywhere. See docs/architecture/05_mcp_server.md.
 */

/** What a secret is replaced with. */
export const MASK = '***';

/** Headers whose values are credentials, in lower case. */
const CREDENTIAL_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie']);

/**
 * Secrets shorter than this are not searched for in sent requests. Replacing every occurrence of a
 * one or two character secret would garble the whole request.
 */
const MIN_REDACTED_LENGTH = 4;

/** A variable as it is returned to a client. */
export interface MaskedVariable extends VariableObject {
  key: string;
}

/**
 * @param variables the variables by key
 * @returns the variables with the values of secret ones masked
 */
export function maskVariables(variables: Iterable<[string, VariableObject]>): MaskedVariable[] {
  return [...variables].map(([key, variable]) => ({
    key,
    ...variable,
    value: variable.secret === true ? MASK : variable.value,
  }));
}

/**
 * Maps every credential of an authorization, i.e. every field that holds a secret. The fields are
 * listed per type, so a new type of authorization does not compile until its credentials are.
 * @param auth an authorization
 * @param map maps a credential
 * @returns the authorization with the mapped credentials
 */
function mapCredentials(
  auth: AuthorizationInformation,
  map: (credential: string) => string
): AuthorizationInformation {
  const mapOptional = (credential?: string) => (credential == null ? credential : map(credential));
  switch (auth.type) {
    case AuthorizationType.INHERIT:
      return auth;
    case AuthorizationType.BEARER:
      return { ...auth, token: map(auth.token) };
    case AuthorizationType.BASIC:
      return { ...auth, password: map(auth.password) };
    case AuthorizationType.OAUTH2: {
      const clientSecret = map(auth.clientSecret);
      return auth.method === OAuth2Method.AUTHORIZATION_CODE_PKCE
        ? { ...auth, clientSecret, codeVerifier: mapOptional(auth.codeVerifier) }
        : { ...auth, clientSecret };
    }
    case AuthorizationType.OAUTH1: {
      const consumerSecret = map(auth.consumerSecret);
      return auth.method === OAuth1Method.EXISTING_TOKEN
        ? {
            ...auth,
            consumerSecret,
            token: mapOptional(auth.token),
            tokenSecret: mapOptional(auth.tokenSecret),
          }
        : { ...auth, consumerSecret };
    }
  }
}

/**
 * @param auth an authorization
 * @returns the authorization with its credentials masked. Empty credentials stay empty, so a client
 * can tell that none is set.
 */
export function maskAuthorization(auth: AuthorizationInformation): AuthorizationInformation {
  return mapCredentials(auth, (credential) => (credential === '' ? '' : MASK));
}

/**
 * @param auth an authorization a client sent
 * @returns whether a credential is still masked, e.g. because the client sent back what
 * {@link maskAuthorization} returned
 */
export function hasMaskedCredential(auth: AuthorizationInformation): boolean {
  let masked = false;
  mapCredentials(auth, (credential) => {
    masked ||= credential === MASK;
    return credential;
  });
  return masked;
}

/**
 * Collects the secrets of a collection: the values of its secret variables in every environment,
 * and the credentials of every authorization.
 * @param model the open collection
 */
export function collectSecrets(model: CollectionModel): string[] {
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
    mapCredentials(auth, (credential) => {
      secrets.add(credential);
      return credential;
    });
  }

  return [...secrets].filter((secret) => secret.length >= MIN_REDACTED_LENGTH);
}

/**
 * @param text a text that may contain secrets
 * @param secrets the secrets, see {@link collectSecrets}
 * @returns the text with every occurrence of a secret masked
 */
export function redact(text: string, secrets: readonly string[]): string {
  // longer secrets first, so a secret that contains a shorter one is masked as a whole
  return [...secrets]
    .sort((a, b) => b.length - a.length)
    .reduce((result, secret) => result.replaceAll(secret, MASK), text);
}

/**
 * Masks the secrets in a request as it was sent, with all variables resolved: the values of
 * credential headers completely, and occurrences of secrets in the URL and the other headers.
 * @param request the sent request
 * @param secrets the secrets, see {@link collectSecrets}
 */
export function redactSentRequest(request: SentRequest, secrets: readonly string[]): SentRequest {
  const headers: HttpHeaders = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (value == null) continue;
    const mask = (v: string) =>
      CREDENTIAL_HEADERS.has(key.toLowerCase()) ? MASK : redact(v, secrets);
    headers[key] = Array.isArray(value) ? value.map(mask) : mask(value);
  }
  return { ...request, url: redact(request.url, secrets), headers };
}
