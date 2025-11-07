import z from 'zod';
import { OAuth2AuthorizationInformation } from './oauth2';

export enum AuthorizationType {
  BEARER = 'bearer',
  BASIC = 'basic',
  INHERIT = 'inherit',
  OAUTH2 = 'oauth2',
}

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

export const InheritAuthorizationInformation = z.object({
  type: z.literal(AuthorizationType.INHERIT),
});
export type InheritAuthorizationInformation = z.infer<typeof InheritAuthorizationInformation>;

export const AuthorizationInformationNoInherit = z.discriminatedUnion('type', [
  BearerAuthorizationInformation,
  BasicAuthorizationInformation,
  OAuth2AuthorizationInformation,
]);
export type AuthorizationInformationNoInherit = z.infer<typeof AuthorizationInformationNoInherit>;

export const AuthorizationInformation = z.discriminatedUnion('type', [
  AuthorizationInformationNoInherit,
  InheritAuthorizationInformation,
]);
export type AuthorizationInformation = z.infer<typeof AuthorizationInformation>;
