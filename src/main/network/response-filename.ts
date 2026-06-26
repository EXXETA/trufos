const MIME_EXTENSIONS: Record<string, string> = {
  'application/json': '.json',
  'application/vnd.api+json': '.json',
  'text/html': '.html',
  'text/plain': '.txt',
  'text/css': '.css',
  'text/javascript': '.js',
  'application/javascript': '.js',
  'text/xml': '.xml',
  'application/xml': '.xml',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'application/gzip': '.gz',
  'application/x-tar': '.tar',
  'application/x-bzip2': '.bz2',
  'application/x-www-form-urlencoded': '.txt',
  'application/octet-stream': '.bin',
  'multipart/form-data': '.txt',
};

type HeadersInput = Record<string, string | string[] | undefined>;

function getHeaderValue(headers: HeadersInput, key: string): string | undefined {
  const actualKey = Object.keys(headers).find((k) => k.toLowerCase() === key.toLowerCase());
  if (!actualKey) return undefined;
  const value = headers[actualKey];
  if (value === undefined) return undefined;
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
  const parts = disposition.split(';').map((s) => s.trim());

  for (const part of parts) {
    if (part.startsWith('filename*=')) {
      const value = part.slice('filename*='.length);
      const match = value.match(/^(?:UTF-8|ISO-8859-1)''(.+)$/i);
      if (match) {
        try {
          return sanitizeFilename(decodeURIComponent(match[1]));
        } catch {
          return undefined;
        }
      }
    }
  }

  for (const part of parts) {
    if (part.startsWith('filename=')) {
      const value = part.slice('filename='.length);
      const name = value.replace(/^["']|["']$/g, '').trim();
      if (name) return sanitizeFilename(name);
    }
  }

  return undefined;
}

export function getSuggestedFilename(headers: HeadersInput): string {
  const disposition = getHeaderValue(headers, 'content-disposition');
  if (disposition) {
    const parsed = parseContentDispositionFilename(disposition);
    if (parsed) return parsed;
  }

  const contentType = getHeaderValue(headers, 'content-type');
  if (contentType) {
    const mime = contentType.split(';')[0].trim();
    const ext = MIME_EXTENSIONS[mime] ?? '.bin';
    return `response${ext}`;
  }

  return 'response.bin';
}
