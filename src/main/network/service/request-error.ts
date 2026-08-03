import { DisplayableError } from 'shim/error/DisplayableError';

/** Maps groups of Node.js/undici error codes to a user-friendly title and description. */
const ERROR_MAPPINGS: { codes: string[]; title: string; description: string }[] = [
  {
    codes: ['ENOTFOUND', 'EAI_AGAIN'],
    title: 'Host Not Found',
    description:
      'The host could not be resolved. Please check the URL and your internet connection.',
  },
  {
    codes: ['ECONNREFUSED'],
    title: 'Connection Refused',
    description:
      'The connection was refused. Please check that the server is running and reachable.',
  },
  {
    codes: ['ECONNRESET'],
    title: 'Connection Reset',
    description: 'The connection was reset by the server before the response was received.',
  },
  {
    codes: [
      'ETIMEDOUT',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT',
    ],
    title: 'Request Timed Out',
    description: 'The server did not respond in time. Please try again later.',
  },
  {
    codes: [
      'CERT_HAS_EXPIRED',
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'SELF_SIGNED_CERT_IN_CHAIN',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      'ERR_TLS_CERT_ALTNAME_INVALID',
    ],
    title: 'Certificate Error',
    description: "The server's TLS certificate could not be verified.",
  },
];

/** Read the `code` property from an error, falling back to its `cause`. Empty string if none. */
function getErrorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) return '';
  const { code, cause } = error as { code?: unknown; cause?: unknown };
  return typeof code === 'string' ? code : getErrorCode(cause);
}

/** Get a human-readable message from an unknown error value. */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error ?? '');
}

/**
 * Map an error thrown while sending an HTTP request to a user-friendly {@link DisplayableError}.
 * The original error is always preserved as the {@link DisplayableError.cause} for logging.
 *
 * @param error The error thrown by undici or the surrounding send logic.
 */
export function mapRequestError(error: unknown): DisplayableError {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  if (code === 'ERR_INVALID_URL' || message.toLowerCase().includes('invalid url')) {
    return new DisplayableError('The URL you entered is invalid.', 'Invalid URL', error);
  }

  const mapping = ERROR_MAPPINGS.find(({ codes }) => codes.includes(code));
  if (mapping != null) {
    return new DisplayableError(mapping.description, mapping.title, error);
  }

  return new DisplayableError(
    `The request could not be sent.${message ? ` ${message}` : ''}`,
    'Could not send Request',
    error
  );
}
