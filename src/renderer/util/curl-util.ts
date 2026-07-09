import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { AuthorizationType } from 'shim/objects/auth';
import { TrufosURL } from 'shim/objects/url';

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
  return encodeURIComponent(value).replaceAll('%7B', '{').replaceAll('%7D', '}');
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

/**
 * Builds the `Authorization` header value for auth types that can be resolved
 * synchronously without any network I/O. OAuth1/OAuth2/inherited auth need a
 * token exchange or a parent lookup and are intentionally left unresolved.
 */
function buildAuthHeader(auth: TrufosRequest['auth']): string | undefined {
  switch (auth?.type) {
    case AuthorizationType.BEARER:
      return `Bearer ${auth.token}`;
    case AuthorizationType.BASIC:
      return `Basic ${btoa(`${auth.username}:${auth.password}`)}`;
    default:
      return undefined;
  }
}

/**
 * Builds a cURL command for the given request. Template variables (`{{...}}`)
 * are kept unresolved so the command stays portable and does not leak secrets.
 * @param request The request to convert.
 * @param textBody The content of the request body file, if the request has a
 * text body. Callers load it separately because it is stored on disk.
 * @returns The cURL command, one option per line.
 */
export function buildCurlCommand(request: TrufosRequest, textBody?: string): string {
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
