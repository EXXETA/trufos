import { OAuth2AuthorizationInformation } from './oauth2';

export enum AuthorizationType {
  BEARER = 'bearer',
  BASIC = 'basic',
  INHERIT = 'inherit',
  OAUTH2 = 'oauth2',
}

export type BearerAuthorizationInformation = {
  type: AuthorizationType.BEARER;
  token: string;
};

export type BasicAuthorizationInformation = {
  type: AuthorizationType.BASIC;
  username: string;
  password: string;
};

export type InheritAuthorizationInformation = {
  type: AuthorizationType.INHERIT;
};

export type AuthorizationInformation =
  | InheritAuthorizationInformation
  | BearerAuthorizationInformation
  | BasicAuthorizationInformation
  | OAuth2AuthorizationInformation;
