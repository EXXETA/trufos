export function getHttpStatusColorClass(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) {
    return 'success';
  }
  if (statusCode >= 300) {
    return 'error';
  }
  return 'neutral';
}

export function getDurationTextInSec(durationMs: number) {
  return `${(durationMs / 1000).toFixed(2)} s`;
}

export function getHttpStatusText(statusCode: number) {
  if (!(statusCode in HTTP_STATUS_NAME)) {
    return statusCode.toString();
  }
  const statusKey = statusCode as keyof typeof HTTP_STATUS_NAME;
  return `${statusCode} ${HTTP_STATUS_NAME[statusKey]}`;
}

export function getSizeText(sizeInByte: number) {
  const units = ['', 'K', 'M', 'G', 'T'];
  let size = sizeInByte;

  let i = 0;
  for (; i < units.length && size >= 1e3; i++) {
    size /= 1e3;
  }

  const sizeWithDigits = i == 0 ? size : size.toFixed(2);

  return `${sizeWithDigits} ${units[i]}B`;
}

const HTTP_STATUS_NAME = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  306: 'Unused',
  307: 'Temporary Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Required',
  413: 'Request Entry Too Large',
  414: 'Request-URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Requested Range Not Satisfiable',
  417: 'Expectation Failed',
  418: 'I\'m a teapot',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
};