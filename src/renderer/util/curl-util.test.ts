import { describe, it, expect } from 'vitest';
import { buildCurlCommand } from './curl-util';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { AuthorizationType } from 'shim/objects/auth';

function makeRequest(overrides: Partial<TrufosRequest> = {}): TrufosRequest {
  return {
    id: 'req-1',
    parentId: 'col-1',
    type: 'request',
    lastModified: 0,
    title: 'Test',
    url: { base: 'https://example.com/api', query: [] },
    method: RequestMethod.GET,
    headers: [],
    body: null,
    ...overrides,
  } as TrufosRequest;
}

describe('buildCurlCommand', () => {
  it('builds a plain GET request', () => {
    expect(buildCurlCommand(makeRequest())).toBe("curl -X GET 'https://example.com/api'");
  });

  it('includes query parameters in the URL', () => {
    const request = makeRequest({
      url: {
        base: 'https://example.com/api',
        query: [
          { key: 'page', value: '2', isActive: true },
          { key: 'ignored', value: 'x', isActive: false },
        ],
      },
    });

    expect(buildCurlCommand(request)).toContain('page=2');
    expect(buildCurlCommand(request)).not.toContain('ignored');
  });

  it('adds active headers only', () => {
    const request = makeRequest({
      headers: [
        { key: 'Authorization', value: 'Bearer {{token}}', isActive: true },
        { key: 'X-Disabled', value: 'nope', isActive: false },
      ],
    });

    const command = buildCurlCommand(request);
    expect(command).toContain("-H 'Authorization: Bearer {{token}}'");
    expect(command).not.toContain('X-Disabled');
  });

  it('escapes single quotes in values', () => {
    const request = makeRequest({
      url: { base: "https://example.com/it's", query: [] },
    });

    expect(buildCurlCommand(request)).toContain("'https://example.com/it'\\''s'");
  });

  it('adds a text body with content type from the mime type', () => {
    const request = makeRequest({
      method: RequestMethod.POST,
      body: { type: RequestBodyType.TEXT, mimeType: 'application/json' },
    });

    const command = buildCurlCommand(request, '{"a":1}');
    expect(command).toContain("-H 'Content-Type: application/json'");
    expect(command).toContain(`--data-raw '{"a":1}'`);
  });

  it('does not duplicate an explicitly set content type header', () => {
    const request = makeRequest({
      method: RequestMethod.POST,
      headers: [{ key: 'content-type', value: 'text/plain', isActive: true }],
      body: { type: RequestBodyType.TEXT, mimeType: 'application/json' },
    });

    const command = buildCurlCommand(request, 'hello');
    expect(command).not.toContain('application/json');
    expect(command).toContain("-H 'content-type: text/plain'");
  });

  it('omits the data flag when the text body is empty', () => {
    const request = makeRequest({
      method: RequestMethod.POST,
      body: { type: RequestBodyType.TEXT, mimeType: 'application/json' },
    });

    expect(buildCurlCommand(request)).not.toContain('--data-raw');
  });

  it('references a file body by path', () => {
    const request = makeRequest({
      method: RequestMethod.PUT,
      body: { type: RequestBodyType.FILE, filePath: '/tmp/payload.bin' },
    });

    expect(buildCurlCommand(request)).toContain("--data-binary '@/tmp/payload.bin'");
  });

  it('adds active form-data fields', () => {
    const request = makeRequest({
      method: RequestMethod.POST,
      body: {
        type: RequestBodyType.FORM_DATA,
        fields: [
          {
            key: 'name',
            isActive: true,
            value: { type: RequestBodyType.TEXT, text: 'trufos', mimeType: 'text/plain' },
          },
          {
            key: 'file',
            isActive: true,
            value: { type: RequestBodyType.FILE, filePath: '/tmp/a.png' },
          },
          {
            key: 'disabled',
            isActive: false,
            value: { type: RequestBodyType.TEXT, text: 'x', mimeType: 'text/plain' },
          },
        ],
      },
    });

    const command = buildCurlCommand(request);
    expect(command).toContain("-F 'name=trufos'");
    expect(command).toContain("-F 'file=@/tmp/a.png'");
    expect(command).not.toContain('disabled');
  });

  it('joins parts with line continuations', () => {
    const request = makeRequest({
      headers: [{ key: 'Accept', value: 'application/json', isActive: true }],
    });

    expect(buildCurlCommand(request)).toBe(
      "curl -X GET 'https://example.com/api' \\\n  -H 'Accept: application/json'"
    );
  });

  it('percent-encodes reserved characters in query values', () => {
    const request = makeRequest({
      url: {
        base: 'https://echo.free.beeceptor.com',
        query: [{ key: 'some-query', value: "with-value '!!'", isActive: true }],
      },
    });

    const command = buildCurlCommand(request);
    expect(command).toContain(
      "'https://echo.free.beeceptor.com?some-query=with-value%20%27%21%21%27'"
    );
    expect(command).not.toContain("with-value '!!'");
  });

  it('keeps template variables in query values unresolved and unencoded', () => {
    const request = makeRequest({
      url: {
        base: 'https://example.com/api',
        query: [{ key: 'token', value: '{{authToken}}', isActive: true }],
      },
    });

    expect(buildCurlCommand(request)).toContain('token={{authToken}}');
  });

  it('adds a resolved Authorization header for bearer auth', () => {
    const request = makeRequest({
      auth: { type: AuthorizationType.BEARER, token: '{{token}}' },
    });

    expect(buildCurlCommand(request)).toContain("-H 'Authorization: Bearer {{token}}'");
  });

  it('skips empty bearer auth tokens', () => {
    const request = makeRequest({
      auth: { type: AuthorizationType.BEARER, token: '' },
    });

    expect(buildCurlCommand(request)).not.toContain('Authorization');
  });

  it('adds a resolved Authorization header for basic auth', () => {
    const request = makeRequest({
      auth: { type: AuthorizationType.BASIC, username: 'user', password: 'pass' },
    });

    expect(buildCurlCommand(request)).toContain(`-H 'Authorization: Basic ${btoa('user:pass')}'`);
  });

  it('does not override an explicitly set Authorization header with auth config', () => {
    const request = makeRequest({
      headers: [{ key: 'Authorization', value: 'Bearer explicit', isActive: true }],
      auth: { type: AuthorizationType.BEARER, token: 'from-auth-tab' },
    });

    const command = buildCurlCommand(request);
    expect(command).toContain("-H 'Authorization: Bearer explicit'");
    expect(command).not.toContain('from-auth-tab');
  });

  it('skips form-data file fields without a path or file name', () => {
    const request = makeRequest({
      method: RequestMethod.POST,
      body: {
        type: RequestBodyType.FORM_DATA,
        fields: [{ key: 'empty-file', isActive: true, value: { type: RequestBodyType.FILE } }],
      },
    });

    expect(buildCurlCommand(request)).not.toContain('-F');
  });
});
