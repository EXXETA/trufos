import { describe, it, expect } from 'vitest';
import {
  AuthorizationInformation,
  AuthorizationMethod,
  AuthorizationType,
  createDefaultAuthorization,
  getMethod,
  OAuth1Method,
  OAuth2Method,
} from 'shim/objects/auth';
import { AuthorizationLevel, buildAuthorizationForm } from './forms';

const DEFAULTS: [AuthorizationType, AuthorizationMethod | undefined][] = [
  [AuthorizationType.INHERIT, undefined],
  [AuthorizationType.BEARER, undefined],
  [AuthorizationType.BASIC, undefined],
  [AuthorizationType.DIGEST, undefined],
  [AuthorizationType.OAUTH2, undefined],
  ...Object.values(OAuth2Method).map((method): [AuthorizationType, AuthorizationMethod] => [
    AuthorizationType.OAUTH2,
    method,
  ]),
  [AuthorizationType.OAUTH1, undefined],
  ...Object.values(OAuth1Method).map((method): [AuthorizationType, AuthorizationMethod] => [
    AuthorizationType.OAUTH1,
    method,
  ]),
];

describe('buildAuthorizationForm', () => {
  it.each(DEFAULTS)('has only fields that the default of %s (method %s) has', (type, method) => {
    const auth = AuthorizationInformation.parse(createDefaultAuthorization(type, method));
    const keys = Object.entries(buildAuthorizationForm(type, getMethod(auth), 'request'))
      .filter(([, field]) => field.type !== 'label')
      .map(([key]) => key);

    expect(keys.filter((key) => !(key in auth))).toEqual([]);
  });

  it.each<[AuthorizationLevel, string[]]>([
    ['request', []],
    ['folder', ['none']],
    ['collection', [AuthorizationType.INHERIT]],
  ])('offers every type for a %s except %j', (level, excluded) => {
    const type = buildAuthorizationForm(AuthorizationType.BEARER, undefined, level).type;
    const options = type.type === 'select' ? type.options.map((option) => option.value) : [];

    expect(options).toHaveLength(7 - excluded.length);
    for (const value of excluded) expect(options).not.toContain(value);
  });

  it('describes what an inheriting authorization inherits', () => {
    const form = buildAuthorizationForm(
      AuthorizationType.INHERIT,
      undefined,
      'folder',
      'inherited'
    );

    expect(form.description).toEqual({ type: 'label', text: 'inherited' });
  });

  it('describes no authorization depending on the level', () => {
    const request = buildAuthorizationForm('none', undefined, 'request').description;
    const collection = buildAuthorizationForm('none', undefined, 'collection').description;

    expect(request).toMatchObject({ type: 'label', text: expect.stringContaining('this request') });
    expect(collection).toMatchObject({ type: 'label', text: expect.stringContaining('inherit') });
  });
});
