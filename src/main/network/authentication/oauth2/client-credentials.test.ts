import { AuthorizationType } from 'shim/objects';
import {
  OAuth2ClientAuthenticationMethod,
  OAuth2ClientCrentialsAuthorizationInformation,
  OAuth2Method,
} from 'shim/objects';
import { describe, expect, it } from 'vitest';
import ClientCredentialsAuthorizationStrategy from './client-credentials';

// skipped in CI because it relies on third party service. Test this locally
describe.skip('ClientCredentialsAuthorizationStrategy', () => {
  it('should be able to authorize using manually defined client credentials', async () => {
    // Arrange
    const auth: OAuth2ClientCrentialsAuthorizationInformation = {
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.CLIENT_CREDENTIALS,
      issuerUrl: 'https://login-demo.curity.io/oauth/v2/oauth-issuer',
      tokenUrl: 'https://login-demo.curity.io/oauth/v2/oauth-token',
      clientId: 'demo-backend-client',
      clientSecret: 'MJlO3binatD9jk1',
      scope: 'read write',
      clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
    };
    const strategy = new ClientCredentialsAuthorizationStrategy(auth);

    // Act
    const header = await strategy.getAuthHeader();

    // Assert
    expect(header).toEqual(`Bearer ${auth.tokens.access_token}`);
  });
});
