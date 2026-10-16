import { describe, it, expect } from 'vitest';
import {
  AuthorizationInformation,
  AuthorizationType,
  createDefaultAuthorization,
  OAuth1Method,
  OAuth2Method,
} from './auth';

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

describe('createDefaultAuthorization', () => {
  it.each(DEFAULTS)('creates a valid default for %s (method %s)', (type, method) => {
    const auth = createDefaultAuthorization(type, method);

    expect(AuthorizationInformation.safeParse(auth).success).toBe(true);
    expect(auth.type).toBe(type);
    if (method != null) expect(auth).toHaveProperty('method', method);
  });

  it('fills every field, so the form does not fill them one by one', () => {
    expect(createDefaultAuthorization(AuthorizationType.OAUTH1)).toEqual({
      type: AuthorizationType.OAUTH1,
      method: OAuth1Method.EXISTING_TOKEN,
      consumerKey: '',
      consumerSecret: '',
      token: '',
      tokenSecret: '',
      signatureMethod: 'HMAC-SHA1',
      realm: '',
    });
  });
});

describe('createDefaultAuthorization with an unknown method', () => {
  it('throws', () => {
    expect(() => createDefaultAuthorization(AuthorizationType.OAUTH2, 'unknown')).toThrow();
  });
});
