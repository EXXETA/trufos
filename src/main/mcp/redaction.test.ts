import { describe, expect, it } from 'vitest';
import { normalizeCollection } from 'shim/collection-model';
import { AuthorizationType, OAuth1Method, OAuth1SignatureMethod } from 'shim/objects/auth';
import { makeCollection, makeRequest } from 'shim/__mocks__/collection-fixtures';
import type { HistoryEntry } from 'shim/history';
import { RequestMethod } from 'shim/objects/request-method';
import { ScriptType } from 'shim/scripting';
import {
  collectSecrets,
  MASK,
  maskAuthorization,
  redactHistoryEntry,
  redactSentRequest,
  redactUrl,
} from './redaction';

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

  it.each([AuthorizationType.BASIC, AuthorizationType.DIGEST] as const)(
    'should mask the password of %s authorization',
    (type) => {
      expect(maskAuthorization({ type, username: 'user', password: 'secret' })).toEqual({
        type,
        username: 'user',
        password: MASK,
      });
    }
  );

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

  it('should mask path segments and query values that are a secret', () => {
    const secrets = new Set(['admin', 'p@ss']);

    expect(redactUrl('https://example.com/admin/users?user=admin&key=p%40ss&flag', secrets)).toBe(
      `https://example.com/${MASK}/users?user=${MASK}&key=${MASK}&flag`
    );
  });

  it('should not change values that only contain a secret', () => {
    const secrets = new Set(['admin']);

    expect(redactUrl('https://example.com/administration?q=admin-panel', secrets)).toBe(
      'https://example.com/administration?q=admin-panel'
    );
  });

  it('should compare a whole query value that contains `=`', () => {
    expect(redactUrl('https://example.com/?sig=abc==', new Set(['abc==']))).toBe(
      `https://example.com/?sig=${MASK}`
    );
  });

  it('should mask script arguments that are a secret', () => {
    const entry: HistoryEntry = {
      id: 'e',
      requestId: 'r',
      requestTitle: 'R',
      timestamp: 0,
      method: RequestMethod.GET,
      url: 'https://example.com/?key=top-secret',
      outcome: { type: 'aborted' },
      scriptLogs: [
        { script: ScriptType.PRE_REQUEST, level: 'info', args: ['top-secret', 'top-secret!', 1] },
      ],
    };

    expect(redactHistoryEntry(entry, new Set(['top-secret']))).toMatchObject({
      url: `https://example.com/?key=${MASK}`,
      scriptLogs: [{ args: [MASK, 'top-secret!', 1] }],
    });
  });

  it('should keep values that are not URL-encoded', () => {
    expect(redactUrl('https://example.com/?discount=100%', new Set(['x']))).toBe(
      'https://example.com/?discount=100%'
    );
  });

  it('should mask credential headers completely and other values that are a secret', () => {
    expect(
      redactSentRequest(
        {
          method: 'GET',
          url: 'https://example.com/?key=secret-key',
          headers: {
            cookie: 'session=1',
            'x-tags': ['a', 'secret-key'],
            'x-note': 'uses secret-key',
            empty: undefined,
          },
        },
        new Set(['secret-key'])
      )
    ).toEqual({
      method: 'GET',
      url: `https://example.com/?key=${MASK}`,
      headers: { cookie: MASK, 'x-tags': ['a', MASK], 'x-note': 'uses secret-key' },
    });
  });
});
