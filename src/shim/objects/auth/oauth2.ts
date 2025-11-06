import { TokenEndpointResponse } from 'openid-client';
import { AuthorizationType } from '.';
import z from 'zod';

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

export const OAuth2ClientCrentialsAuthorizationInformation =
  Oauth2BaseAuthorizationInformation.extend({
    method: z.literal(OAuth2Method.CLIENT_CREDENTIALS),
  });
export type OAuth2ClientCrentialsAuthorizationInformation = z.infer<
  typeof OAuth2ClientCrentialsAuthorizationInformation
>;

const OAuth2ClientAuthorizationCodeFlowInformation = Oauth2BaseAuthorizationInformation.extend({
  authorizationUrl: z.string(),
  callbackUrl: z.string(),
  /** Generated if not provided */
  state: z.string().optional(),
  /** Default: true. Whether to keep browser session cache */
  cache: z.boolean().optional(),
});
type OAuth2ClientAuthorizationCodeFlowInformation = z.infer<
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
