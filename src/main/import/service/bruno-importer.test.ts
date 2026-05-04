import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { AuthorizationType, OAuth2ClientAuthenticationMethod, OAuth2Method } from 'shim/objects/auth';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';
import { describe, expect, it } from 'vitest';
import { BrunoImporter } from './bruno-importer';

/**
 * Creates a temporary Bruno collection directory with the given `.bru` files.
 *
 * @param collectionName - The collection name written to `bruno.json`
 * @param files - A map of relative file paths to their `.bru` file content
 * @returns Path to the temporary collection directory
 */
async function createBrunoCollection(
  collectionName: string,
  files: Record<string, string>
): Promise<string> {
  const collectionDir = await fs.mkdtemp(path.join(tmpdir(), 'bruno-test-'));
  await fs.writeFile(
    path.join(collectionDir, 'bruno.json'),
    JSON.stringify({ version: '1', name: collectionName, uid: 'test-collection-uid' })
  );

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(collectionDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  return collectionDir;
}

describe('BrunoImporter', () => {
  it('imports collection metadata', async () => {
    const collectionDir = await createBrunoCollection('My API', {
      'get-users.bru': `
meta {
  name: Get Users
  type: http
  seq: 1
}
get {
  url: https://api.example.com/users
  body: none
  auth: none
}`,
    });

    const result = await new BrunoImporter().importCollection(collectionDir);

    expect(result.title).toBe('My API');
    expect(result.id).toBe('test-collection-uid');
    expect(result.type).toBe('collection');
  });

  it('imports a simple GET request', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'get-resource.bru': `
meta {
  name: Get Resource
  type: http
  seq: 1
}
get {
  url: https://api.example.com/resource
  body: none
  auth: none
}
headers {
  Accept: application/json
  X-Custom-Header: some-value
}`,
    });

    const result = await new BrunoImporter().importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.type).toBe('request');
    expect(request.title).toBe('Get Resource');
    expect(request.method).toBe('GET');
    expect(request.url.base).toBe('https://api.example.com/resource');
    expect(request.headers).toEqual([
      { key: 'Accept', value: 'application/json', isActive: true },
      { key: 'X-Custom-Header', value: 'some-value', isActive: true },
    ]);
  });

  it('imports bearer auth', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'bearer.bru': `
meta {
  name: Bearer Auth Request
  type: http
  seq: 1
}
get {
  url: https://api.example.com/secure
  body: none
  auth: bearer
}
auth:bearer {
  token: my-bearer-token
}`,
    });

    const result = await new BrunoImporter().importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.BEARER,
      token: 'my-bearer-token',
    });
  });

  it('imports basic auth', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'basic.bru': `
meta {
  name: Basic Auth Request
  type: http
  seq: 1
}
get {
  url: https://api.example.com/secure
  body: none
  auth: basic
}
auth:basic {
  username: admin
  password: secret
}`,
    });

    const result = await new BrunoImporter().importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.BASIC,
      username: 'admin',
      password: 'secret',
    });
  });

  it('imports oauth2 client credentials auth', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'oauth2-cc.bru': `
meta {
  name: OAuth2 Client Credentials
  type: http
  seq: 1
}
get {
  url: https://api.example.com/protected
  body: none
  auth: oauth2
}
auth:oauth2 {
  grant_type: client_credentials
  access_token_url: https://auth.example.com/oauth/token
  client_id: my-client-id
  client_secret: my-client-secret
  scope: read write
  client_authentication: as_basic_auth_header
}`,
    });

    const result = await new BrunoImporter().importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toMatchObject({
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.CLIENT_CREDENTIALS,
      tokenUrl: 'https://auth.example.com/oauth/token',
      clientId: 'my-client-id',
      clientSecret: 'my-client-secret',
      scope: 'read write',
    });
  });

  it('imports oauth2 authorization code auth', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'oauth2-ac.bru': `
meta {
  name: OAuth2 Auth Code
  type: http
  seq: 1
}
get {
  url: https://api.example.com/protected
  body: none
  auth: oauth2
}
auth:oauth2 {
  grant_type: authorization_code
  authorization_url: https://auth.example.com/oauth/authorize
  access_token_url: https://auth.example.com/oauth/token
  client_id: code-client-id
  client_secret: code-secret
  scope: openid profile
  callback_url: http://localhost:3000/callback
  pkce: false
}`,
    });

    const result = await new BrunoImporter().importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toMatchObject({
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.AUTHORIZATION_CODE,
      authorizationUrl: 'https://auth.example.com/oauth/authorize',
      tokenUrl: 'https://auth.example.com/oauth/token',
      clientId: 'code-client-id',
      clientSecret: 'code-secret',
      scope: 'openid profile',
      callbackUrl: 'http://localhost:3000/callback',
    });
  });

  it('imports oauth2 authorization code with PKCE auth', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'oauth2-pkce.bru': `
meta {
  name: OAuth2 PKCE
  type: http
  seq: 1
}
get {
  url: https://api.example.com/protected
  body: none
  auth: oauth2
}
auth:oauth2 {
  grant_type: authorization_code
  authorization_url: https://auth.example.com/oauth/authorize
  access_token_url: https://auth.example.com/oauth/token
  client_id: pkce-client-id
  client_secret: pkce-secret
  scope: api:read
  callback_url: http://localhost:8080/callback
  pkce: true
}`,
    });

    const result = await new BrunoImporter().importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toMatchObject({
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.AUTHORIZATION_CODE_PKCE,
      authorizationUrl: 'https://auth.example.com/oauth/authorize',
      callbackUrl: 'http://localhost:8080/callback',
    });
  });

  it('imports request without auth', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'no-auth.bru': `
meta {
  name: No Auth
  type: http
  seq: 1
}
get {
  url: https://api.example.com/public
  body: none
  auth: none
}`,
    });

    const result = await new BrunoImporter().importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toBeUndefined();
  });

  it('imports JSON body', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'post-json.bru': `
meta {
  name: Create User
  type: http
  seq: 1
}
post {
  url: https://api.example.com/users
  body: json
  auth: none
}
body:json {
  {
    "name": "Alice"
  }
}`,
    });

    const result = await new BrunoImporter().importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.body.type).toBe(RequestBodyType.TEXT);
    if (request.body.type === RequestBodyType.TEXT) {
      expect(request.body.mimeType).toBe('application/json');
      expect(request.body.text).toContain('"name": "Alice"');
    }
  });

  it('imports multipart form body', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'upload.bru': `
meta {
  name: Upload File
  type: http
  seq: 1
}
post {
  url: https://api.example.com/upload
  body: multipartForm
  auth: none
}
body:multipart-form {
  field1: value1
  ~field2: inactive-value
}`,
    });

    const result = await new BrunoImporter().importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.body.type).toBe(RequestBodyType.FORM_DATA);
    if (request.body.type === RequestBodyType.FORM_DATA) {
      expect(request.body.fields).toHaveLength(2);
      expect(request.body.fields[0]).toMatchObject({ key: 'field1', isActive: true });
      expect(request.body.fields[1]).toMatchObject({ key: 'field2', isActive: false });
    }
  });

  it('imports nested folders and requests', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'root-request.bru': `
meta {
  name: Root Request
  type: http
  seq: 1
}
get {
  url: https://api.example.com/
  body: none
  auth: none
}`,
      'users/get-users.bru': `
meta {
  name: Get Users
  type: http
  seq: 1
}
get {
  url: https://api.example.com/users
  body: none
  auth: none
}`,
      'users/create-user.bru': `
meta {
  name: Create User
  type: http
  seq: 2
}
post {
  url: https://api.example.com/users
  body: json
  auth: none
}`,
    });

    const result = await new BrunoImporter().importCollection(collectionDir);

    expect(result.children).toHaveLength(2);
    const rootRequest = result.children[0] as TrufosRequest;
    expect(rootRequest.type).toBe('request');
    expect(rootRequest.title).toBe('Root Request');

    const usersFolder = result.children[1] as Folder;
    expect(usersFolder.type).toBe('folder');
    expect(usersFolder.title).toBe('users');
    expect(usersFolder.children).toHaveLength(2);
    expect((usersFolder.children[0] as TrufosRequest).title).toBe('Get Users');
    expect((usersFolder.children[1] as TrufosRequest).title).toBe('Create User');
  });

  it('accepts bruno.json file path as input', async () => {
    const collectionDir = await createBrunoCollection('Test by File', {});
    const brunoJsonPath = path.join(collectionDir, 'bruno.json');

    const result = await new BrunoImporter().importCollection(brunoJsonPath);
    expect(result.title).toBe('Test by File');
  });

  it('uses client_credentials auth method and maps credentialsPlacement', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'oauth2-body.bru': `
meta {
  name: OAuth2 Body Auth
  type: http
  seq: 1
}
get {
  url: https://api.example.com/protected
  body: none
  auth: oauth2
}
auth:oauth2 {
  grant_type: client_credentials
  access_token_url: https://auth.example.com/token
  client_id: cid
  client_secret: csecret
  scope: api
  credentials_placement: header
}`,
    });

    const result = await new BrunoImporter().importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toMatchObject({
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.CLIENT_CREDENTIALS,
      clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
    });
  });
});
