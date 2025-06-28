import { describe, expect, it } from 'vitest';
import { createAuthStrategy } from './auth-strategy-factory';
import BasicAuthStrategy from './basic-auth';
import BearerAuthStrategy from './bearer-auth';
import {
  AuthorizationInformation,
  AuthorizationType,
  BasicAuthorizationInformation,
  BearerAuthorizationInformation,
} from 'shim/objects/auth';

describe('createAuthStrategy()', () => {
  it('should create a BasicAuthStrategy for basic authentication', () => {
    const auth: BasicAuthorizationInformation = {
      type: AuthorizationType.BASIC,
      username: 'user',
      password: 'pass',
    };
    const strategy = createAuthStrategy(auth);
    expect(strategy).toBeInstanceOf(BasicAuthStrategy);
  });

  it('should create a BearerAuthStrategy for bearer authentication', () => {
    const auth: BearerAuthorizationInformation = { type: AuthorizationType.BEARER, token: 'token' };
    const strategy = createAuthStrategy(auth);
    expect(strategy).toBeInstanceOf(BearerAuthStrategy);
  });

  it('should throw an error for unsupported authentication types', () => {
    const auth = { type: 'unsupported' };
    expect(() => createAuthStrategy(auth as unknown as AuthorizationInformation)).toThrow(
      'Unsupported authentication type: unsupported'
    );
  });
});
