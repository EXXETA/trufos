import { TokenEndpointResponse } from 'openid-client';
import { AuthorizationType } from '.';

export enum OAuth2Method {
  CLIENT_CREDENTIALS = 'client-credentials',
  AUTHORIZATION_CODE = 'authorization-code',
}

export type OAuth2ClientCrentialsAuthorizationInformation = {
  type: AuthorizationType.OAUTH2;
  method: OAuth2Method.CLIENT_CREDENTIALS;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scope?: string;
  tokens?: TokenEndpointResponse;
};

export type OAuth2AuthorizationInformation = OAuth2ClientCrentialsAuthorizationInformation;
