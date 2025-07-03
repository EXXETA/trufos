import { AuthorizationType, BearerAuthorizationInformation } from 'shim/objects/auth';
import { describe, expect, it } from 'vitest';
import BearerAuthStrategy from './bearer-auth';

describe('BearerAuthStrategy', () => {
  it('getAuthHeader() should return the correct Bearer auth header', async () => {
    // Arrange
    const input: BearerAuthorizationInformation = {
      type: AuthorizationType.BEARER,
      token: 'my-secret-token',
    };
    const expected = `Bearer ${input.token}`;
    const strategy = new BearerAuthStrategy(input);

    // Act
    const header = await strategy.getAuthHeader();

    // Assert
    expect(header).toBe(expected);
  });
});
