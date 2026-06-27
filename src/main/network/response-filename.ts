import mime from 'mime-types';

import type { HttpHeaders } from 'shim/headers';

function getHeaderValue(headers: HttpHeaders, key: string): string | undefined {
  const value = headers[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function sanitizeFilename(name: string): string {
  let sanitized = name.replace(/[/\\?%*:|"<>]/g, '_');
  sanitized = sanitized.replace(/\0/g, '');
  sanitized = sanitized.replace(/_+/g, '_');
  sanitized = sanitized.replace(/^[. ]+|[. ]+$/g, '');
  return sanitized || '_';
}

export function parseContentDispositionFilename(disposition: string): string | undefined {
  const starMatch = disposition.match(/filename\*=(?:UTF-8|ISO-8859-1)''([^;]+)/i);
  if (starMatch) {
    try {
      return sanitizeFilename(decodeURIComponent(starMatch[1]));
    } catch {
      return undefined;
    }
  }

  const plainMatch = disposition.match(/filename=["']?([^"';\r\n]+)["']?/i);
  if (plainMatch) {
    const name = plainMatch[1].trim();
    if (name) return sanitizeFilename(name);
  }
}

export function getSuggestedFilename(headers: HttpHeaders): string {
  const disposition = getHeaderValue(headers, 'content-disposition');
  if (disposition) {
    const parsed = parseContentDispositionFilename(disposition);
    if (parsed) return parsed;
  }

  const contentType = getHeaderValue(headers, 'content-type');
  if (contentType) {
    const ext = mime.extension(contentType);
    if (ext) return `response.${ext}`;
  }

  return 'response.bin';
}
