import { AuthorizationType, BasicAuthorizationInformation } from 'shim/objects';
import { describe, expect, it } from 'vitest';
import BasicAuthStrategy from './basic-auth';

describe('BasicAuthStrategy', () => {
  it('getAuthHeader() should return the correct Basic auth header', async () => {
    // Arrange
    const input: BasicAuthorizationInformation = {
      type: AuthorizationType.BASIC,
      username: 'testUser',
      password: 'testPass',
    };
    const expected = `Basic ${Buffer.from(`${input.username}:${input.password}`).toString('base64')}`;
    const strategy = new BasicAuthStrategy(input);

    // Act
    const header = await strategy.getAuthHeader();

    // Assert
    expect(header).toBe(expected);
  });
});
