import { describe, it, expect } from 'vitest';
import {
  AuthorizationInformation,
  AuthorizationType,
  OAuth1Method,
  OAuth2Method,
} from 'shim/objects/auth';
import {
  applyAuthorizationChange,
  createDefaultAuthorization,
  getAuthorizationForm,
} from './forms';

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

  it.each(DEFAULTS)('keeps every form field of %s (method %s) in the schema', (type, method) => {
    const auth = AuthorizationInformation.parse(createDefaultAuthorization(type, method));
    const keys = Object.entries(getAuthorizationForm(type, method))
      .filter(([, field]) => field.type !== 'label')
      .map(([key]) => key);

    expect(keys.filter((key) => !(key in auth))).toEqual([]);
  });

  it('fills every field of the form, so the form does not fill them one by one', () => {
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

describe('applyAuthorizationChange', () => {
  it('starts from the default of the new type', () => {
    expect(applyAuthorizationChange(undefined, { type: AuthorizationType.BEARER })).toEqual({
      type: AuthorizationType.BEARER,
      token: '',
    });
  });

  it('merges a change of a field', () => {
    const basic = createDefaultAuthorization(AuthorizationType.BASIC);

    expect(applyAuthorizationChange(basic, { password: 'secret' })).toEqual({
      type: AuthorizationType.BASIC,
      username: '',
      password: 'secret',
    });
  });

  it('keeps the shared fields when the method changes', () => {
    const oauth = applyAuthorizationChange(createDefaultAuthorization(AuthorizationType.OAUTH2), {
      clientId: 'client',
      tokens: { access_token: 'a', token_type: 'bearer' },
    });

    const changed = applyAuthorizationChange(oauth, {
      method: OAuth2Method.AUTHORIZATION_CODE_PKCE,
    });

    expect(changed).toMatchObject({
      method: OAuth2Method.AUTHORIZATION_CODE_PKCE,
      clientId: 'client',
      codeChallengeMethod: 'S256',
    });
    expect(changed).not.toHaveProperty('tokens');
  });

  it('rejects a change that makes the authorization invalid', () => {
    const basic = createDefaultAuthorization(AuthorizationType.BASIC);

    expect(() => applyAuthorizationChange(basic, { username: undefined })).toThrow();
  });
});
