import { describe, it, expect } from 'vitest';
import {
  AuthorizationInformation,
  AuthorizationType,
  OAuth1Method,
  OAuth2Method,
} from 'shim/objects/auth';
import { createDefaultAuthorization, getMethod } from '@/state/helper/authorization';
import { getAuthorizationForm } from './forms';

const DEFAULTS: [AuthorizationType, string | undefined][] = [
  [AuthorizationType.INHERIT, undefined],
  [AuthorizationType.BEARER, undefined],
  [AuthorizationType.BASIC, undefined],
  [AuthorizationType.OAUTH2, undefined],
  ...Object.values(OAuth2Method).map((method): [AuthorizationType, string] => [
    AuthorizationType.OAUTH2,
    method,
  ]),
  [AuthorizationType.OAUTH1, undefined],
  ...Object.values(OAuth1Method).map((method): [AuthorizationType, string] => [
    AuthorizationType.OAUTH1,
    method,
  ]),
];

describe('getAuthorizationForm', () => {
  it.each(DEFAULTS)('has only fields that the default of %s (method %s) has', (type, method) => {
    const auth = AuthorizationInformation.parse(createDefaultAuthorization(type, method));
    const keys = Object.entries(getAuthorizationForm(type, getMethod(auth)))
      .filter(([, field]) => field.type !== 'label')
      .map(([key]) => key);

    expect(keys.filter((key) => !(key in auth))).toEqual([]);
  });
});
