import { z } from 'zod';
import type { TokenEndpointResponse } from 'openid-client';

export enum AuthorizationType {
  BEARER = 'bearer',
  BASIC = 'basic',
  INHERIT = 'inherit',
  OAUTH2 = 'oauth2',
  OAUTH1 = 'oauth1',
}

export enum OAuth1SignatureMethod {
  HMAC_SHA1 = 'HMAC-SHA1',
  HMAC_SHA256 = 'HMAC-SHA256',
  PLAINTEXT = 'PLAINTEXT',
}

export enum OAuth1Method {
  /** Manual / two-legged: consumer-only, or a pre-issued access token pasted in. No browser. */
  EXISTING_TOKEN = 'existing-token',
  /** Interactive three-legged flow: obtain the access token via a browser login. */
  AUTHORIZATION = 'authorization',
}

export enum OAuth2Method {
  CLIENT_CREDENTIALS = 'client-credentials',
  AUTHORIZATION_CODE = 'authorization-code',
  AUTHORIZATION_CODE_PKCE = 'authorization-code-pkce',
}

export enum OAuth2ClientAuthenticationMethod {
  BASIC_AUTH = 'basic-auth',
  REQUEST_BODY = 'request-body',
}

export const Oauth2BaseAuthorizationInformation = z.object({
  type: z.literal(AuthorizationType.OAUTH2),
  method: z.enum(OAuth2Method),
  issuerUrl: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
  tokenUrl: z.string(),
  scope: z.string(),
  clientAuthenticationMethod: z.enum(OAuth2ClientAuthenticationMethod),

  /** To persist retrieved access tokens. Not configurable */
  tokens: z.object<TokenEndpointResponse>().optional(),
});
export type Oauth2BaseAuthorizationInformation = z.infer<typeof Oauth2BaseAuthorizationInformation>;

export const OAuth2ClientCrentialsAuthorizationInformation =
  Oauth2BaseAuthorizationInformation.extend({
    method: z.literal(OAuth2Method.CLIENT_CREDENTIALS),
  });
export type OAuth2ClientCrentialsAuthorizationInformation = z.infer<
  typeof OAuth2ClientCrentialsAuthorizationInformation
>;

export const OAuth2ClientAuthorizationCodeFlowInformation =
  Oauth2BaseAuthorizationInformation.extend({
    method: z.literal(OAuth2Method.AUTHORIZATION_CODE),
    authorizationUrl: z.string(),
    callbackUrl: z.string(),
    /** Generated if not provided */
    state: z.string().optional(),
    /** Default: true. Whether to keep browser session cache */
    cache: z.boolean().optional(),
  });
export type OAuth2ClientAuthorizationCodeFlowInformation = z.infer<
  typeof OAuth2ClientAuthorizationCodeFlowInformation
>;

export enum OAuth2PKCECodeChallengeMethod {
  S256 = 'S256',
  PLAIN = 'plain',
}

export const OAuth2ClientAuthorizationCodeFlowPKCEInformation =
  OAuth2ClientAuthorizationCodeFlowInformation.extend({
    method: z.literal(OAuth2Method.AUTHORIZATION_CODE_PKCE),
    codeChallengeMethod: z.enum(OAuth2PKCECodeChallengeMethod),
    /** Generated if not provided */
    codeVerifier: z.string().optional(),
  });
export type OAuth2ClientAuthorizationCodeFlowPKCEInformation = z.infer<
  typeof OAuth2ClientAuthorizationCodeFlowPKCEInformation
>;

export const OAuth2AuthorizationInformation = z.discriminatedUnion('method', [
  OAuth2ClientCrentialsAuthorizationInformation,
  OAuth2ClientAuthorizationCodeFlowInformation,
  OAuth2ClientAuthorizationCodeFlowPKCEInformation,
]);
export type OAuth2AuthorizationInformation = z.infer<typeof OAuth2AuthorizationInformation>;

export const BearerAuthorizationInformation = z.object({
  type: z.literal(AuthorizationType.BEARER),
  token: z.string(),
});
export type BearerAuthorizationInformation = z.infer<typeof BearerAuthorizationInformation>;

export const BasicAuthorizationInformation = z.object({
  type: z.literal(AuthorizationType.BASIC),
  username: z.string(),
  password: z.string(),
});
export type BasicAuthorizationInformation = z.infer<typeof BasicAuthorizationInformation>;

export const Oauth1BaseAuthorizationInformation = z.object({
  type: z.literal(AuthorizationType.OAUTH1),
  method: z.enum(OAuth1Method),
  consumerKey: z.string(),
  consumerSecret: z.string(),
  signatureMethod: z.enum(OAuth1SignatureMethod),
  /** Optional realm to include in the Authorization header. */
  realm: z.string().optional(),
});
export type Oauth1BaseAuthorizationInformation = z.infer<typeof Oauth1BaseAuthorizationInformation>;

export const OAuth1ExistingTokenAuthorizationInformation =
  Oauth1BaseAuthorizationInformation.extend({
    method: z.literal(OAuth1Method.EXISTING_TOKEN),
    /** Access token. Optional for two-legged (consumer-only) OAuth. */
    token: z.string().optional(),
    /** Access token secret. Optional for two-legged OAuth. */
    tokenSecret: z.string().optional(),
  });
export type OAuth1ExistingTokenAuthorizationInformation = z.infer<
  typeof OAuth1ExistingTokenAuthorizationInformation
>;

export const OAuth1AuthorizationFlowInformation = Oauth1BaseAuthorizationInformation.extend({
  method: z.literal(OAuth1Method.AUTHORIZATION),
  /** Temporary-credentials endpoint (RFC 5849 §2.1). */
  requestTokenUrl: z.string(),
  /** Resource-owner authorization endpoint opened in the browser (RFC 5849 §2.2). */
  authorizationUrl: z.string(),
  /** Token endpoint that exchanges the verifier for an access token (RFC 5849 §2.3). */
  accessTokenUrl: z.string(),
  /** Redirect URL intercepted in the browser to capture the oauth_verifier. */
  callbackUrl: z.string(),
});
export type OAuth1AuthorizationFlowInformation = z.infer<typeof OAuth1AuthorizationFlowInformation>;

export const OAuth1AuthorizationInformation = z.discriminatedUnion('method', [
  OAuth1ExistingTokenAuthorizationInformation,
  OAuth1AuthorizationFlowInformation,
]);
export type OAuth1AuthorizationInformation = z.infer<typeof OAuth1AuthorizationInformation>;

export const InheritAuthorizationInformation = z.object({
  type: z.literal(AuthorizationType.INHERIT),
});
export type InheritAuthorizationInformation = z.infer<typeof InheritAuthorizationInformation>;

export const AuthorizationInformationNoInherit = z.discriminatedUnion('type', [
  BearerAuthorizationInformation,
  BasicAuthorizationInformation,
  OAuth2AuthorizationInformation,
  OAuth1AuthorizationInformation,
]);
export type AuthorizationInformationNoInherit = z.infer<typeof AuthorizationInformationNoInherit>;

export const AuthorizationInformation = z.discriminatedUnion('type', [
  AuthorizationInformationNoInherit,
  InheritAuthorizationInformation,
]);
export type AuthorizationInformation = z.infer<typeof AuthorizationInformation>;

const OAUTH2_BASE = {
  type: AuthorizationType.OAUTH2,
  issuerUrl: '',
  clientId: '',
  clientSecret: '',
  tokenUrl: '',
  scope: '',
  clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
} as const;

const OAUTH2_DEFAULTS: { [M in OAuth2Method]: OAuth2AuthorizationInformation & { method: M } } = {
  [OAuth2Method.CLIENT_CREDENTIALS]: {
    ...OAUTH2_BASE,
    method: OAuth2Method.CLIENT_CREDENTIALS,
  },
  [OAuth2Method.AUTHORIZATION_CODE]: {
    ...OAUTH2_BASE,
    method: OAuth2Method.AUTHORIZATION_CODE,
    authorizationUrl: '',
    callbackUrl: '',
    state: '',
    cache: true,
  },
  [OAuth2Method.AUTHORIZATION_CODE_PKCE]: {
    ...OAUTH2_BASE,
    method: OAuth2Method.AUTHORIZATION_CODE_PKCE,
    authorizationUrl: '',
    callbackUrl: '',
    codeChallengeMethod: OAuth2PKCECodeChallengeMethod.S256,
    codeVerifier: '',
    state: '',
    cache: true,
  },
};

const OAUTH1_BASE = {
  type: AuthorizationType.OAUTH1,
  consumerKey: '',
  consumerSecret: '',
  signatureMethod: OAuth1SignatureMethod.HMAC_SHA1,
  realm: '',
} as const;

const OAUTH1_DEFAULTS: { [M in OAuth1Method]: OAuth1AuthorizationInformation & { method: M } } = {
  [OAuth1Method.EXISTING_TOKEN]: {
    ...OAUTH1_BASE,
    method: OAuth1Method.EXISTING_TOKEN,
    token: '',
    tokenSecret: '',
  },
  [OAuth1Method.AUTHORIZATION]: {
    ...OAUTH1_BASE,
    method: OAuth1Method.AUTHORIZATION,
    requestTokenUrl: '',
    authorizationUrl: '',
    accessTokenUrl: '',
    callbackUrl: '',
  },
};

/** Returns the OAuth method of an authorization, if it has one. */
export function getMethod(auth: object | undefined): string | undefined {
  return auth != null && 'method' in auth && typeof auth.method === 'string'
    ? auth.method
    : undefined;
}

function getDefault<T extends object>(defaults: Record<string, T>, method: string): T {
  const entry = Object.entries(defaults).find(([key]) => key === method);
  if (entry == null) throw new Error(`Unknown authorization method ${method}`);
  return { ...entry[1] };
}

/**
 * Creates a complete authorization of the given type with default values. Partial authorizations
 * are no valid {@link AuthorizationInformation}.
 * @param type the authorization type
 * @param method the OAuth method. Defaults to the first one.
 * @throws Error if the method does not exist for the type
 */
export function createDefaultAuthorization(
  type: AuthorizationType,
  method?: string
): AuthorizationInformation {
  switch (type) {
    case AuthorizationType.INHERIT:
      return { type };
    case AuthorizationType.BEARER:
      return { type, token: '' };
    case AuthorizationType.BASIC:
      return { type, username: '', password: '' };
    case AuthorizationType.OAUTH2:
      return getDefault(OAUTH2_DEFAULTS, method ?? OAuth2Method.CLIENT_CREDENTIALS);
    case AuthorizationType.OAUTH1:
      return getDefault(OAUTH1_DEFAULTS, method ?? OAuth1Method.EXISTING_TOKEN);
  }
}
