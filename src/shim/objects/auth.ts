export enum AuthorizationType {
  BEARER = 'bearer',
  BASIC = 'basic',
  INHERIT = 'inherit',
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
  | BasicAuthorizationInformation;
