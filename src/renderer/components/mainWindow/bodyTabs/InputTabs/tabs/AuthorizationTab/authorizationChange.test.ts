import { describe, it, expect } from 'vitest';
import { AuthorizationType, createDefaultAuthorization, OAuth2Method } from 'shim/objects/auth';
import { applyAuthorizationChange } from './authorizationChange';

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
