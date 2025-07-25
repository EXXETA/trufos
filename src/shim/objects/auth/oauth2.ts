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

export type Oauth2BaseAuthorizationInformation = {
  type: AuthorizationType.OAUTH2;
  method: OAuth2Method;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scope: string;
  clientAuthenticationMethod: OAuth2ClientAuthenticationMethod;

  // not configurable
  tokens?: TokenEndpointResponse;
};

export type OAuth2ClientCrentialsAuthorizationInformation = Oauth2BaseAuthorizationInformation & {
  method: OAuth2Method.CLIENT_CREDENTIALS;
};

export type OAuth2ClientAuthorizationCodeFlowInformation = Oauth2BaseAuthorizationInformation & {
  method: OAuth2Method.AUTHORIZATION_CODE;
  authorizationUrl: string;
  redirectUri: string;
  state?: string; // generated if not provided
};

export enum OAuth2PKCECodeChallengeMethod {
  S256 = 'S256',
  PLAIN = 'plain',
}

export type OAuth2ClientAuthorizationCodeFlowPKCEInformation =
  OAuth2ClientAuthorizationCodeFlowInformation & {
    method: OAuth2Method.AUTHORIZATION_CODE_PKCE;
    authorizationUrl: string;
    redirectUri: string;
    codeChallengeMethod: OAuth2PKCECodeChallengeMethod;
    codeVerifier?: string; // generated if not provided
  };

export type OAuth2AuthorizationInformation =
  | OAuth2ClientCrentialsAuthorizationInformation
  | OAuth2ClientAuthorizationCodeFlowInformation
  | OAuth2ClientAuthorizationCodeFlowPKCEInformation;
