import { describe, expect, it } from 'vitest';
import { normalizeCollection } from 'shim/collection-model';
import { AuthorizationType, OAuth1Method, OAuth1SignatureMethod } from 'shim/objects/auth';
import { makeCollection, makeRequest } from 'shim/__mocks__/collection-fixtures';
import { collectSecrets, getCredentials } from './secrets';

describe('secrets', () => {
  it('should collect secret variables of all environments and the credentials of requests', () => {
    const model = normalizeCollection(
      makeCollection(
        'col',
        [
          makeRequest('r', 'col', {
            auth: { type: AuthorizationType.BASIC, username: 'user', password: 'request-password' },
          }),
        ],
        {
          variables: {
            plain: { value: 'not secret' },
            key: { value: 'collection-key', secret: true },
          },
          environments: { prod: { variables: { key: { value: 'prod-key', secret: true } } } },
        }
      )
    );

    expect([...collectSecrets(model)].toSorted()).toEqual(
      ['collection-key', 'prod-key', 'request-password'].toSorted()
    );
  });

  it('should not treat an empty value as a secret', () => {
    const model = normalizeCollection(
      makeCollection('col', [], { variables: { unset: { value: '', secret: true } } })
    );

    expect(collectSecrets(model).size).toBe(0);
  });

  it('should return the credentials of an authorization by their field', () => {
    expect(
      getCredentials({
        type: AuthorizationType.OAUTH1,
        method: OAuth1Method.EXISTING_TOKEN,
        consumerKey: 'key',
        consumerSecret: 'consumer-secret',
        signatureMethod: OAuth1SignatureMethod.HMAC_SHA1,
        token: 'token',
      })
    ).toEqual(
      new Map([
        ['consumerSecret', 'consumer-secret'],
        ['token', 'token'],
      ])
    );
  });
});
