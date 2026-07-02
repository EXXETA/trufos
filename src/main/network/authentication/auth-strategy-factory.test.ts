import { describe, expect, it } from 'vitest';
import { createAuthStrategy } from './auth-strategy-factory';
import BasicAuthStrategy from './basic-auth';
import BearerAuthStrategy from './bearer-auth';
import {
  AuthorizationInformation,
  AuthorizationType,
  BasicAuthorizationInformation,
  BearerAuthorizationInformation,
  OAuth1AuthorizationFlowInformation,
  OAuth1ExistingTokenAuthorizationInformation,
  OAuth1Method,
  OAuth1SignatureMethod,
  OAuth2ClientAuthenticationMethod,
} from 'shim/objects';
import { OAuth2ClientCrentialsAuthorizationInformation, OAuth2Method } from 'shim/objects';
import ClientCredentialsAuthorizationStrategy from './oauth2/client-credentials';
import ExistingTokenOAuth1Strategy from './oauth1/existing-token';
import AuthorizationOAuth1Strategy from './oauth1/authorization';

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

  it('should create an ExistingTokenOAuth1Strategy for OAuth 1.0 existing-token auth', () => {
    const auth: OAuth1ExistingTokenAuthorizationInformation = {
      type: AuthorizationType.OAUTH1,
      method: OAuth1Method.EXISTING_TOKEN,
      consumerKey: 'ck',
      consumerSecret: 'cs',
      signatureMethod: OAuth1SignatureMethod.HMAC_SHA1,
    };
    const strategy = createAuthStrategy(auth);
    expect(strategy).toBeInstanceOf(ExistingTokenOAuth1Strategy);
  });

  it('should create an AuthorizationOAuth1Strategy for OAuth 1.0 authorization flow', () => {
    const auth: OAuth1AuthorizationFlowInformation = {
      type: AuthorizationType.OAUTH1,
      method: OAuth1Method.AUTHORIZATION,
      consumerKey: 'ck',
      consumerSecret: 'cs',
      signatureMethod: OAuth1SignatureMethod.HMAC_SHA1,
      requestTokenUrl: 'https://example.com/oauth/request_token',
      authorizationUrl: 'https://example.com/oauth/authorize',
      accessTokenUrl: 'https://example.com/oauth/access_token',
      callbackUrl: 'http://localhost/callback',
    };
    const strategy = createAuthStrategy(auth);
    expect(strategy).toBeInstanceOf(AuthorizationOAuth1Strategy);
  });
});
