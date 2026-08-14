import { describe, expect, it } from 'vitest';
import { completeBaseUrl, getEnvironmentKey, joinUrl, toTemplateVariables } from './openapi-url';

describe('completeBaseUrl', () => {
  it('falls back to localhost for empty server URLs', () => {
    expect(completeBaseUrl('')).toBe('http://localhost');
    expect(completeBaseUrl('   ')).toBe('http://localhost');
  });

  it('keeps absolute URLs, without a trailing slash', () => {
    expect(completeBaseUrl('https://api.example.com/v1/')).toBe('https://api.example.com/v1');
  });

  it('completes protocol-relative URLs with https', () => {
    expect(completeBaseUrl('//api.example.com/v1')).toBe('https://api.example.com/v1');
  });

  it('completes paths with a localhost base URL', () => {
    expect(completeBaseUrl('/api/v2')).toBe('http://localhost/api/v2');
  });

  it('completes bare hosts with https', () => {
    expect(completeBaseUrl('api.example.com/v1')).toBe('https://api.example.com/v1');
    expect(completeBaseUrl('127.0.0.1:8080/api')).toBe('https://127.0.0.1:8080/api');
  });

  it('treats a single word as a path on localhost, not as a host', () => {
    expect(completeBaseUrl('api')).toBe('http://localhost/api');
  });
});

describe('joinUrl', () => {
  it('joins the path onto the base URL', () => {
    expect(joinUrl('https://api.example.com/v1/', 'pets')).toBe('https://api.example.com/v1/pets');
    expect(joinUrl('{{baseUrl}}', '/pets')).toBe('{{baseUrl}}/pets');
  });

  it('keeps paths that are absolute URLs themselves', () => {
    expect(joinUrl('{{baseUrl}}', 'https://other.example.com/pets')).toBe(
      'https://other.example.com/pets'
    );
  });
});

describe('toTemplateVariables', () => {
  it('converts path parameters into Trufos template variables', () => {
    expect(toTemplateVariables('/apps/{appId}/versions/{version}')).toBe(
      '/apps/{{appId}}/versions/{{version}}'
    );
  });

  it('keeps parameters whose name cannot be a Trufos variable', () => {
    expect(toTemplateVariables('/apps/{app.id}')).toBe('/apps/{app.id}');
  });
});

describe('getEnvironmentKey', () => {
  it('prefers the description of the server', () => {
    expect(getEnvironmentKey({ url: 'https://api.example.com', description: ' Production ' })).toBe(
      'Production'
    );
  });

  it('falls back to the URL without its scheme', () => {
    expect(getEnvironmentKey({ url: 'https://staging.example.com/v1' })).toBe(
      'staging.example.com/v1'
    );
    expect(getEnvironmentKey({ url: 'https://api.example.com', description: '  ' })).toBe(
      'api.example.com'
    );
  });
});
