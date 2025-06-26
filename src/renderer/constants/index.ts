export const COMMON_HEADERS = [
  'A-IM',
  'Accept',
  'Accept-Charset',
  'Accept-Datetime',
  'Accept-Encoding',
  'Accept-Language',
  'Access-Control-Request-Method',
  'Authorization',
  'Cache-Control',
  'Connection',
  'Content-Encoding',
  'Content-Length',
  'Content-MD5',
  'Content-Type',
  'Cookie',
  'Date',
  'Expect',
  'Forwarded',
  'From',
  'Host',
  'HTTP2-Settings',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'If-Range',
  'If-Unmodified-Since',
  'Max-Forwards',
  'Origin',
  'Pragma',
  'Prefer',
  'Proxy-Authorization',
  'Range',
  'Referer',
  'TE',
  'Trailer',
  'Transfer-Encoding',
  'User-Agent',
  'Upgrade',
  'Via',
  'Warning',
];

export const HEADER_VALUES: Record<string, string[]> = {
  Accept: ['application/json', 'application/xml', 'text/html', 'text/plain', '*/*'],
  'Accept-Encoding': ['gzip', 'compress', 'deflate', 'br', 'identity', '*'],
  'Accept-Charset': ['utf-8', 'iso-8859-1', 'windows-1251'],
  'Accept-Language': ['en-US', 'en-GB', 'fr-FR', 'de-DE', 'hi-IN'],

  Authorization: [
    'Bearer <token>',
    'Basic <base64-credentials>',
    'Digest username="user", realm="realm", nonce="...", uri="/", response="..."',
  ],

  'Cache-Control': ['no-cache', 'no-store', 'max-age=0', 'must-revalidate', 'public', 'private'],

  Connection: ['keep-alive', 'close'],

  'Content-Encoding': ['gzip', 'compress', 'deflate', 'identity', 'br'],
  'Content-Type': [
    'application/json',
    'application/xml',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
    'text/html',
    'application/octet-stream',
  ],

  Cookie: ['sessionId=abc123; token=xyz456'],

  Expect: ['100-continue'],

  Forwarded: ['for=192.0.2.43', 'proto=https', 'by=203.0.113.43'],
  From: ['user@example.com'],

  'If-Match': ['"etag-value"'],
  'If-None-Match': ['"etag-value"'],
  'If-Modified-Since': ['Wed, 21 Oct 2015 07:28:00 GMT'],
  'If-Unmodified-Since': ['Wed, 21 Oct 2015 07:28:00 GMT'],
  'If-Range': ['"etag-value"', 'Wed, 21 Oct 2015 07:28:00 GMT'],

  Origin: ['https://example.com'],

  Pragma: ['no-cache'],
  Prefer: ['respond-async'],

  Range: ['bytes=0-1023'],

  Referer: ['https://example.com/page'],

  TE: ['trailers', 'deflate'],
  Trailer: ['Expires', 'Content-MD5'],

  'Transfer-Encoding': ['chunked', 'compress', 'deflate', 'gzip'],

  'User-Agent': [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'curl/7.68.0',
    'PostmanRuntime/7.32.3',
  ],

  Upgrade: ['h2c', 'websocket'],
  Via: ['1.1 vegur', '1.0 example.com'],
  Warning: ['199 Miscellaneous warning'],

  Date: ['Wed, 21 Oct 2015 07:28:00 GMT'],

  'Max-Forwards': ['10', '20'],
  Host: ['example.com', 'api.example.com'],
  'Access-Control-Request-Method': ['GET', 'POST', 'PUT', 'DELETE'],
  'HTTP2-Settings': ['token=value'], // used in HTTP/2 pre-flight requests
  'Proxy-Authorization': ['Basic <base64-credentials>'],
};
