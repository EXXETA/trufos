import { FormDataBody, RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { AuthorizationType } from 'shim/objects/auth';
import { TrufosURL } from 'shim/objects/url';

type VariableResolver = (value: string) => Promise<string>;
type CurlRequest = Omit<TrufosRequest, 'body'> & { body?: RequestBody | null };

export interface ResolvedCurlRequest {
  request: CurlRequest;
  textBody?: string;
}

/**
 * Quotes a value for a POSIX shell using single quotes (`'` becomes `'\''`).
 */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/**
 * Percent-encodes a URL component while keeping `{{...}}` template variables
 * readable, so the generated URL is valid but the placeholders stay
 * unresolved and recognizable. `{` and `}` are the only characters this needs
 * to restore after encoding, since `encodeURIComponent` escapes them too.
 */
function encodeUrlComponent(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replaceAll('%7B', '{')
    .replaceAll('%7D', '}');
}

/**
 * Builds a percent-encoded URL for use in a cURL command. Unlike `buildUrl`,
 * this encodes query keys/values so reserved characters (spaces, `!`, `'`, ...)
 * don't produce a URL that curl rejects.
 */
function buildCurlUrl({ base, query }: TrufosURL): string {
  const activeQuery = query.filter((q) => q.isActive);
  if (activeQuery.length === 0) return base;

  const params = activeQuery
    .map(({ key, value }) =>
      value == null
        ? encodeUrlComponent(key)
        : `${encodeUrlComponent(key)}=${encodeUrlComponent(value)}`
    )
    .join('&');
  return `${base}?${params}`;
}

async function resolveOptional(
  value: string | undefined,
  resolveVariables: VariableResolver
): Promise<string | undefined> {
  return value == null ? undefined : await resolveVariables(value);
}

async function resolveCurlUrl(
  { base, query }: TrufosURL,
  resolveVariables: VariableResolver
): Promise<TrufosURL> {
  return {
    base: await resolveVariables(base),
    query: await Promise.all(
      query.map(async (queryParam) => ({
        ...queryParam,
        key: await resolveVariables(queryParam.key),
        value: await resolveOptional(queryParam.value, resolveVariables),
      }))
    ),
  };
}

async function resolveCurlBody(
  body: RequestBody | null | undefined,
  resolveVariables: VariableResolver
): Promise<RequestBody | null | undefined> {
  if (body == null) return body;

  switch (body.type) {
    case RequestBodyType.TEXT:
      return {
        ...body,
        text: await resolveOptional(body.text, resolveVariables),
        mimeType: await resolveVariables(body.mimeType),
      };
    case RequestBodyType.FILE:
      return {
        ...body,
        filePath: await resolveOptional(body.filePath, resolveVariables),
        fileName: await resolveOptional(body.fileName, resolveVariables),
        mimeType: await resolveOptional(body.mimeType, resolveVariables),
      };
    case RequestBodyType.FORM_DATA:
      return {
        ...body,
        fields: await Promise.all(
          body.fields.map(async (field) => {
            return {
              ...field,
              key: await resolveVariables(field.key),
              value: await resolveFormDataValue(field.value, resolveVariables),
            };
          })
        ),
      };
  }
}

async function resolveFormDataValue(
  value: FormDataBody['fields'][number]['value'],
  resolveVariables: VariableResolver
): Promise<FormDataBody['fields'][number]['value']> {
  switch (value.type) {
    case RequestBodyType.TEXT:
      return {
        ...value,
        text: await resolveOptional(value.text, resolveVariables),
        mimeType: await resolveVariables(value.mimeType),
      };
    case RequestBodyType.FILE:
      return {
        ...value,
        filePath: await resolveOptional(value.filePath, resolveVariables),
        fileName: await resolveOptional(value.fileName, resolveVariables),
        mimeType: await resolveOptional(value.mimeType, resolveVariables),
      };
  }
}

async function resolveCurlAuth(
  auth: TrufosRequest['auth'],
  resolveVariables: VariableResolver
): Promise<TrufosRequest['auth']> {
  switch (auth?.type) {
    case AuthorizationType.BEARER:
      return { ...auth, token: await resolveVariables(auth.token) };
    case AuthorizationType.BASIC:
      return {
        ...auth,
        username: await resolveVariables(auth.username),
        password: await resolveVariables(auth.password),
      };
    default:
      return auth;
  }
}

/**
 * Resolves template variables in request fields before building a cURL command.
 * Resolution is provided by the main process so it uses the selected environment,
 * collection variables, and system variables in the same precedence as sending.
 */
export async function resolveCurlCommandVariables(
  request: CurlRequest,
  textBody: string | undefined,
  resolveVariables: VariableResolver
): Promise<ResolvedCurlRequest> {
  const body = await resolveCurlBody(request.body, resolveVariables);

  return {
    request: {
      ...request,
      url: await resolveCurlUrl(request.url, resolveVariables),
      headers: await Promise.all(
        request.headers.map(async (header) => ({
          ...header,
          key: await resolveVariables(header.key),
          value: await resolveVariables(header.value),
        }))
      ),
      body,
      auth: await resolveCurlAuth(request.auth, resolveVariables),
    },
    textBody: await resolveOptional(textBody, resolveVariables),
  };
}

/**
 * Builds the `Authorization` header value for auth types that can be resolved
 * synchronously without any network I/O. OAuth1/OAuth2/inherited auth need a
 * token exchange or a parent lookup and are intentionally left unresolved.
 */
function buildAuthHeader(auth: TrufosRequest['auth']): string | undefined {
  switch (auth?.type) {
    case AuthorizationType.BEARER:
      return auth.token ? `Bearer ${auth.token}` : undefined;
    case AuthorizationType.BASIC:
      if (auth.username == null || auth.password == null) return undefined;
      return `Basic ${btoa(`${auth.username}:${auth.password}`)}`;
    default:
      return undefined;
  }
}

/**
 * Builds a cURL command for the given request.
 * @param request The request to convert.
 * @param textBody The content of the request body file, if the request has a
 * text body. Callers load it separately because it is stored on disk.
 * @returns The cURL command, one option per line.
 */
export function buildCurlCommand(request: CurlRequest, textBody?: string): string {
  const parts = [`curl -X ${request.method} ${shellQuote(buildCurlUrl(request.url))}`];

  const activeHeaders = request.headers.filter((header) => header.isActive);
  for (const header of activeHeaders) {
    parts.push(`-H ${shellQuote(`${header.key}: ${header.value}`)}`);
  }
  const hasContentType = activeHeaders.some(
    (header) => header.key.toLowerCase() === 'content-type'
  );
  const hasAuthHeader = activeHeaders.some(
    (header) => header.key.toLowerCase() === 'authorization'
  );

  if (!hasAuthHeader) {
    const authHeader = buildAuthHeader(request.auth);
    if (authHeader) {
      parts.push(`-H ${shellQuote(`Authorization: ${authHeader}`)}`);
    }
  }

  const { body } = request;
  switch (body?.type) {
    case RequestBodyType.TEXT:
      if (textBody) {
        if (!hasContentType && body.mimeType) {
          parts.push(`-H ${shellQuote(`Content-Type: ${body.mimeType}`)}`);
        }
        parts.push(`--data-raw ${shellQuote(textBody)}`);
      }
      break;
    case RequestBodyType.FILE:
      if (body.filePath) {
        if (!hasContentType && body.mimeType) {
          parts.push(`-H ${shellQuote(`Content-Type: ${body.mimeType}`)}`);
        }
        parts.push(`--data-binary ${shellQuote(`@${body.filePath}`)}`);
      }
      break;
    case RequestBodyType.FORM_DATA:
      for (const field of body.fields.filter((field) => field.isActive)) {
        if (field.value.type === RequestBodyType.FILE) {
          const path = field.value.filePath ?? field.value.fileName;
          if (!path) continue; // no file selected yet, nothing to attach
          parts.push(`-F ${shellQuote(`${field.key}=@${path}`)}`);
        } else {
          parts.push(`-F ${shellQuote(`${field.key}=${field.value.text ?? ''}`)}`);
        }
      }
      break;
  }

  return parts.join(' \\\n  ');
}
