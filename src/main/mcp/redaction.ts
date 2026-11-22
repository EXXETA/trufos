import { getCredentials, mapCredentials } from 'main/collection-state/secrets';
import type { RequestChanges } from 'shim/collection-model';
import type { HistoryEntry, SentRequest } from 'shim/history';
import type { AuthorizationInformation } from 'shim/objects/auth';
import { type HttpHeaders, normalizeHeaderKey, type TrufosHeader } from 'shim/objects/headers';
import { type RequestBody, RequestBodyType, type TrufosRequest } from 'shim/objects/request';
import { buildUrl, parseUrl, type TrufosURL } from 'shim/objects/url';
import type { VariableObject } from 'shim/objects/variables';

/*
 * Keeps secrets out of the results of the MCP tools, so they do not end up in the context of a
 * model by default, see `collectSecrets`. This is no security boundary: a client that may
 * edit and send requests can send a secret anywhere. See docs/architecture/05_mcp_server.md.
 *
 * Clients send back what they read, so every masking function for stored data has its inverse
 * here, see {@link restoreMaskedChanges}.
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
 * @param auth an authorization
 * @returns the authorization with its credentials masked. Empty credentials stay empty, so a client
 * can tell that none is set.
 */
export function maskAuthorization(auth: AuthorizationInformation): AuthorizationInformation {
  return mapCredentials(auth, (credential) => (credential === '' ? '' : MASK));
}

/*
 * Values of their own, e.g. a header value, a path segment or a query value, are only masked if
 * they equal a secret as a whole. Masking every occurrence of a secret inside such a value would
 * also change data that merely contains it, e.g. `/admin/users` for a secret `admin`. A secret
 * that is only part of a value, e.g. in `Token <secret>` or a signature derived from it, is not
 * found there. Credential headers are masked completely instead.
 *
 * Free text, i.e. script output and scripts, is masked wherever a secret occurs in it, as a
 * script can log or contain a secret anywhere. Text that merely contains a secret is masked as
 * well then.
 */

/**
 * @param value a value that was sent, e.g. a header value or a part of a URL
 * @param secrets the secrets, see `collectSecrets`
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
 * @param url a URL, e.g. of a stored request
 * @param secrets the secrets, see `collectSecrets`
 * @returns the URL with every path segment and query value that is a secret masked
 */
export function redactTrufosUrl(
  { base, query }: TrufosURL,
  secrets: ReadonlySet<string>
): TrufosURL {
  return {
    base: base
      .split('/')
      .map((segment) => maskIfSecret(segment, secrets))
      .join('/'),
    query: query.map((parameter) =>
      parameter.value == null
        ? parameter
        : { ...parameter, value: maskIfSecret(parameter.value, secrets) }
    ),
  };
}

/**
 * @param url a URL as it was sent, with all variables resolved
 * @param secrets the secrets, see `collectSecrets`
 * @returns the URL with every path segment and query value that is a secret masked
 */
export function redactUrl(url: string, secrets: ReadonlySet<string>): string {
  return buildUrl(redactTrufosUrl(parseUrl(url), secrets));
}

/** @returns whether the header carries credentials, see {@link CREDENTIAL_HEADERS} */
function isCredentialHeader(key: string): boolean {
  return CREDENTIAL_HEADERS.has(normalizeHeaderKey(key));
}

/**
 * @param value the value of a header as it is stored, with its `{{variables}}`
 * @returns whether the value contains no credential itself, as it only references variables,
 * optionally after an authorization scheme, e.g. `Bearer {{token}}`
 */
function referencesOnlyVariables(value: string): boolean {
  return /^([A-Za-z][\w-]*\s+)?(\{\{[^{}]+\}\}\s*)+$/.test(value.trim());
}

/**
 * @param key the key of a stored header
 * @param value its value, with its `{{variables}}`
 * @param secrets the secrets, see `collectSecrets`
 * @returns the value, the value of a credential header masked unless it is empty or only
 * references variables
 */
function maskStoredHeaderValue(key: string, value: string, secrets: ReadonlySet<string>): string {
  if (!isCredentialHeader(key)) return maskIfSecret(value, secrets);
  return value === '' || referencesOnlyVariables(value) ? value : MASK;
}

/**
 * Masks the secrets in a request as it is stored, with its `{{variables}}`: the credentials of
 * its authorization, the values of credential headers that do not only reference variables, and
 * URL parts, header values and form data texts that are a secret.
 * @param request the request
 * @param secrets the secrets, see `collectSecrets`
 */
export function redactRequest(request: TrufosRequest, secrets: ReadonlySet<string>): TrufosRequest {
  const { body } = request;
  return {
    ...request,
    url: redactTrufosUrl(request.url, secrets),
    headers: request.headers.map((header) => ({
      ...header,
      value: maskStoredHeaderValue(header.key, header.value, secrets),
    })),
    body:
      body.type === RequestBodyType.FORM_DATA
        ? {
            ...body,
            fields: body.fields.map((field) =>
              field.value.type === RequestBodyType.TEXT && field.value.text != null
                ? {
                    ...field,
                    value: { ...field.value, text: maskIfSecret(field.value.text, secrets) },
                  }
                : field
            ),
          }
        : body,
    auth: request.auth && maskAuthorization(request.auth),
  };
}

/**
 * Restores a value a client sent back masked.
 * @param value the value the client sent
 * @param stored the value stored at the same place, undefined if there is none
 * @param label names the value in the error, e.g. `path segment 2`
 * @returns the value, or the stored value if the value is {@link MASK}
 * @throws if the value is masked but there is no stored value
 */
function restoreValue(value: string, stored: string | undefined, label: string): string {
  if (value !== MASK) return value;
  if (stored == null) {
    throw new Error(
      `The ${label} is the masked value ${MASK}, but the request has no stored value for it. ` +
        'Pass the real value or a `{{variable}}` instead.'
    );
  }
  return stored;
}

/**
 * Restores values whose key may repeat, e.g. headers, see {@link restoreValue}. Each stored value
 * is used once, so values with the same key keep their order.
 * @param label names the kind of value in the error, e.g. `header`
 * @param stored the stored values with their keys, undefined if the stored item has no value
 * @returns restores a value a client sent, given its key
 */
function takeStored(
  label: string,
  stored: [key: string, value: string | undefined][]
): (key: string, value: string) => string {
  const remaining = [...stored];
  return (key, value) => {
    // taken for unmasked values too, so the n-th value of a key pairs with its n-th stored value
    const index = remaining.findIndex(([storedKey]) => storedKey === key);
    const storedValue = index === -1 ? undefined : remaining.splice(index, 1)[0][1];
    return restoreValue(value, storedValue, `${label} ${key}`);
  };
}

/** The inverse of {@link redactTrufosUrl}: path segments by position, query values by key. */
function restoreUrl({ base, query }: TrufosURL, stored: TrufosURL): TrufosURL {
  const segments = base.split('/');
  const storedBase = stored.base.split('/');
  // positions only match if the number of segments does
  const storedSegments = segments.length === storedBase.length ? storedBase : [];
  const queryValue = takeStored(
    'query parameter',
    stored.query.map(({ key, value }) => [key, value])
  );
  return {
    base: segments
      .map((value, index) =>
        restoreValue(value, storedSegments[index], `path segment ${index + 1}`)
      )
      .join('/'),
    query: query.map((parameter) =>
      parameter.value == null
        ? parameter
        : { ...parameter, value: queryValue(parameter.key, parameter.value) }
    ),
  };
}

/** The inverse of the header masking of {@link redactRequest}. */
function restoreHeaders(headers: TrufosHeader[], stored: TrufosHeader[]): TrufosHeader[] {
  const headerValue = takeStored(
    'header',
    stored.map(({ key, value }) => [normalizeHeaderKey(key), value])
  );
  return headers.map((header) => ({
    ...header,
    value: headerValue(normalizeHeaderKey(header.key), header.value),
  }));
}

/** The inverse of the form data masking of {@link redactRequest}. */
function restoreBody(body: RequestBody, stored: RequestBody): RequestBody {
  if (body.type !== RequestBodyType.FORM_DATA) return body;
  const storedFields = stored.type === RequestBodyType.FORM_DATA ? stored.fields : [];
  const fieldText = takeStored(
    'form data field',
    storedFields.map(({ key, value }) => [
      key,
      value.type === RequestBodyType.TEXT ? value.text : undefined,
    ])
  );
  return {
    ...body,
    fields: body.fields.map((field) =>
      field.value.type === RequestBodyType.TEXT && field.value.text != null
        ? { ...field, value: { ...field.value, text: fieldText(field.key, field.value.text) } }
        : field
    ),
  };
}

/** The inverse of {@link maskAuthorization}, if the stored authorization has the same type. */
function restoreAuthorization(
  auth: AuthorizationInformation,
  stored: AuthorizationInformation | undefined
): AuthorizationInformation {
  const credentials = stored?.type === auth.type ? getCredentials(stored) : undefined;
  return mapCredentials(auth, (value, field) =>
    restoreValue(value, credentials?.get(field), field)
  );
}

/**
 * Restores the values a client sent back masked, the inverse of {@link redactRequest}: a value
 * {@link MASK} keeps the value stored at the same place. Headers, query parameters and form data
 * fields are matched by their key, path segments by their position and credentials by their field.
 * @param changes the changes a client sent
 * @param stored the request as it is stored
 * @returns the changes with the stored values
 * @throws if a value is masked but there is no stored value for it
 */
export function restoreMaskedChanges(
  changes: RequestChanges,
  stored: TrufosRequest
): RequestChanges {
  const { url, headers, body, auth } = changes;
  return {
    ...changes,
    url: url && restoreUrl(url, stored.url),
    headers: headers && restoreHeaders(headers, stored.headers),
    body: body && restoreBody(body, stored.body),
    auth: auth && restoreAuthorization(auth, stored.auth),
  };
}

/**
 * Masks the secrets in a request as it was sent, with all variables resolved: the values of
 * credential headers completely, and URL parts and other header values that are a secret.
 * @param request the sent request
 * @param secrets the secrets, see `collectSecrets`
 */
export function redactSentRequest(request: SentRequest, secrets: ReadonlySet<string>): SentRequest {
  const headers: HttpHeaders = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (value == null) continue;
    const mask = (v: string) => (isCredentialHeader(key) ? MASK : maskIfSecret(v, secrets));
    headers[key] = Array.isArray(value) ? value.map(mask) : mask(value);
  }
  return { ...request, url: redactUrl(request.url, secrets), headers };
}

/**
 * Masks every occurrence of a secret in free text, e.g. a script or its output. URL-encoded
 * secrets are masked as well.
 * @param text the text
 * @param secrets the secrets, see `collectSecrets`
 * @returns the text with every secret replaced with {@link MASK}
 */
export function maskSecretsInText(text: string, secrets: ReadonlySet<string>): string {
  const variants = new Set<string>();
  for (const secret of secrets) variants.add(secret).add(encodeURIComponent(secret));
  // the longest first, so a secret that contains another one is masked as a whole
  let masked = text;
  for (const variant of [...variants].sort((a, b) => b.length - a.length)) {
    masked = masked.split(variant).join(MASK);
  }
  return masked;
}

/**
 * Masks the secrets in a value a script logged, see {@link maskSecretsInText}. Strings are masked,
 * also inside arrays and plain objects; any other value stays as it is.
 * @param value the logged value
 * @param secrets the secrets, see `collectSecrets`
 * @param seen the arrays and objects masked so far, so a circular reference ends
 */
function maskLoggedValue(
  value: unknown,
  secrets: ReadonlySet<string>,
  seen = new WeakSet<object>()
): unknown {
  if (typeof value === 'string') return maskSecretsInText(value, secrets);
  if (typeof value !== 'object' || value == null) return value;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => maskLoggedValue(item, secrets, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      maskSecretsInText(key, secrets),
      maskLoggedValue(item, secrets, seen),
    ])
  );
}

/**
 * Masks the secrets in a history entry: in its URL and sent request, see {@link redactSentRequest},
 * and in the output of its scripts, see {@link maskSecretsInText}.
 * @param entry the history entry
 * @param secrets the secrets, see `collectSecrets`. These include the secrets the request was
 * sent with, which may have been changed or removed since.
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
      args: log.args.map((arg) => maskLoggedValue(arg, secrets)),
    })),
  };
}
