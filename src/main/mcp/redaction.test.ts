import { describe, expect, it } from 'vitest';
import { normalizeCollection } from 'shim/collection-model';
import { AuthorizationType, OAuth1Method, OAuth1SignatureMethod } from 'shim/objects/auth';
import { makeCollection, makeRequest } from 'shim/__mocks__/collection-fixtures';
import { collectSecrets, MASK, maskAuthorization, redact, redactSentRequest } from './redaction';

describe('redaction', () => {
  it('should mask set credentials and keep empty ones empty', () => {
    expect(
      maskAuthorization({
        type: AuthorizationType.OAUTH1,
        method: OAuth1Method.EXISTING_TOKEN,
        consumerKey: 'key',
        consumerSecret: 'consumer-secret',
        signatureMethod: OAuth1SignatureMethod.HMAC_SHA1,
        token: '',
      })
    ).toMatchObject({ consumerKey: 'key', consumerSecret: MASK, token: '' });
  });

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

    expect(collectSecrets(model).toSorted()).toEqual(
      ['collection-key', 'prod-key', 'request-password'].toSorted()
    );
  });

  it('should ignore secrets too short to search for', () => {
    const model = normalizeCollection(
      makeCollection('col', [], { variables: { pin: { value: '123', secret: true } } })
    );

    expect(collectSecrets(model)).toEqual([]);
  });

  it('should mask a secret that contains another one as a whole', () => {
    expect(redact('token=abcd-efgh', ['abcd', 'abcd-efgh'])).toBe(`token=${MASK}`);
  });

  it('should mask credential headers completely and secrets elsewhere', () => {
    expect(
      redactSentRequest(
        {
          method: 'GET',
          url: 'https://example.com/?key=secret-key',
          headers: { cookie: 'session=1', 'x-tags': ['a', 'secret-key'], empty: undefined },
        },
        ['secret-key']
      )
    ).toEqual({
      method: 'GET',
      url: `https://example.com/?key=${MASK}`,
      headers: { cookie: MASK, 'x-tags': ['a', MASK] },
    });
  });
});
