export enum AuthenticationType {
  BEARER = 'bearer',
  BASIC = 'basic',
  INHERIT = 'inherit',
}

export type BearerAuthenticationInformation = {
  type: AuthenticationType.BEARER;
  token: string;
};

export type BasicAuthenticationInformation = {
  type: AuthenticationType.BASIC;
  username: string;
  password: string;
};

export type AuthenticationInformation =
  | BearerAuthenticationInformation
  | BasicAuthenticationInformation;
