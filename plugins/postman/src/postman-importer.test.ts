import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AuthorizationType,
  type Folder,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
  OAuth2PKCECodeChallengeMethod,
  type PluginFileSystem,
  type PluginLogger,
  type TrufosRequest,
} from 'shim/plugin';
import { describe, expect, it, vi } from 'vitest';
import { PostmanImporter } from './postman-importer';

const log: PluginLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const fileSystem: PluginFileSystem = {
  readdir: fs.readdir,
  stat: fs.stat,
  readFile: fs.readFile,
  writeFile: fs.writeFile,
};

const POSTMAN_COLLECTION =
  '{"info":{"name":"HTTP Status Messages","id":"my-collection-id","_postman_schema":"https://schema.getpostman.com/#2.0.0","version":{"major":"2","minor":"0","patch":"0","prerelease":"draft.1"}},"variable":[{"id":"var-1","type":"string","value":"hello-world"},{"id":"var-2","type":"number","value":"123"},{"id":"var-3","type":"boolean","value":"true"},{"id":"var-4","type":"any","value":"hello-world-any"},{"id":"var-5","value":null}],"event":[{"listen":"test","id":"my-global-script-1","script":{"type":"text/javascript","exec":["const package1 = pm.require(\\"package1\\");","console.log(\\"hello\\", package1);"],"packages":{"package1":{"id":"script-package-1"}}}},{"listen":"prerequest","script":{"type":"text/javascript","exec":["const package1 = pm.require(\\"package1\\");","console.log(\\"hello\\", package1);"],"packages":{"package1":{"id":"script-package-1"}}}}],"item":[{"id":"request-200","description":{"content":"<h1>This is H1</h1> <i>italic</i> <script>script content will be dropped in toString()</script>","version":"2.0.1-abc+efg"},"name":"200 ok","request":"http://echo.getpostman.com/status/200?key=value","response":[{"name":"a sample response","originalRequest":"http://echo.getpostman.com/status/200","status":"200 OK","code":200,"header":"Content-Type: application/json\\r\\nAuthorization: Hawk id=\\"dh37fgj492je\\", ts=\\"1448549987\\", nonce=\\"eOJZCd\\", mac=\\"O2TFlvAlMvKVSKOzc6XkfU6+5285k5p3m5dAjxumo2k=\\"\\r\\n","cookie":[{"domain":".httpbin.org","expires":1502442248,"hostOnly":false,"httpOnly":false,"key":"_ga","path":"/","secure":false,"session":false,"_postman_storeId":"0","value":"GA1.2.113558537.1435817423"}],"body":"response body"}],"event":[{"listen":"test","script":"my-global-script-1"},{"listen":"test","script":{"type":"text/javascript","exec":"console.log(\\"hello\\");"}}],"proxy":{"match":"https://*.getpostman.com/*","server":"https://proxy.com"},"protocolProfileBehavior":{"disableBodyPruning":true}},{"id":"request-200-post","description":{"content":"<h1>This is H1</h1> <i>italic</i> <script>script content will be dropped in toString()</script>","version":"2.0.1-abc+efg"},"name":"200 ok","request":{"description":{"content":"my description","type":"text/markdown"},"method":"POST","url":"http://echo.getpostman.com/post","header":[{"key":"Content-Type","value":"application/json"}],"body":{"mode":"urlencoded","urlencoded":[{"key":"yo","value":"mate"}]}},"response":[{"name":"a sample response","originalRequest":"http://echo.getpostman.com/post","status":"200 OK","code":200,"header":"Content-Type: application/json\\r\\nAuthorization: Hawk id=\\"dh37fgj492je\\", ts=\\"1448549987\\", nonce=\\"eOJZCd\\", mac=\\"O2TFlvAlMvKVSKOzc6XkfU6+5285k5p3m5dAjxumo2k=\\"\\r\\n","cookie":[{"domain":".httpbin.org","expires":1502442248,"hostOnly":false,"httpOnly":false,"key":"_ga","path":"/","secure":false,"session":false,"_postman_storeId":"0","value":"GA1.2.113558537.1435817423"}],"body":"response body"}],"event":[{"listen":"test","script":"my-global-script-1"},{"listen":"test","script":{"type":"text/javascript","exec":"console.log(\\"hello\\");"}}]},{"name":"This is a folder","id":"my-folder-1","_my_meta":"hello","item":[{"id":"request-200","name":"201","request":{"url":"http://echo.getpostman.com/status/201","method":"PUT","body":{"mode":"urlencoded","urlencoded":[{"key":"yo","value":"mate"}]},"header":"Content-Type: application/json\\nAuthorization: Hawk id=\\"dh37fgj492je\\", ts=\\"1448549987\\", nonce=\\"eOJZCd\\", mac=\\"O2TFlvAlMvKVSKOzc6XkfU6+5285k5p3m5dAjxumo2k=\\"\\n"}},{"id":"request-post","name":"201","request":{"url":"http://echo.getpostman.com/post","body":{"mode":"raw","raw":"blahblah"},"auth":{"type":"basic","basic":{"username":"yosam","password":"asdhjajsd"}}}},{"id":"request-400","name":"400 bad request","request":"http://shamasis:pass@echo.getpostman.com:9443/status/400/?query=string&a=b&abcd#{{search}}"},{"id":"This is a sub folder","name":"my-folder-2","item":[{"id":"blank-folder","name":"This is a blank","item":[{"id":"request-gg","name":"gg not found","request":{"description":{"content":"Some stuff I want to say about this request. It\'s in *markdown* too.","type":"text/markdown","version":"1.2.3+hi"},"url":{"description":"This is a nice URL.","protocol":"https","port":"8443","path":"path/to/document","host":"sub.example.com."},"header":[{"key":"Host","value":"sub.example.com"},{"key":"Content-Type","value":"application/json"}]},"event":[{"listen":"test","script":{"type":"text/javascript","exec":["postman.setEnvironmentVariable(\\"username\\", \\"a85\\");","postman.setEnvironmentVariable(\\"repository\\", \\"Newman\\")"]}},{"listen":"prerequest","script":{"type":"text/javascript","exec":"console.log(\\"hello\\");\\r\\nconsole.log(\'hi\')"}}]}]},{"id":"solo-folder","name":"Solo Folder","item":[{"id":"request-404","name":"404 not found","request":{"description":{"content":"Some stuff I want to say about this request. It\'s in *markdown* too.","type":"text/markdown","version":"1.2.3+hi"},"url":{"description":"This is a nice URL.","protocol":"https","port":"8443","path":"path/to/document","host":"sub.example.com."},"auth":{"type":"hawk","basic":{"username":"yosam","password":"asdhjajsd"},"hawk":{"authKey":"asjehcgfdjyrggucgn"}},"header":[{"key":"Access-Control-Allow-Credentials","value":"true","description":"Setting this header to \'true\' means that the server allows cookies (or other user credentials) to be included on cross-origin requests."},{"key":"Server","value":"nginx","description":"Server Name"}]},"event":[{"listen":"test","script":{"type":"text/javascript","exec":["postman.setEnvironmentVariable(\\"username\\", \\"a85\\");","postman.setEnvironmentVariable(\\"repository\\", \\"Newman\\")"]}},{"listen":"prerequest","script":{"type":"text/javascript","exec":"console.log(\\"hello\\");\\r\\nconsole.log(\'hi\')"}}]}]}]}]}],"protocolProfileBehavior":{"disableBodyPruning":false}}';

const createCollection = (auth: unknown) => ({
  info: {
    name: 'Auth Import Test',
    id: 'test-collection-id',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      id: 'test-request-id',
      name: 'test request',
      request: {
        method: 'GET',
        url: 'https://example.com/resource',
        auth,
      },
    },
  ],
});

describe('PostmanImporter', () => {
  it.each([
    ['is not JSON', 'not json'],
    ['is not an object', '[]'],
    ['has no info', '{ "item": [] }'],
    ['has no name', '{ "info": {} }'],
  ])('throws a clear error if the file %s', async (_, content) => {
    const srcFilePath = path.join(tmpdir(), 'invalid-postman-collection.json');
    await fs.writeFile(srcFilePath, content);

    await expect(
      new PostmanImporter(log, fileSystem).importCollection(srcFilePath)
    ).rejects.toThrow(/valid Postman collection/i);
  });

  it('imports a collection with its variables, folders and requests', async () => {
    // Arrange
    const srcFilePath = path.join(tmpdir(), 'postman-collection.json');
    await fs.writeFile(srcFilePath, POSTMAN_COLLECTION);

    // Act
    const collection = await new PostmanImporter(log, fileSystem).importCollection(srcFilePath);

    // Assert
    expect(collection.type).toBe('collection');
    expect(collection.title).toBe('HTTP Status Messages');
    expect(Object.keys(collection.variables).length).toBe(5);

    const childrenLevel1 = collection.children;
    expect(childrenLevel1.length).toBe(3);

    const firstChild = childrenLevel1[0] as TrufosRequest;
    expect(firstChild.type).toBe('request');
    expect(firstChild.title).toBe('200 ok');
    expect(firstChild.url).toEqual({
      base: 'http://echo.getpostman.com/status/200',
      query: [{ key: 'key', value: 'value', isActive: true }],
    });
    expect(firstChild.method).toBe('GET');
    expect(firstChild.headers).toEqual([]);
    expect(firstChild.body).toEqual({ type: 'none' });

    const secondChild = childrenLevel1[1] as TrufosRequest;
    expect(secondChild.type).toBe('request');
    expect(secondChild.title).toBe('200 ok');
    expect(secondChild.url).toEqual({ base: 'http://echo.getpostman.com/post', query: [] });
    expect(secondChild.method).toBe('POST');
    expect(secondChild.headers).toEqual([
      {
        isActive: true,
        key: 'Content-Type',
        value: 'application/json',
      },
    ]);
    expect(secondChild.body).toEqual({ type: 'none' });

    const thirdChild = childrenLevel1[2] as Folder;
    expect(thirdChild.type).toBe('folder');
    expect(thirdChild.title).toBe('This is a folder');

    const childrenLevel2 = thirdChild.children;
    expect(childrenLevel2.length).toBe(4);

    const firstChildLevel2 = childrenLevel2[0] as TrufosRequest;
    expect(firstChildLevel2.type).toBe('request');
    expect(firstChildLevel2.title).toBe('201');
    expect(firstChildLevel2.url).toEqual({
      base: 'http://echo.getpostman.com/status/201',
      query: [],
    });
    expect(firstChildLevel2.method).toBe('PUT');
    expect(firstChildLevel2.headers).toEqual([
      {
        isActive: true,
        key: 'Content-Type',
        value: 'application/json',
      },
      {
        isActive: true,
        key: 'Authorization',
        value:
          'Hawk id="dh37fgj492je", ts="1448549987", nonce="eOJZCd", mac="O2TFlvAlMvKVSKOzc6XkfU6+5285k5p3m5dAjxumo2k="',
      },
    ]);
    expect(firstChildLevel2.body).toEqual({ type: 'none' });

    const secondChildLevel2 = childrenLevel2[1] as TrufosRequest;
    expect(secondChildLevel2.type).toBe('request');
    expect(secondChildLevel2.title).toBe('201');
    expect(secondChildLevel2.url).toEqual({ base: 'http://echo.getpostman.com/post', query: [] });
    expect(secondChildLevel2.method).toBe('GET');
    expect(secondChildLevel2.headers).toEqual([]);
    expect(secondChildLevel2.body).toEqual({
      mimeType: 'text/plain',
      text: 'blahblah',
      type: 'text',
    });
  });

  it('imports basic auth', async () => {
    const collection = createCollection({
      type: 'basic',
      basic: [
        { key: 'username', value: 'user1' },
        { key: 'password', value: 'pass1' },
      ],
    });
    const srcFilePath = path.join(tmpdir(), 'postman-basic.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter(log, fileSystem).importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.BASIC,
      username: 'user1',
      password: 'pass1',
    });
  });

  it('imports digest auth', async () => {
    const collection = createCollection({
      type: 'digest',
      digest: [
        { key: 'username', value: 'user1' },
        { key: 'password', value: 'pass1' },
        { key: 'algorithm', value: 'MD5' },
      ],
    });
    const srcFilePath = path.join(tmpdir(), 'postman-digest.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter(log, fileSystem).importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.DIGEST,
      username: 'user1',
      password: 'pass1',
    });
  });

  it('imports bearer auth', async () => {
    const collection = createCollection({
      type: 'bearer',
      bearer: [{ key: 'token', value: 'my-token-123' }],
    });
    const srcFilePath = path.join(tmpdir(), 'postman-bearer.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter(log, fileSystem).importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.BEARER,
      token: 'my-token-123',
    });
  });

  it('imports oauth2 client credentials auth', async () => {
    const collection = createCollection({
      type: 'oauth2',
      oauth2: [
        { key: 'grant_type', value: 'client_credentials' },
        { key: 'accessTokenUrl', value: 'https://example.com/oauth/token' },
        { key: 'clientId', value: 'client-id' },
        { key: 'clientSecret', value: 'client-secret' },
        { key: 'scope', value: 'read:all' },
        { key: 'addTokenTo', value: 'header' },
      ],
    });
    const srcFilePath = path.join(tmpdir(), 'postman-oauth2-cc.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter(log, fileSystem).importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.CLIENT_CREDENTIALS,
      issuerUrl: '',
      tokenUrl: 'https://example.com/oauth/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      scope: 'read:all',
      clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
    });
  });

  it('imports oauth2 authorization code auth', async () => {
    const collection = createCollection({
      type: 'oauth2',
      oauth2: [
        { key: 'grant_type', value: 'authorization_code' },
        { key: 'authUrl', value: 'https://example.com/oauth/authorize' },
        { key: 'accessTokenUrl', value: 'https://example.com/oauth/token' },
        { key: 'clientId', value: 'client-id-2' },
        { key: 'clientSecret', value: 'client-secret-2' },
        { key: 'scope', value: 'write:all' },
        { key: 'redirect_uri', value: 'http://localhost:3000/callback' },
        { key: 'addTokenTo', value: 'header' },
      ],
    });
    const srcFilePath = path.join(tmpdir(), 'postman-oauth2-ac.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter(log, fileSystem).importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.AUTHORIZATION_CODE,
      issuerUrl: '',
      tokenUrl: 'https://example.com/oauth/token',
      clientId: 'client-id-2',
      clientSecret: 'client-secret-2',
      scope: 'write:all',
      clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
      authorizationUrl: 'https://example.com/oauth/authorize',
      callbackUrl: 'http://localhost:3000/callback',
    });
  });

  it('imports oauth2 authorization code pkce auth', async () => {
    const collection = createCollection({
      type: 'oauth2',
      oauth2: [
        { key: 'grant_type', value: 'authorization_code_with_pkce' },
        { key: 'authUrl', value: 'https://example.com/oauth/authorize' },
        { key: 'accessTokenUrl', value: 'https://example.com/oauth/token' },
        { key: 'clientId', value: 'client-id-3' },
        { key: 'clientSecret', value: 'client-secret-3' },
        { key: 'scope', value: 'api:read' },
        { key: 'redirect_uri', value: 'http://localhost:8080/callback' },
        { key: 'client_authentication', value: 'body' },
        { key: 'challengeAlgorithm', value: 'S256' },
        { key: 'code_verifier', value: 'my-code-verifier' },
      ],
    });
    const srcFilePath = path.join(tmpdir(), 'postman-oauth2-pkce.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter(log, fileSystem).importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.AUTHORIZATION_CODE_PKCE,
      issuerUrl: '',
      tokenUrl: 'https://example.com/oauth/token',
      clientId: 'client-id-3',
      clientSecret: 'client-secret-3',
      scope: 'api:read',
      clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.REQUEST_BODY,
      authorizationUrl: 'https://example.com/oauth/authorize',
      callbackUrl: 'http://localhost:8080/callback',
      codeChallengeMethod: OAuth2PKCECodeChallengeMethod.S256,
      codeVerifier: 'my-code-verifier',
    });
  });

  it('imports request without auth', async () => {
    const collection = createCollection(undefined);
    const srcFilePath = path.join(tmpdir(), 'postman-no-auth.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter(log, fileSystem).importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toBeUndefined();
  });
});
