import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { AuthorizationType } from '../objects/auth';
import { RequestBodyType, TrufosRequest } from '../objects/request';
import { normalizeCollection } from './model';
import {
  AutomaticHeaderKey,
  DEFAULT_FILE_MIME_TYPE,
  getAutomaticHeaders,
  getInheritedHeaders,
  resolveHeaders,
} from './headers';
import { makeExampleCollection, makeRequest } from '../__mocks__/collection-fixtures';

/** See {@link makeExampleCollection}. */
const collection = makeExampleCollection({ title: 'Collection' });

const header = (key: string, value: string, isActive = true) => ({ key, value, isActive });

describe('getInheritedHeaders()', () => {
  it('combines the headers of the collection and the folders above, closer levels overriding', () => {
    const model = produce(
      normalizeCollection({
        ...collection,
        headers: [header('X-Collection', 'c'), header('X-Shared', 'c'), header('X-Shared', 'c2')],
      }),
      (draft) => {
        draft.folders.get('f1')!.headers = [header('x-shared', 'f1'), header('X-Off', 'f1', false)];
        draft.folders.get('f2')!.headers = [header('X-Inner', 'f2'), header(' ', 'blank')];
      }
    );

    const inherited = getInheritedHeaders(model, { parentId: 'f2' });

    expect(inherited.map(({ header }) => header)).toEqual([
      header('X-Collection', 'c'),
      header('x-shared', 'f1'),
      header('X-Inner', 'f2'),
    ]);
    expect(inherited.map(({ source }) => source.id)).toEqual(['col', 'f1', 'f2']);
  });

  it('marks the headers the node overrides with a sent header or disables', () => {
    const model = normalizeCollection({
      ...collection,
      headers: [header('X-Kept', 'c'), header('X-Disabled', 'c'), header('X-Overridden', 'c')],
    });

    const inherited = getInheritedHeaders(model, {
      parentId: 'f2',
      headers: [header('x-overridden', 'r'), header('X-Kept', 'inactive', false)],
      disabledHeaders: ['x-disabled'],
    });

    expect(inherited.map(({ isOverridden, isDisabled }) => [isOverridden, isDisabled])).toEqual([
      [false, false],
      [false, true],
      [true, false],
    ]);
  });

  it('returns nothing if no level has headers', () => {
    expect(getInheritedHeaders(normalizeCollection(collection), { parentId: 'f2' })).toEqual([]);
  });
});

describe('getAutomaticHeaders()', () => {
  const model = normalizeCollection(collection);

  /** Returns the automatic headers of a request without inherited headers. */
  const automaticOf = (request: Partial<TrufosRequest>, values = {}) =>
    getAutomaticHeaders(model, makeRequest('r', 'col', request), [], values);

  it('sets the content type of a text body and the user agent, which can be disabled', () => {
    const automatic = automaticOf(
      { body: { type: RequestBodyType.TEXT, mimeType: 'application/json' } },
      { userAgent: 'Trufos/1.0.0' }
    );

    expect(automatic).toEqual([
      {
        key: AutomaticHeaderKey.CONTENT_TYPE,
        value: 'application/json',
        canDisable: true,
        isConditional: true,
        isOverridden: false,
        isDisabled: false,
      },
      {
        key: AutomaticHeaderKey.USER_AGENT,
        value: 'Trufos/1.0.0',
        canDisable: true,
        isConditional: false,
        isOverridden: false,
        isDisabled: false,
      },
    ]);
  });

  it('sets no content type for a request without a body or with an empty text body', () => {
    const keysOf = (request: Partial<TrufosRequest>, values = {}) =>
      automaticOf(request, values).map(({ key }) => key);

    expect(keysOf({ body: { type: RequestBodyType.NONE } })).toEqual([
      AutomaticHeaderKey.USER_AGENT,
    ]);
    expect(
      keysOf({ body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' } }, { hasBody: false })
    ).toEqual([AutomaticHeaderKey.USER_AGENT]);
  });

  it('marks the content type of a text body as conditional until it is known whether there is text', () => {
    const body = { type: RequestBodyType.TEXT, mimeType: 'text/plain' } as const;

    expect(automaticOf({ body })[0].isConditional).toBe(true);
    expect(automaticOf({ body }, { hasBody: true })[0].isConditional).toBe(false);
  });

  it('sets the content type and length of a file body, but only the type can be disabled', () => {
    const automatic = automaticOf(
      { body: { type: RequestBodyType.FILE, filePath: '/file' } },
      { contentLength: '42' }
    );

    expect(automatic.slice(0, 2)).toMatchObject([
      { key: AutomaticHeaderKey.CONTENT_TYPE, value: DEFAULT_FILE_MIME_TYPE, canDisable: true },
      { key: AutomaticHeaderKey.CONTENT_LENGTH, value: '42', canDisable: false },
    ]);
  });

  it('leaves the content type of form data to the HTTP client', () => {
    const automatic = automaticOf({ body: { type: RequestBodyType.FORM_DATA, fields: [] } });

    expect(automatic[0]).toEqual({
      key: AutomaticHeaderKey.CONTENT_TYPE,
      canDisable: false,
      isConditional: false,
      isOverridden: false,
      isDisabled: false,
    });
  });

  it('sets the authorization if one applies, which cannot be disabled', () => {
    const automatic = automaticOf({
      auth: { type: AuthorizationType.BEARER, token: 't' },
      disabledHeaders: ['authorization'],
    });

    expect(automatic).toContainEqual({
      key: AutomaticHeaderKey.AUTHORIZATION,
      canDisable: false,
      isConditional: false,
      isOverridden: false,
      isDisabled: false,
    });
    expect(
      automaticOf({ auth: { type: AuthorizationType.INHERIT } }).map(({ key }) => key)
    ).not.toContain(AutomaticHeaderKey.AUTHORIZATION);
  });

  it('marks the headers the request disables or replaces with an inherited or own one', () => {
    const request = makeRequest('r', 'col', {
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
      headers: [header('content-type', 'application/json')],
      disabledHeaders: ['user-agent'],
    });
    const inherited = getInheritedHeaders(
      normalizeCollection({ ...collection, headers: [header('User-Agent', 'collection')] }),
      request
    );

    const automatic = getAutomaticHeaders(model, request, inherited);

    expect(automatic.map(({ isOverridden, isDisabled }) => [isOverridden, isDisabled])).toEqual([
      [true, false],
      [false, true],
    ]);
  });
});

describe('disabling headers', () => {
  it('sends neither the automatic nor the inherited header with a disabled key', () => {
    const model = normalizeCollection({ ...collection, headers: [header('User-Agent', 'c')] });
    const request = makeRequest('r', 'col', { disabledHeaders: ['user-agent'] });

    expect(resolveHeaders(model, request, { userAgent: 'Trufos/1.0.0', hasBody: false })).toEqual(
      []
    );
  });

  it('sends the generated authorization instead of a disabled inherited one', () => {
    const model = normalizeCollection({
      ...collection,
      headers: [header('Authorization', 'inherited')],
    });
    const request = makeRequest('r', 'col', {
      auth: { type: AuthorizationType.BEARER, token: 't' },
      disabledHeaders: ['authorization', 'user-agent'],
    });

    expect(resolveHeaders(model, request, { authorization: 'Bearer t', hasBody: false })).toEqual([
      { key: AutomaticHeaderKey.AUTHORIZATION, value: 'Bearer t', isAutomatic: true },
    ]);
  });
});

describe('resolveHeaders()', () => {
  const model = normalizeCollection({
    ...collection,
    headers: [header('X-Kept', 'c'), header('X-Disabled', 'c'), header('X-Overridden', 'c')],
  });

  it('sends the automatic and inherited headers that are neither disabled nor overridden, then its own', () => {
    const request = makeRequest('r', 'f2', {
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
      headers: [header('x-overridden', 'r'), header('X-Kept', 'inactive', false)],
      disabledHeaders: ['x-disabled', 'user-agent'],
    });

    expect(resolveHeaders(model, request, { userAgent: 'Trufos/1.0.0', hasBody: true })).toEqual([
      { key: 'content-type', value: 'text/plain', isAutomatic: true },
      { key: 'X-Kept', value: 'c', isAutomatic: false },
      { key: 'x-overridden', value: 'r', isAutomatic: false },
    ]);
  });
});
