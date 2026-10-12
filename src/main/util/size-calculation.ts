import { IncomingHttpHeaders } from 'undici/types/header';
import { ResponseSize } from 'shim/objects/response';

/**
 * Calculate the size of the response in bytes.
 * @param headers response headers
 * @param bodySize the actual size of the response body in bytes, if it was stored
 */
export function calculateResponseSize(
  headers: IncomingHttpHeaders,
  bodySize?: number
): ResponseSize {
  const headersSizeInBytes = calculateHeadersSize(headers);
  const bodySizeInBytes = calculateBodySize(headers, bodySize);
  const totalSizeInBytes = bodySizeInBytes + headersSizeInBytes;
  return { totalSizeInBytes, headersSizeInBytes, bodySizeInBytes };
}

function calculateHeadersSize(headers: IncomingHttpHeaders) {
  const NEW_LINE_SIZE = 2;
  const COLON_SIZE = 1;
  const SPACE_SIZE = 1;
  const COMMA_SIZE = 1;
  return Object.entries(headers).reduce((size, [key, values]) => {
    let valuesSize;
    if (Array.isArray(values)) {
      valuesSize = values.reduce(
        (valueSizeTmp, value) => valueSizeTmp + value.length + COMMA_SIZE + SPACE_SIZE,
        -(COMMA_SIZE + SPACE_SIZE)
      );
    } else {
      valuesSize = values!.length;
    }
    return size + key.length + valuesSize + COLON_SIZE + SPACE_SIZE + NEW_LINE_SIZE;
  }, 0);
}

function calculateBodySize(headers: IncomingHttpHeaders, bodySize?: number) {
  if (bodySize != null) {
    return bodySize;
  }

  const contentLength = headers['content-length'];
  if (contentLength != null && typeof contentLength === 'string') {
    return parseInt(contentLength);
  }

  return 0;
}
