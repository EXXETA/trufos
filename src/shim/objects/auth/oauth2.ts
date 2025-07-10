import { TokenEndpointResponse } from 'openid-client';
import { AuthorizationType } from '.';

export enum OAuth2Method {
  CLIENT_CREDENTIALS = 'client-credentials',
  AUTHORIZATION_CODE = 'authorization-code',
}

export enum OAuth2ClientAuthenticationMethod {
  BASIC_AUTH = 'basic-auth',
  REQUEST_BODY = 'request-body',
}

export type OAuth2ClientCrentialsAuthorizationInformation = {
  type: AuthorizationType.OAUTH2;
  method: OAuth2Method.CLIENT_CREDENTIALS;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scope: string;
  clientAuthenticationMethod: OAuth2ClientAuthenticationMethod;

  // not configurable
  tokens?: TokenEndpointResponse;
};

export type OAuth2AuthorizationInformation = OAuth2ClientCrentialsAuthorizationInformation;
