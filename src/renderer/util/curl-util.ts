import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { buildUrl } from 'shim/objects/url';

/**
 * Quotes a value for a POSIX shell using single quotes (`'` becomes `'\''`).
 */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
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
  const parts = [`curl -X ${request.method} ${shellQuote(buildUrl(request.url))}`];

  const activeHeaders = request.headers.filter((header) => header.isActive);
  for (const header of activeHeaders) {
    parts.push(`-H ${shellQuote(`${header.key}: ${header.value}`)}`);
  }
  const hasContentType = activeHeaders.some(
    (header) => header.key.toLowerCase() === 'content-type'
  );

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
        const value =
          field.value.type === RequestBodyType.FILE
            ? `@${field.value.filePath ?? field.value.fileName ?? ''}`
            : (field.value.text ?? '');
        parts.push(`-F ${shellQuote(`${field.key}=${value}`)}`);
      }
      break;
  }

  return parts.join(' \\\n  ');
}
