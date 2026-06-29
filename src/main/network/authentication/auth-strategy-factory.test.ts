import { describe, expect, it } from 'vitest';
import { createAuthStrategy } from './auth-strategy-factory';
import BasicAuthStrategy from './basic-auth';
import BearerAuthStrategy from './bearer-auth';
import {
  AuthorizationInformation,
  AuthorizationType,
  BasicAuthorizationInformation,
  BearerAuthorizationInformation,
  OAuth1AuthorizationInformation,
  OAuth1SignatureMethod,
  OAuth2ClientAuthenticationMethod,
} from 'shim/objects';
import { OAuth2ClientCrentialsAuthorizationInformation, OAuth2Method } from 'shim/objects';
import ClientCredentialsAuthorizationStrategy from './oauth2/client-credentials';
import OAuth1AuthStrategy from './oauth1/oauth1-auth';

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

  it('should create ClientCredentialsAuthorizationStrategy for OAuth2 client credentials', () => {
    const auth: OAuth2ClientCrentialsAuthorizationInformation = {
      type: AuthorizationType.OAUTH2,
      scope: '',
      method: OAuth2Method.CLIENT_CREDENTIALS,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      tokenUrl: 'https://example.com/oauth2/token',
      issuerUrl: 'https://example.com/oauth2/issuer',
      clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
    };
    const strategy = createAuthStrategy(auth);
    expect(strategy).toBeInstanceOf(ClientCredentialsAuthorizationStrategy);
  });

  it('should create an OAuth1AuthStrategy for OAuth 1.0 authentication', () => {
    const auth: OAuth1AuthorizationInformation = {
      type: AuthorizationType.OAUTH1,
      consumerKey: 'ck',
      consumerSecret: 'cs',
      signatureMethod: OAuth1SignatureMethod.HMAC_SHA1,
    };
    const strategy = createAuthStrategy(auth);
    expect(strategy).toBeInstanceOf(OAuth1AuthStrategy);
  });
});
