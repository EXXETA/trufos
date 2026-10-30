import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  AuthorizationType,
  type Folder,
  type ImportWarning,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
  type PluginFileSystem,
  type PluginLogger,
  RequestBodyType,
  type TrufosRequest,
} from 'shim/plugin';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BrunoImporter } from './bruno-importer';

const log: PluginLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const fileSystem: PluginFileSystem = {
  readdir: fs.readdir,
  stat: fs.stat,
  readFile: fs.readFile,
  writeFile: fs.writeFile,
};

// the collections the importer reads are written to a directory of their own, removed afterwards
let tmp: string;
beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(tmpdir(), 'bruno-test-'));
});
afterAll(() => fs.rm(tmp, { recursive: true, force: true }));

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
  const collectionDir = await fs.mkdtemp(path.join(tmp, 'collection-'));
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

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);

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

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
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

  it('imports query parameters from params:query block', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'search.bru': `
meta {
  name: Search
  type: http
  seq: 1
}
get {
  url: https://api.example.com/search
  body: none
  auth: none
}
params:query {
  q: hello world
  limit: 10
  ~disabled: nope
}`,
    });

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.url.query).toEqual([
      { key: 'q', value: 'hello world', isActive: true },
      { key: 'limit', value: '10', isActive: true },
      { key: 'disabled', value: 'nope', isActive: false },
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

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
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

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.BASIC,
      username: 'admin',
      password: 'secret',
    });
  });

  it('imports digest auth', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'digest.bru': `
meta {
  name: Digest Auth Request
  type: http
  seq: 1
}
get {
  url: https://api.example.com/secure
  body: none
  auth: digest
}
auth:digest {
  username: admin
  password: secret
}`,
    });

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.DIGEST,
      username: 'admin',
      password: 'secret',
    });
  });

  it('imports inherit auth', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'inherit.bru': `
meta {
  name: Inherit Auth Request
  type: http
  seq: 1
}
get {
  url: https://api.example.com/secure
  body: none
  auth: inherit
}`,
    });

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({ type: AuthorizationType.INHERIT });
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
  credentials_placement: header
}`,
    });

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toMatchObject({
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.CLIENT_CREDENTIALS,
      tokenUrl: 'https://auth.example.com/oauth/token',
      clientId: 'my-client-id',
      clientSecret: 'my-client-secret',
      scope: 'read write',
      clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
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

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
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

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
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

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
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

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.body.type).toBe(RequestBodyType.TEXT);
    if (request.body.type === RequestBodyType.TEXT) {
      expect(request.body.mimeType).toBe('application/json');
      expect(request.body.text).toContain('"name": "Alice"');
    }
  });

  it('imports urlencoded form body', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'urlencoded.bru': `
meta {
  name: URL Encoded Form
  type: http
  seq: 1
}
post {
  url: https://api.example.com/submit
  body: formUrlEncoded
  auth: none
}
body:form-urlencoded {
  key1: value with space
  ~key2: disabled value
}`,
    });

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.body.type).toBe(RequestBodyType.TEXT);
    if (request.body.type === RequestBodyType.TEXT) {
      expect(request.body.mimeType).toBe('application/x-www-form-urlencoded');
      expect(request.body.text).toBe('key1=value%20with%20space');
    }
  });

  it('imports a request without a body', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'none.bru': `
meta {
  name: No Body
  type: http
  seq: 1
}
get {
  url: https://api.example.com/users
  body: none
  auth: none
}`,
    });

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.body).toEqual({ type: RequestBodyType.NONE });
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

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);
    const request = result.children[0] as TrufosRequest;

    expect(request.body.type).toBe(RequestBodyType.FORM_DATA);
    if (request.body.type === RequestBodyType.FORM_DATA) {
      expect(request.body.fields).toHaveLength(2);
      expect(request.body.fields[0]).toMatchObject({ key: 'field1', isActive: true });
      expect(request.body.fields[1]).toMatchObject({ key: 'field2', isActive: false });
    }
  });

  it('throws a clear error when bruno.json is missing', async () => {
    const emptyDir = await fs.mkdtemp(path.join(tmp, 'empty-'));

    await expect(new BrunoImporter(log, fileSystem).importCollection(emptyDir)).rejects.toThrow(
      /valid Bruno collection/i
    );
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

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);

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

  it('skips unsupported Bruno files and exposes import warnings', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'request.bru': `
meta {
  name: Request
  type: http
  seq: 1
}
get {
  url: https://api.example.com/
  body: none
  auth: none
}`,
      'script.bru': `
meta {
  name: Script
  type: js
  seq: 2
}
script:pre-request {
  console.log("skip me");
}`,
      'grpc.bru': `
meta {
  name: Grpc Request
  type: grpc
  seq: 3
}
grpc {
  url: grpc.example.com
  method: users.UserService/GetUser
}`,
      'socket.bru': `
meta {
  name: Socket Request
  type: ws
  seq: 4
}
ws {
  url: ws://example.com/events
  body: ws
}`,
      'missing-http.bru': `
meta {
  name: Missing HTTP
  type: http
  seq: 5
}
script:pre-request {
  console.log("no method block");
}`,
    });

    const warnings: ImportWarning[] = [];
    const result = await new BrunoImporter(log, fileSystem).importCollection(
      collectionDir,
      (warning) => warnings.push(warning)
    );

    expect(result.children).toHaveLength(1);
    expect((result.children[0] as TrufosRequest).title).toBe('Request');
    expect(warnings).toEqual([
      expect.objectContaining({
        filePath: 'script.bru',
        itemName: 'Script',
        itemType: 'js',
      }),
      expect.objectContaining({
        filePath: 'grpc.bru',
        itemName: 'Grpc Request',
        itemType: 'grpc',
      }),
      expect.objectContaining({
        filePath: 'socket.bru',
        itemName: 'Socket Request',
        itemType: 'websocket',
      }),
      expect.objectContaining({
        filePath: 'missing-http.bru',
        itemName: 'Missing HTTP',
        itemType: 'http',
      }),
    ]);
  });

  it('imports environments from environments/ directory', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'environments/dev.bru': `
vars {
  baseUrl: https://dev.example.com
  apiKey: dev-key-123
}`,
      'environments/prod.bru': `
vars {
  baseUrl: https://api.example.com
  apiKey: prod-key-456
}`,
    });

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);

    expect(Object.keys(result.environments)).toHaveLength(2);
    expect(result.environments['dev'].variables['baseUrl'].value).toBe('https://dev.example.com');
    expect(result.environments['dev'].variables['apiKey'].value).toBe('dev-key-123');
    expect(result.environments['prod'].variables['baseUrl'].value).toBe('https://api.example.com');
    expect(result.environments['prod'].variables['apiKey'].value).toBe('prod-key-456');
  });

  it('keeps the other environments if one cannot be read and warns about it', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'environments/a-dev.bru': 'vars {\n  host: dev\n}',
      'environments/b-broken.bru': 'this is { not valid',
      'environments/c-prod.bru': 'vars {\n  host: prod\n}',
    });

    const warnings: ImportWarning[] = [];
    const result = await new BrunoImporter(log, fileSystem).importCollection(
      collectionDir,
      (warning) => warnings.push(warning)
    );

    expect(Object.keys(result.environments)).toEqual(['a-dev', 'c-prod']);
    expect(warnings).toEqual([
      expect.objectContaining({
        filePath: path.join('environments', 'b-broken.bru'),
        itemName: 'b-broken',
        itemType: 'environment',
      }),
    ]);
  });

  it('does not warn about a collection without environments', async () => {
    const collectionDir = await createBrunoCollection('Test', {});

    const warnings: ImportWarning[] = [];
    await new BrunoImporter(log, fileSystem).importCollection(collectionDir, (warning) =>
      warnings.push(warning)
    );

    expect(warnings).toEqual([]);
  });

  it('warns if the environments directory cannot be read', async () => {
    const collectionDir = await createBrunoCollection('Test', { environments: 'not a directory' });

    const warnings: ImportWarning[] = [];
    await new BrunoImporter(log, fileSystem).importCollection(collectionDir, (warning) =>
      warnings.push(warning)
    );

    expect(warnings).toEqual([expect.objectContaining({ filePath: 'environments' })]);
  });

  it('keeps the warnings of concurrent imports apart', async () => {
    const broken = 'this is { not valid';
    const [firstDir, secondDir] = await Promise.all([
      createBrunoCollection('First', { 'first.bru': broken }),
      createBrunoCollection('Second', { 'second.bru': broken }),
    ]);
    const importer = new BrunoImporter(log, fileSystem);
    const first: ImportWarning[] = [];
    const second: ImportWarning[] = [];

    await Promise.all([
      importer.importCollection(firstDir, (warning) => first.push(warning)),
      importer.importCollection(secondDir, (warning) => second.push(warning)),
    ]);

    expect(first).toEqual([expect.objectContaining({ filePath: 'first.bru' })]);
    expect(second).toEqual([expect.objectContaining({ filePath: 'second.bru' })]);
  });

  it('sorts requests with a non-numeric seq after the numbered ones', async () => {
    const bru = (name: string, seq: string) => `
meta {
  name: ${name}
  type: http
  seq: ${seq}
}
get {
  url: https://api.example.com/
  body: none
  auth: none
}`;
    const collectionDir = await createBrunoCollection('Test', {
      'a.bru': bru('A', '2'),
      'b.bru': bru('B', 'abc'),
      'c.bru': bru('C', '1'),
    });

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);

    expect(result.children.map(({ title }) => title)).toEqual(['C', 'A', 'B']);
  });

  it.each([
    ['is not an object', '[]'],
    ['has no name', '{ "uid": "id" }'],
    ['has a name that is not a string', '{ "name": 1 }'],
  ])('throws a clear error if bruno.json %s', async (_, content) => {
    const collectionDir = await createBrunoCollection('Test', {});
    await fs.writeFile(path.join(collectionDir, 'bruno.json'), content);

    await expect(
      new BrunoImporter(log, fileSystem).importCollection(collectionDir)
    ).rejects.toThrow(/valid Bruno collection/i);
  });

  it('accepts bruno.json file path as input', async () => {
    const collectionDir = await createBrunoCollection('Test by File', {});
    const brunoJsonPath = path.join(collectionDir, 'bruno.json');

    const result = await new BrunoImporter(log, fileSystem).importCollection(brunoJsonPath);
    expect(result.title).toBe('Test by File');
  });

  it('skips environments/ and node_modules/ directories as folders', async () => {
    const collectionDir = await createBrunoCollection('Test', {
      'api/get.bru': `
meta {
  name: Get
  type: http
  seq: 1
}
get {
  url: https://api.example.com/
  body: none
  auth: none
}`,
      'environments/local.bru': `vars { host: localhost }`,
    });

    const result = await new BrunoImporter(log, fileSystem).importCollection(collectionDir);

    // Only the 'api' folder should appear — not 'environments'
    expect(result.children).toHaveLength(1);
    expect((result.children[0] as Folder).title).toBe('api');
  });
});
