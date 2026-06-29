import { describe, it, expect } from 'vitest';
import {
  resolveTemplateVariables,
  getAuthHeader,
  buildHeaders,
  generateCodeSnippet,
} from './code-generator-service';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { parseUrl } from 'shim/objects/url';
import { RequestMethod } from 'shim/objects/request-method';

describe('code-generator-service', () => {
  describe('resolveTemplateVariables', () => {
    it('should substitute variables matching template structure', () => {
      const vars = { host: 'api.example.com', path: 'v1' };
      const template = 'https://{{host}}/{{path}}/data?key={{nonexistent}}';
      const resolved = resolveTemplateVariables(template, vars);
      expect(resolved).toBe('https://api.example.com/v1/data?key={{nonexistent}}');
    });
  });

  describe('getAuthHeader', () => {
    it('should generate Bearer auth headers', () => {
      const auth = { type: 'bearer', token: '{{token_var}}' };
      const variables = { token_var: 'secret-token-123' };
      const header = getAuthHeader(auth, null, variables);
      expect(header).toEqual({ key: 'Authorization', value: 'Bearer secret-token-123' });
    });

    it('should generate Basic auth headers', () => {
      const auth = { type: 'basic', username: 'admin', password: '{{password_var}}' };
      const variables = { password_var: 'pass123' };
      const header = getAuthHeader(auth, null, variables);
      expect(header?.key).toBe('Authorization');
      expect(header?.value).toContain('Basic ');
    });
  });

  describe('generateCodeSnippet', () => {
    const request: TrufosRequest = {
      id: 'req-1',
      parentId: 'col-1',
      type: 'request',
      title: 'Get User Info',
      url: parseUrl('https://{{domain}}/users'),
      method: RequestMethod.GET,
      headers: [{ key: 'Accept', value: 'application/json', isActive: true }],
      body: {
        type: RequestBodyType.TEXT,
        text: '{"id": "{{user_id}}"}',
        mimeType: 'application/json',
      },
    };

    const variables: any = [
      ['domain', { value: 'localhost:3000' }],
      ['user_id', { value: '42' }],
    ];

    it('should generate valid cURL snippets', () => {
      const snippet = generateCodeSnippet('curl', request, null, variables);
      expect(snippet).toContain('curl -X GET "https://localhost:3000/users"');
      expect(snippet).toContain('-H "Accept: application/json"');
      expect(snippet).toContain('--data \'{"id": "42"}\'');
    });

    it('should generate valid Fetch JS snippets', () => {
      const snippet = generateCodeSnippet('fetch_js', request, null, variables);
      expect(snippet).toContain("fetch('https://localhost:3000/users'");
      expect(snippet).toContain('"method": "GET"');
      expect(snippet).toContain('"Accept": "application/json"');
      expect(snippet).toContain('body: JSON.stringify');
    });

    it('should generate valid Axios snippets', () => {
      const snippet = generateCodeSnippet('axios', request, null, variables);
      expect(snippet).toContain('axios({');
      expect(snippet).toContain("method: 'get'");
      expect(snippet).toContain("url: 'https://localhost:3000/users'");
      expect(snippet).toContain('"Accept": "application/json"');
    });

    it('should generate valid Python requests snippets', () => {
      const snippet = generateCodeSnippet('python', request, null, variables);
      expect(snippet).toContain('import requests');
      expect(snippet).toContain('url = "https://localhost:3000/users"');
      expect(snippet).toContain('response = requests.request("GET"');
    });
  });
});
