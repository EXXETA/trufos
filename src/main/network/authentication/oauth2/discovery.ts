import { allowInsecureRequests, ClientError, customFetch, discovery } from 'openid-client';
import Undici, { type Dispatcher } from 'undici';
import { z } from 'zod';
import { DisplayableError } from 'shim/error/DisplayableError';
import type { OAuth2Endpoints } from 'shim/event-service';
import { mapRequestError } from 'main/network/service/request-error';

const ERROR_TITLE = 'Discovery Failed';

/** `discovery()` requires a client ID, but does not send it. The form may not have one yet. */
const UNUSED_CLIENT_ID = 'trufos';

/** The part of the metadata of the server that is used. */
const ServerMetadata = z.object({
  token_endpoint: z.string(),
  authorization_endpoint: z.string().optional(),
});

/** The cause of the error of `discovery()` if the server reports another issuer. */
const IssuerMismatch = z.object({
  attribute: z.literal('issuer'),
  body: z.object({ issuer: z.string() }),
});

/**
 * Fetches the endpoints an authorization server publishes through OpenID Connect discovery.
 * @param issuerUrl the issuer URL, without variables
 * @param dispatcher the dispatcher to send the request to the server with
 * @throws DisplayableError if the endpoints cannot be discovered
 */
export async function discoverOAuth2Endpoints(
  issuerUrl: string,
  dispatcher: Dispatcher
): Promise<OAuth2Endpoints> {
  const server = parseIssuerUrl(issuerUrl);

  const configuration = await discovery(server, UNUSED_CLIENT_ID, undefined, undefined, {
    // deprecated only to stand out. Plain HTTP issuers are valid here, e.g. a local Keycloak
    execute: [allowInsecureRequests],
    [customFetch]: (url, init) => Undici.fetch(url, { ...init, dispatcher }),
  }).catch((error: unknown) => {
    throw toDisplayableError(error, issuerUrl);
  });

  const parsed = ServerMetadata.safeParse(configuration.serverMetadata());
  if (!parsed.success) {
    throw new DisplayableError(
      `The server of "${issuerUrl}" does not publish a valid token endpoint.`,
      ERROR_TITLE,
      parsed.error
    );
  }
  const { token_endpoint: tokenUrl, authorization_endpoint: authorizationUrl } = parsed.data;
  return { tokenUrl, authorizationUrl };
}

function parseIssuerUrl(issuerUrl: string): URL {
  const url = URL.parse(issuerUrl);
  if (url?.protocol !== 'http:' && url?.protocol !== 'https:') {
    throw new DisplayableError(
      `"${issuerUrl}" is not a valid HTTP or HTTPS URL.`,
      'Invalid Issuer URL'
    );
  }
  return url;
}

function toDisplayableError(error: unknown, issuerUrl: string): DisplayableError {
  if (!(error instanceof ClientError)) return mapRequestError(error); // e.g. the connection failed

  const mismatch = IssuerMismatch.safeParse(error.cause);
  if (mismatch.success) {
    return new DisplayableError(
      `The server reports the issuer "${mismatch.data.body.issuer}", which differs from the URL "${issuerUrl}".`,
      'Issuer Mismatch',
      error
    );
  }
  return new DisplayableError(
    `Could not read the OpenID Connect metadata of "${issuerUrl}": ${error.message}.`,
    ERROR_TITLE,
    error
  );
}
