import { IncomingHttpHeaders } from 'undici/types/header';
import { ResponseSize } from 'shim/objects/response';
import fs from 'node:fs';

/**
 * Calculate the size of the response in bytes.
 * @param headers response headers
 * @param filePath path to the response body file
 */
export function calculateResponseSize(headers: IncomingHttpHeaders, filePath?: string): ResponseSize {
  const headersSizeInBytes = calculateHeadersSize(headers);
  const bodySizeInBytes = calculateBodySize(headers, filePath);
  const totalSizeInBytes = bodySizeInBytes + headersSizeInBytes;
  return { totalSizeInBytes, headersSizeInBytes, bodySizeInBytes };
}

function calculateHeadersSize(headers: IncomingHttpHeaders) {
  const NEW_LINE_SIZE = 2;
  const COLON_SIZE = 1;
  const SPACE_SIZE = 1;
  const COMMA_SIZE = 1;
  return Object.entries(headers).reduce(
    (size, [key, values]) => {
      let valuesSize;
      if (Array.isArray(values)) {
        valuesSize = values.reduce((valueSizeTmp, value) => valueSizeTmp + value.length + COMMA_SIZE + SPACE_SIZE, -(COMMA_SIZE + SPACE_SIZE));
      } else {
        valuesSize = values.length;
      }
      return size + key.length + valuesSize + COLON_SIZE + SPACE_SIZE + NEW_LINE_SIZE;
    }, 0);
}

function calculateBodySize(headers: IncomingHttpHeaders, filePath?: string) {
  const contentLength = headers['content-length'];
  if (contentLength != null && typeof contentLength === 'string') {
    return parseInt(contentLength);
  }

  if (filePath == null) return 0;

  return fs.statSync(filePath).size;
}