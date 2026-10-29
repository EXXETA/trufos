import type { CollectionModel } from 'shim/collection-model';
import type { HistoryEntry, SentRequest } from 'shim/history';
import {
  type AuthorizationInformation,
  AuthorizationType,
  OAuth1Method,
  OAuth2Method,
} from 'shim/objects/auth';
import type { HttpHeaders } from 'shim/objects/headers';
import { buildUrl, parseUrl } from 'shim/objects/url';
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
    case AuthorizationType.DIGEST:
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
  return getCredentials(auth).includes(MASK);
}

/**
 * @param auth an authorization
 * @returns the credentials of the authorization, see {@link mapCredentials}
 */
function getCredentials(auth: AuthorizationInformation): string[] {
  const credentials: string[] = [];
  mapCredentials(auth, (credential) => {
    credentials.push(credential);
    return credential;
  });
  return credentials;
}

/**
 * Collects the secrets of a collection: the values of its secret variables in every environment,
 * and the credentials of every authorization.
 * @param model the open collection
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
    if (auth != null) getCredentials(auth).forEach((credential) => secrets.add(credential));
  }

  // an empty value is no secret, and would mask every empty value
  secrets.delete('');
  return secrets;
}

/*
 * Values are only masked if they equal a secret as a whole: a header value, a path segment, a
 * query value or a script argument. Masking every occurrence of a secret inside a longer text would also change data
 * that merely contains it, e.g. `/admin/users` for a secret `admin`. A secret that is only part of
 * a value, e.g. in `Token <secret>` or a signature derived from it, is not found.
 */

/**
 * @param value a value that was sent, e.g. a header value or a part of a URL
 * @param secrets the secrets, see {@link collectSecrets}
 * @returns the value, or {@link MASK} if it is a secret, also if it is URL-encoded
 */
function maskIfSecret(value: string, secrets: ReadonlySet<string>): string {
  if (secrets.has(value)) return MASK;
  try {
    return secrets.has(decodeURIComponent(value)) ? MASK : value;
  } catch {
    // not URL-encoded, e.g. a lone `%`
    return value;
  }
}

/**
 * @param url a URL as it was sent, with all variables resolved
 * @param secrets the secrets, see {@link collectSecrets}
 * @returns the URL with every path segment and query value that is a secret masked
 */
export function redactUrl(url: string, secrets: ReadonlySet<string>): string {
  const { base, query } = parseUrl(url);
  return buildUrl({
    base: base
      .split('/')
      .map((segment) => maskIfSecret(segment, secrets))
      .join('/'),
    query: query.map((parameter) =>
      parameter.value == null
        ? parameter
        : { ...parameter, value: maskIfSecret(parameter.value, secrets) }
    ),
  });
}

/**
 * Masks the secrets in a request as it was sent, with all variables resolved: the values of
 * credential headers completely, and URL parts and other header values that are a secret.
 * @param request the sent request
 * @param secrets the secrets, see {@link collectSecrets}
 */
export function redactSentRequest(request: SentRequest, secrets: ReadonlySet<string>): SentRequest {
  const headers: HttpHeaders = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (value == null) continue;
    const mask = (v: string) =>
      CREDENTIAL_HEADERS.has(key.toLowerCase()) ? MASK : maskIfSecret(v, secrets);
    headers[key] = Array.isArray(value) ? value.map(mask) : mask(value);
  }
  return { ...request, url: redactUrl(request.url, secrets), headers };
}

/**
 * Masks the secrets in a history entry: in its URL and sent request, see {@link redactSentRequest},
 * and script arguments that are a secret, e.g. of `console.log(token)`.
 * @param entry the history entry
 * @param secrets the secrets, see {@link collectSecrets}
 */
export function redactHistoryEntry(
  entry: HistoryEntry,
  secrets: ReadonlySet<string>
): HistoryEntry {
  return {
    ...entry,
    url: redactUrl(entry.url, secrets),
    request: entry.request && redactSentRequest(entry.request, secrets),
    scriptLogs: entry.scriptLogs.map((log) => ({
      ...log,
      args: log.args.map((arg) => (typeof arg === 'string' ? maskIfSecret(arg, secrets) : arg)),
    })),
  };
}
