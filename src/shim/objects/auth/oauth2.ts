import { TokenEndpointResponse } from 'openid-client';
import { AuthorizationType } from '.';

export enum OAuth2Method {
  CLIENT_CREDENTIALS = 'client-credentials',
  AUTHORIZATION_CODE = 'authorization-code',
  AUTHORIZATION_CODE_PKCE = 'authorization-code-pkce',
}

export enum OAuth2ClientAuthenticationMethod {
  BASIC_AUTH = 'basic-auth',
  REQUEST_BODY = 'request-body',
}

export interface Oauth2BaseAuthorizationInformation<T extends OAuth2Method> {
  type: AuthorizationType.OAUTH2;
  method: T;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scope: string;
  clientAuthenticationMethod: OAuth2ClientAuthenticationMethod;

  // not configurable
  tokens?: TokenEndpointResponse;
}

export interface OAuth2ClientCrentialsAuthorizationInformation extends Oauth2BaseAuthorizationInformation<OAuth2Method.CLIENT_CREDENTIALS> {}

export interface OAuth2ClientAuthorizationCodeFlowInformation<
  T extends OAuth2Method = OAuth2Method.AUTHORIZATION_CODE,
> extends Oauth2BaseAuthorizationInformation<T> {
  authorizationUrl: string;
  callbackUrl: string;
  state?: string; // generated if not provided
  cache?: boolean; // whether to keep browser session cache
}

export enum OAuth2PKCECodeChallengeMethod {
  S256 = 'S256',
  PLAIN = 'plain',
}

export interface OAuth2ClientAuthorizationCodeFlowPKCEInformation extends OAuth2ClientAuthorizationCodeFlowInformation<OAuth2Method.AUTHORIZATION_CODE_PKCE> {
  method: OAuth2Method.AUTHORIZATION_CODE_PKCE;
  codeChallengeMethod: OAuth2PKCECodeChallengeMethod;
  codeVerifier?: string; // generated if not provided
}

export type OAuth2AuthorizationInformation =
  | OAuth2ClientCrentialsAuthorizationInformation
  | OAuth2ClientAuthorizationCodeFlowInformation
  | OAuth2ClientAuthorizationCodeFlowPKCEInformation;
