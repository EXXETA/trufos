import { describe, expect, it } from 'vitest';
import { AuthorizationType, OAuth1Method, OAuth1SignatureMethod } from 'shim/objects/auth';
import { makeRequest } from 'shim/__mocks__/collection-fixtures';
import type { HistoryEntry } from 'shim/history';
import { RequestBodyType } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { ScriptType } from 'shim/scripting';
import {
  MASK,
  maskAuthorization,
  maskSecretsInText,
  redactHistoryEntry,
  redactRequest,
  redactSentRequest,
  redactUrl,
  restoreMaskedChanges,
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

  it('should mask secrets anywhere in script arguments', () => {
    const entry: HistoryEntry = {
      id: 'e',
      requestId: 'r',
      requestTitle: 'R',
      timestamp: 0,
      method: RequestMethod.GET,
      url: 'https://example.com/?key=top-secret',
      outcome: { type: 'aborted' },
      scriptLogs: [
        {
          script: ScriptType.PRE_REQUEST,
          level: 'info',
          args: ['top-secret', 'top-secret!', 1, { token: ['Bearer top-secret'] }, null],
        },
      ],
    };

    expect(redactHistoryEntry(entry, new Set(['top-secret']))).toMatchObject({
      url: `https://example.com/?key=${MASK}`,
      scriptLogs: [{ args: [MASK, `${MASK}!`, 1, { token: [`Bearer ${MASK}`] }, null] }],
    });
  });

  it('should mask circular script arguments', () => {
    const circular: Record<string, unknown> = { token: 'top-secret' };
    circular.self = circular;
    const entry: HistoryEntry = {
      id: 'e',
      requestId: 'r',
      requestTitle: 'R',
      timestamp: 0,
      method: RequestMethod.GET,
      url: 'https://example.com/',
      outcome: { type: 'aborted' },
      scriptLogs: [{ script: ScriptType.PRE_REQUEST, level: 'info', args: [circular] }],
    };

    expect(redactHistoryEntry(entry, new Set(['top-secret'])).scriptLogs[0].args).toEqual([
      { token: MASK, self: '[Circular]' },
    ]);
  });

  it('should mask every occurrence of a secret in text, the longest first', () => {
    expect(
      maskSecretsInText(
        'const a = "abc"; const b = "abcdef"; c("abc%2Fd")',
        new Set(['abc', 'abcdef', 'abc/d'])
      )
    ).toBe(`const a = "${MASK}"; const b = "${MASK}"; c("${MASK}")`);
  });

  it('should mask the secrets of a stored request', () => {
    const request = makeRequest('r', 'col', {
      url: {
        base: 'https://example.com/top-secret/users',
        query: [{ key: 'key', value: 'top-secret', isActive: true }],
      },
      headers: [
        { key: 'Authorization', value: 'Bearer hand-typed', isActive: true },
        { key: 'authorization', value: 'Bearer {{token}}', isActive: true },
        { key: 'Cookie', value: '', isActive: true },
        { key: 'X-Api-Key', value: 'top-secret', isActive: true },
        { key: 'X-Note', value: 'top-secret!', isActive: true },
      ],
      auth: { type: AuthorizationType.BEARER, token: 'top-secret' },
    });

    expect(redactRequest(request, new Set(['top-secret']))).toMatchObject({
      url: {
        base: `https://example.com/${MASK}/users`,
        query: [{ key: 'key', value: MASK, isActive: true }],
      },
      headers: [
        { key: 'Authorization', value: MASK },
        { key: 'authorization', value: 'Bearer {{token}}' },
        { key: 'Cookie', value: '' },
        { key: 'X-Api-Key', value: MASK },
        { key: 'X-Note', value: 'top-secret!' },
      ],
      auth: { type: AuthorizationType.BEARER, token: MASK },
    });
  });

  describe('restoreMaskedChanges', () => {
    const stored = makeRequest('r', 'col', {
      url: {
        base: 'https://example.com/top-secret/users',
        query: [{ key: 'key', value: 'top-secret', isActive: true }],
      },
      headers: [
        { key: 'Authorization', value: 'Basic first', isActive: true },
        { key: 'X-Other', value: 'old', isActive: true },
        { key: 'authorization', value: 'Basic second', isActive: true },
      ],
      body: {
        type: RequestBodyType.FORM_DATA,
        fields: [
          {
            key: 'password',
            isActive: true,
            value: { type: RequestBodyType.TEXT, mimeType: 'text/plain', text: 'top-secret' },
          },
        ],
      },
      auth: { type: AuthorizationType.BEARER, token: 'top-secret' },
    });

    it('should keep the stored values of what redactRequest masked', () => {
      const masked = redactRequest(stored, new Set(['top-secret']));
      const { url, headers, body, auth } = masked;

      expect(restoreMaskedChanges({ url, headers, body, auth }, stored)).toEqual({
        url: stored.url,
        headers: stored.headers,
        body: stored.body,
        auth: stored.auth,
      });
    });

    it('should keep each stored value of a key once, in order', () => {
      expect(
        restoreMaskedChanges(
          {
            headers: [
              { key: 'authorization', value: MASK, isActive: true },
              { key: 'X-Other', value: 'new', isActive: true },
              { key: 'AUTHORIZATION', value: MASK, isActive: true },
            ],
          },
          stored
        ).headers?.map(({ value }) => value)
      ).toEqual(['Basic first', 'new', 'Basic second']);
    });

    it('should pair a masked value with its own stored value after an unmasked one of the same key', () => {
      const repeated = makeRequest('r', 'col', {
        url: {
          base: 'https://example.com/',
          query: [
            { key: 'key', value: 'public', isActive: true },
            { key: 'key', value: 's3cret', isActive: true },
          ],
        },
        headers: [
          { key: 'X-Key', value: 'public', isActive: true },
          { key: 'X-Key', value: 's3cret', isActive: true },
        ],
        body: {
          type: RequestBodyType.FORM_DATA,
          fields: ['public', 's3cret'].map((text) => ({
            key: 'key',
            isActive: true,
            value: { type: RequestBodyType.TEXT, mimeType: 'text/plain', text },
          })),
        },
      });
      const masked = redactRequest(repeated, new Set(['s3cret']));
      expect(masked.headers.map(({ value }) => value)).toEqual(['public', MASK]);
      expect(masked.url.query.map(({ value }) => value)).toEqual(['public', MASK]);
      expect(masked.body).toMatchObject({
        fields: [{ value: { text: 'public' } }, { value: { text: MASK } }],
      });

      const { url, headers, body } = masked;
      expect(restoreMaskedChanges({ url, headers, body }, repeated)).toEqual({
        url: repeated.url,
        headers: repeated.headers,
        body: repeated.body,
      });
    });

    it('should keep changes and removals', () => {
      expect(
        restoreMaskedChanges({ url: { base: 'https://other.com/', query: [] }, auth: null }, stored)
      ).toEqual({ url: { base: 'https://other.com/', query: [] }, auth: null });
    });

    it('should reject a masked value without a stored one', () => {
      expect(() =>
        restoreMaskedChanges({ headers: [{ key: 'X-New', value: MASK, isActive: true }] }, stored)
      ).toThrow('masked value');
      expect(() =>
        restoreMaskedChanges(
          { auth: { type: AuthorizationType.BASIC, username: 'u', password: MASK } },
          stored
        )
      ).toThrow('masked value');
      expect(() =>
        restoreMaskedChanges({ url: { base: `https://example.com/${MASK}`, query: [] } }, stored)
      ).toThrow('masked value');
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
